import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

import openai from "@/lib/ai/openai";
import { buildAnalysisPrompt } from "@/lib/ai/prompts";
import { createClient } from "@/lib/supabase/server";
import { checkSchema } from "@/lib/validations/check";
import type { AIAnalysisResult } from "@/types";

const CREDITS_PER_CHECK = 8;
const MODEL_USED = "gpt-4o-mini";

const aiAnalysisResultSchema = z.object({
  scope_status: z.enum(["in_scope", "out_of_scope", "needs_clarification"]),
  risk_level: z.enum(["low", "medium", "high"]),
  estimated_hours_min: z.number(),
  estimated_hours_max: z.number(),
  ai_reason: z.string(),
  suggested_action: z.string(),
  professional_reply: z.string(),
  change_request_summary: z.string(),
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
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isOpenAIConnectionError(error: unknown) {
  return error instanceof OpenAI.APIConnectionError;
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
    })
    .safeParse(value);

  return parsed.success ? parsed.data : null;
}

async function refundCredits(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("credits_balance")
    .eq("id", userId)
    .single();

  const creditsBalance = Number(data?.credits_balance ?? 0);

  await supabase
    .from("profiles")
    .update({ credits_balance: creditsBalance + CREDITS_PER_CHECK })
    .eq("id", userId);
}

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("credits_balance")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const creditsBalance = Number(profile.credits_balance ?? 0);

  if (creditsBalance < CREDITS_PER_CHECK) {
    return NextResponse.json(
      {
        error: "Insufficient credits",
        credits_remaining: creditsBalance,
      },
      { status: 402 },
    );
  }

  const { error: deductError } = await supabase
    .from("profiles")
    .update({ credits_balance: creditsBalance - CREDITS_PER_CHECK })
    .eq("id", user.id);

  if (deductError) {
    return NextResponse.json(
      { error: "Credit deduction failed" },
      { status: 500 },
    );
  }

  try {
    const aiResponse = await openai.chat.completions.create({
      model: MODEL_USED,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: buildAnalysisPrompt({
            projectName: project.name,
            clientName: project.client_name,
            originalScope: project.original_scope,
            deliverables: project.deliverables,
            exclusions: project.exclusions,
            revisionLimit: project.revision_limit,
            hourlyRate: project.hourly_rate,
            clientRequest: parsed.data.client_request,
            urgency: parsed.data.urgency ?? null,
            clientTone: parsed.data.client_tone ?? null,
            extraNotes: parsed.data.extra_notes ?? null,
          }),
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const content = aiResponse.choices[0]?.message.content;

    if (!content) {
      await refundCredits(supabase, user.id);
      return NextResponse.json(
        { error: "AI response parsing failed" },
        { status: 500 },
      );
    }

    const jsonResult = JSON.parse(content) as unknown;
    const aiResult = aiAnalysisResultSchema.parse(jsonResult) satisfies AIAnalysisResult;
    const tokensInput = aiResponse.usage?.prompt_tokens ?? 0;
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
        ai_raw_response: jsonResult,
        model_used: MODEL_USED,
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
      throw insertUsageError;
    }

    return NextResponse.json(newScopeCheck, { status: 200 });
  } catch (caughtError) {
    const message = errorMessage(caughtError);
    console.error("Scope analysis failed", caughtError);
    await refundCredits(supabase, user.id);

    if (isOpenAIConnectionError(caughtError)) {
      return NextResponse.json(
        {
          error:
            "Could not connect to OpenAI. Your credits were refunded. Check your network connection and try again.",
          details: message,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "AI analysis failed. Your credits were refunded." },
      { status: 500 },
    );
  }
}
