import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";

import getOpenAIClient, { ANALYSIS_MODEL } from "@/lib/ai/openai";
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisUserPrompt,
} from "@/lib/ai/prompts";
import {
  EnvConfigurationError,
  envSetupMessage,
  optionalPositiveIntegerEnv,
} from "@/lib/env/server";
import { logError, logInfo } from "@/lib/logging/server";
import { embedText } from "@/lib/rag/embeddings";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkSchema } from "@/lib/validations/check";
import type { AIAnalysisResult } from "@/types";

const CREDITS_PER_CHECK = 8;
const MODEL_USED = ANALYSIS_MODEL;
const MATCH_COUNT = 6;
const MATCH_SIMILARITY_THRESHOLD = 0.05;
const RATE_LIMIT_WINDOW_MS = 60_000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,120}$/;

const analysisResponseJsonSchema = {
  name: "scope_analysis_result",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      scope_status: {
        type: "string",
        enum: ["in_scope", "out_of_scope", "needs_clarification"],
      },
      risk_level: {
        type: "string",
        enum: ["low", "medium", "high"],
      },
      estimated_hours_min: {
        type: "integer",
        minimum: 0,
      },
      estimated_hours_max: {
        type: "integer",
        minimum: 0,
      },
      ai_reason: {
        type: "string",
      },
      suggested_action: {
        type: "string",
      },
      professional_reply: {
        type: "string",
      },
      change_request_summary: {
        type: "string",
      },
      matched_clause_ids: {
        type: "array",
        items: {
          type: "string",
        },
      },
    },
    required: [
      "scope_status",
      "risk_level",
      "estimated_hours_min",
      "estimated_hours_max",
      "ai_reason",
      "suggested_action",
      "professional_reply",
      "change_request_summary",
      "matched_clause_ids",
    ],
  },
} as const;

const aiAnalysisResultSchema = z.object({
  scope_status: z.enum(["in_scope", "out_of_scope", "needs_clarification"]),
  risk_level: z.enum(["low", "medium", "high"]),
  estimated_hours_min: z.number().int().min(0),
  estimated_hours_max: z.number().int().min(0),
  ai_reason: z.string(),
  suggested_action: z.string(),
  professional_reply: z.string(),
  change_request_summary: z.string(),
  matched_clause_ids: z.array(z.string()),
});

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  client_name: string | null;
  original_scope: string;
  deliverables: string | null;
  exclusions: string | null;
  revision_limit: number | null;
  hourly_rate: number | null;
  scope_locked: boolean;
  scope_chunks_count: number;
};

type AnalysisRequestStatus =
  | "claimed"
  | "completed"
  | "processing"
  | "failed"
  | "conflict";

type AnalysisRequestClaim = {
  status: AnalysisRequestStatus;
  id: string | null;
  scopeCheckId: string | null;
  error: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

class NoRelevantChunksError extends Error {}

function supabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === "string" ? code : null;
}

function analyzeRateLimit() {
  return optionalPositiveIntegerEnv("RATE_LIMIT_ANALYZE_PER_MINUTE", 6);
}

function idempotencyKeyFromRequest(request: Request) {
  const key = request.headers.get("Idempotency-Key")?.trim();

  if (!key) {
    return null;
  }

  return IDEMPOTENCY_KEY_PATTERN.test(key) ? key : null;
}

function hashAnalysisRequest(data: z.infer<typeof checkSchema>) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        project_id: data.project_id,
        client_request: data.client_request,
        urgency: data.urgency ?? null,
        client_tone: data.client_tone ?? null,
        extra_notes: data.extra_notes ?? null,
      }),
    )
    .digest("hex");
}

function isOpenAIRetryableError(error: unknown) {
  return (
    error instanceof OpenAI.APIConnectionError ||
    error instanceof OpenAI.APIConnectionTimeoutError ||
    (error instanceof OpenAI.APIError && error.status >= 500)
  );
}

function isOpenAIAuthError(error: unknown) {
  return error instanceof OpenAI.AuthenticationError;
}

function toProjectRow(value: unknown): ProjectRow | null {
  const parsed = z
    .object({
      id: z.string(),
      user_id: z.string(),
      name: z.string(),
      client_name: z.string().nullable(),
      original_scope: z.string(),
      deliverables: z.string().nullable(),
      exclusions: z.string().nullable(),
      revision_limit: z.number().nullable(),
      hourly_rate: z.coerce.number().nullable(),
      scope_locked: z.boolean(),
      scope_chunks_count: z.number(),
    })
    .safeParse(value);

  return parsed.success ? parsed.data : null;
}

async function refundCredits(userId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("admin_refund_credits", {
    p_user_id: userId,
    p_credits: CREDITS_PER_CHECK,
  });

  if (error) {
    logError("credits.refund.failed", {
      userId,
      credits: CREDITS_PER_CHECK,
      error: error.message,
    });
    return;
  }

  logInfo("credits.refunded", {
    userId,
    credits: CREDITS_PER_CHECK,
    reason: "analysis_failed",
  });
}

const creditRpcSchema = z
  .object({
    success: z.boolean(),
    credits_balance: z.number().nullable(),
    reason: z.string().nullable(),
  })
  .passthrough();

function firstRpcRow(value: unknown) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

async function consumeCredits(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.rpc("consume_credits", {
    p_credits: CREDITS_PER_CHECK,
  });

  if (error) {
    throw new Error(`Credit deduction failed: ${error.message}`);
  }

  return creditRpcSchema.parse(firstRpcRow(data));
}

async function claimAnalysisRequest({
  userId,
  projectId,
  idempotencyKey,
  requestHash,
}: {
  userId: string;
  projectId: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<AnalysisRequestClaim> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("analysis_requests")
    .insert({
      user_id: userId,
      project_id: projectId,
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      status: "processing",
      scope_check_id: null,
      error: null,
    })
    .select("id, request_hash, status, scope_check_id, error")
    .single();

  if (!error && data) {
    return {
      status: "claimed",
      id: String(data.id),
      scopeCheckId: null,
      error: null,
    };
  }

  if (supabaseErrorCode(error) !== "23505") {
    throw new Error(
      `Analysis idempotency claim failed: ${error?.message ?? "unknown error"}`,
    );
  }

  const { data: existing, error: lookupError } = await admin
    .from("analysis_requests")
    .select("id, request_hash, status, scope_check_id, error")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .single();

  if (lookupError || !existing) {
    throw new Error(
      `Analysis idempotency lookup failed: ${
        lookupError?.message ?? "unknown error"
      }`,
    );
  }

  if (existing.request_hash !== requestHash) {
    return {
      status: "conflict",
      id: String(existing.id),
      scopeCheckId: null,
      error: "Idempotency key was already used for a different request.",
    };
  }

  return {
    status: existing.status as AnalysisRequestStatus,
    id: String(existing.id),
    scopeCheckId: existing.scope_check_id
      ? String(existing.scope_check_id)
      : null,
    error: existing.error ? String(existing.error) : null,
  };
}

async function updateAnalysisRequest(
  requestId: string,
  values: {
    status: "completed" | "failed";
    scopeCheckId?: string | null;
    error?: string | null;
  },
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("analysis_requests")
    .update({
      status: values.status,
      scope_check_id: values.scopeCheckId ?? null,
      error: values.error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    logError("analysis.idempotency_update.failed", {
      requestId,
      status: values.status,
      error: error.message,
    });
  }
}

const matchedChunkSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  chunk_index: z.number(),
  source_field: z.string(),
  chunk_text: z.string(),
  similarity: z.number(),
});

async function matchScopeChunks(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  embedding: number[],
) {
  const { data, error } = await supabase.rpc("match_scope_chunks", {
    p_project_id: projectId,
    p_query_embedding: embedding,
    p_match_count: MATCH_COUNT,
    p_similarity_threshold: MATCH_SIMILARITY_THRESHOLD,
  });

  if (error) {
    throw new Error(`Scope retrieval failed: ${error.message}`);
  }

  return z.array(matchedChunkSchema).parse(data ?? []);
}

export async function POST(request: Request) {
  let supabase: ReturnType<typeof createClient>;

  try {
    supabase = createClient();
  } catch (caughtError) {
    if (caughtError instanceof EnvConfigurationError) {
      return NextResponse.json(
        { error: envSetupMessage(caughtError) },
        { status: 503 },
      );
    }

    throw caughtError;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    const ipResult = checkRateLimit({
      key: `ip:${getClientIp(request)}`,
      limit: optionalPositiveIntegerEnv("RATE_LIMIT_ANALYZE_IP_PER_MINUTE", 20),
      windowMs: RATE_LIMIT_WINDOW_MS,
      route: "api.analyze",
    });

    if (!ipResult.allowed) {
      return rateLimitResponse(ipResult);
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit({
    key: `user:${user.id}`,
    limit: analyzeRateLimit(),
    windowMs: RATE_LIMIT_WINDOW_MS,
    route: "api.analyze",
  });

  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit);
  }

  const idempotencyKey = idempotencyKeyFromRequest(request);

  if (!idempotencyKey) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid Idempotency-Key header. Submit each analysis with a stable unique key.",
      },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = checkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", parsed.data.project_id)
    .limit(1)
    .single();

  if (projectError || !projectData) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const project = toProjectRow(projectData);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!project.scope_locked || project.scope_chunks_count === 0) {
    return NextResponse.json(
      {
        error:
          "Project scope must be locked and indexed before running an AI check.",
      },
      { status: 409 },
    );
  }

  const requestHash = hashAnalysisRequest(parsed.data);
  let analysisRequestId: string | null = null;
  let creditsConsumed = false;

  try {
    getOpenAIClient();
  } catch (caughtError) {
    if (caughtError instanceof EnvConfigurationError) {
      return NextResponse.json(
        { error: envSetupMessage(caughtError) },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: errorMessage(caughtError) },
      { status: 500 },
    );
  }

  try {
    const claim = await claimAnalysisRequest({
      userId: user.id,
      projectId: project.id,
      idempotencyKey,
      requestHash,
    });

    analysisRequestId = claim.id;

    if (claim.status === "completed" && claim.scopeCheckId) {
      logInfo("analysis.idempotent_replay", {
        userId: user.id,
        projectId: project.id,
        scopeCheckId: claim.scopeCheckId,
      });
      return NextResponse.json(
        { id: claim.scopeCheckId, duplicate: true },
        { status: 200 },
      );
    }

    if (claim.status === "processing") {
      return NextResponse.json(
        { error: "This analysis request is already in progress." },
        { status: 409 },
      );
    }

    if (claim.status === "failed") {
      return NextResponse.json(
        {
          error:
            "This analysis request already failed. Submit again to retry with a new idempotency key.",
        },
        { status: 409 },
      );
    }

    if (claim.status === "conflict") {
      return NextResponse.json(
        { error: claim.error ?? "Idempotency key conflict." },
        { status: 409 },
      );
    }
  } catch (caughtError) {
    logError("analysis.idempotency_claim.failed", {
      userId: user.id,
      projectId: project.id,
      error: errorMessage(caughtError),
    });
    return NextResponse.json(
      { error: "Unable to start analysis safely. Please try again." },
      { status: 500 },
    );
  }

  let creditResult: z.infer<typeof creditRpcSchema>;

  try {
    creditResult = await consumeCredits(supabase);
  } catch (caughtError) {
    if (analysisRequestId) {
      await updateAnalysisRequest(analysisRequestId, {
        status: "failed",
        error: errorMessage(caughtError),
      });
    }

    return NextResponse.json(
      { error: errorMessage(caughtError) },
      { status: 500 },
    );
  }

  if (!creditResult.success) {
    if (analysisRequestId) {
      await updateAnalysisRequest(analysisRequestId, {
        status: "failed",
        error: creditResult.reason ?? "credit_deduction_failed",
      });
    }

    if (creditResult.reason === "insufficient_credits") {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          credits_remaining: creditResult.credits_balance ?? 0,
        },
        { status: 402 },
      );
    }

    return NextResponse.json(
      {
        error:
          creditResult.reason === "profile_not_found"
            ? "Profile not found"
            : "Credit deduction failed",
      },
      { status: creditResult.reason === "profile_not_found" ? 404 : 500 },
    );
  }

  creditsConsumed = true;
  logInfo("analysis.started", {
    userId: user.id,
    projectId: project.id,
    analysisRequestId,
    credits: CREDITS_PER_CHECK,
    balanceAfterDebit: creditResult.credits_balance,
  });

  try {
    const requestEmbedding = await embedText(parsed.data.client_request);
    const matchedChunks = await matchScopeChunks(
      supabase,
      project.id,
      requestEmbedding.embedding,
    );
    const matchedClauses = matchedChunks.map((chunk) => ({
      id: chunk.id,
      source_field: chunk.source_field,
      chunk_text: chunk.chunk_text,
      similarity: Number(chunk.similarity),
    }));

    if (matchedClauses.length === 0) {
      throw new NoRelevantChunksError(
        "No relevant locked-scope clauses were retrieved.",
      );
    }

    const openai = getOpenAIClient();
    const aiResponse = await openai.chat.completions.create({
      model: MODEL_USED,
      response_format: {
        type: "json_schema",
        json_schema: analysisResponseJsonSchema,
      },
      messages: [
        {
          role: "system",
          content: ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildAnalysisUserPrompt({
            projectName: project.name,
            clientName: project.client_name,
            revisionLimit: project.revision_limit,
            hourlyRate: project.hourly_rate,
            clientRequest: parsed.data.client_request,
            urgency: parsed.data.urgency ?? null,
            clientTone: parsed.data.client_tone ?? null,
            extraNotes: parsed.data.extra_notes ?? null,
            matchedClauses: matchedClauses.map((clause) => ({
              id: clause.id,
              sourceField: clause.source_field,
              chunkText: clause.chunk_text,
              similarity: clause.similarity,
            })),
          }),
        },
      ],
      max_completion_tokens: 1500,
      temperature: 0.3,
    });

    const message = aiResponse.choices[0]?.message;
    const refusal = message && "refusal" in message ? message.refusal : null;
    const content = message?.content;

    if (refusal) {
      throw new Error(`AI refused the request: ${refusal}`);
    }

    if (!content) {
      throw new Error("AI response parsing failed.");
    }

    const jsonResult = JSON.parse(content) as unknown;
    const parsedAiResult = aiAnalysisResultSchema.parse(jsonResult);
    const retrievedIds = new Set(matchedClauses.map((clause) => clause.id));
    const matchedClauseIds = parsedAiResult.matched_clause_ids.filter((id) =>
      retrievedIds.has(id),
    );
    const aiResult = {
      ...parsedAiResult,
      matched_clause_ids: matchedClauseIds,
    } satisfies AIAnalysisResult;
    const tokensInput =
      (aiResponse.usage?.prompt_tokens ?? 0) + requestEmbedding.tokenCount;
    const tokensOutput = aiResponse.usage?.completion_tokens ?? 0;

    const { data: newScopeCheck, error: insertCheckError } = await supabase
      .from("scope_checks")
      .insert({
        user_id: user.id,
        project_id: parsed.data.project_id,
        client_request: parsed.data.client_request,
        urgency: parsed.data.urgency ?? null,
        client_tone: parsed.data.client_tone ?? null,
        extra_notes: parsed.data.extra_notes ?? null,
        scope_status: aiResult.scope_status,
        risk_level: aiResult.risk_level,
        estimated_hours_min: aiResult.estimated_hours_min,
        estimated_hours_max: aiResult.estimated_hours_max,
        ai_reason: aiResult.ai_reason,
        suggested_action: aiResult.suggested_action,
        professional_reply: aiResult.professional_reply,
        change_request_summary: aiResult.change_request_summary,
        matched_clauses: matchedClauses,
        matched_clause_ids: aiResult.matched_clause_ids,
        ai_raw_response: jsonResult,
        model_used: MODEL_USED,
        embedding_model: requestEmbedding.model,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        credits_used: CREDITS_PER_CHECK,
      })
      .select()
      .single();

    if (insertCheckError || !newScopeCheck) {
      throw insertCheckError ?? new Error("Scope check insert failed");
    }

    const { error: insertUsageError } = await supabase
      .from("usage_logs")
      .insert({
        user_id: user.id,
        action: "scope_check",
        credits_used: CREDITS_PER_CHECK,
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        model: MODEL_USED,
        project_id: parsed.data.project_id,
        check_id: String(newScopeCheck.id),
      });

    if (insertUsageError) {
      console.error("Usage log insert failed", insertUsageError);
    }

    if (analysisRequestId) {
      await updateAnalysisRequest(analysisRequestId, {
        status: "completed",
        scopeCheckId: String(newScopeCheck.id),
      });
    }

    logInfo("analysis.completed", {
      userId: user.id,
      projectId: project.id,
      scopeCheckId: String(newScopeCheck.id),
      tokensInput,
      tokensOutput,
      credits: CREDITS_PER_CHECK,
    });

    return NextResponse.json(newScopeCheck, { status: 200 });
  } catch (caughtError) {
    const message = errorMessage(caughtError);
    logError("analysis.failed", {
      userId: user.id,
      projectId: project.id,
      analysisRequestId,
      error: message,
    });
    if (creditsConsumed) {
      await refundCredits(user.id);
    }

    if (analysisRequestId) {
      await updateAnalysisRequest(analysisRequestId, {
        status: "failed",
        error: message,
      });
    }

    if (isOpenAIAuthError(caughtError)) {
      return NextResponse.json(
        {
          error:
            "OpenAI authentication failed. Your credits were refunded. Check OPENAI_API_KEY.",
          details: message,
        },
        { status: 503 },
      );
    }

    if (isOpenAIRetryableError(caughtError)) {
      return NextResponse.json(
        {
          error:
            "Could not connect to OpenAI. Your credits were refunded. Check your network connection and try again.",
          details: message,
        },
        { status: 503 },
      );
    }

    if (caughtError instanceof NoRelevantChunksError) {
      return NextResponse.json(
        {
          error:
            "No relevant locked-scope clauses were found. Your credits were refunded.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { error: "AI analysis failed. Your credits were refunded." },
      { status: 500 },
    );
  }
}
