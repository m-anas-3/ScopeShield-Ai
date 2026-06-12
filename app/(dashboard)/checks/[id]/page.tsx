import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getChangeRequestForCheck } from "@/lib/change-requests/queries";
import { createClient } from "@/lib/supabase/server";
import type { MatchedClause, RiskLevel, ScopeCheck, ScopeStatus } from "@/types";
import { ResultCard } from "@/components/checks/ResultCard";

interface CheckResultPageProps {
  params: {
    id: string;
  };
}

function parseMatchedClauses(value: unknown): MatchedClause[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = record.id;
      const sourceField = record.source_field;
      const chunkText = record.chunk_text;
      const similarity = record.similarity;

      if (
        typeof id !== "string" ||
        typeof sourceField !== "string" ||
        typeof chunkText !== "string"
      ) {
        return null;
      }

      return {
        id,
        source_field: sourceField,
        chunk_text: chunkText,
        similarity:
          typeof similarity === "number" && Number.isFinite(similarity)
            ? similarity
            : 0,
      };
    })
    .filter((item): item is MatchedClause => item !== null);
}

function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

async function getScopeCheck(checkId: string): Promise<ScopeCheck | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data, error } = await supabase
      .from("scope_checks")
      .select(
        "id, user_id, project_id, client_request, urgency, client_tone, extra_notes, scope_status, risk_level, estimated_hours_min, estimated_hours_max, ai_reason, suggested_action, professional_reply, change_request_summary, matched_clauses, matched_clause_ids, tokens_input, tokens_output, credits_used, created_at",
      )
      .eq("id", checkId)
      .single();

    if (error || !data || String(data.user_id) !== user.id) {
      console.error("Scope check lookup failed", error);
      return null;
    }

    return {
      id: String(data.id),
      user_id: String(data.user_id),
      project_id: String(data.project_id),
      client_request: String(data.client_request),
      urgency: data.urgency as ScopeCheck["urgency"],
      client_tone: data.client_tone as ScopeCheck["client_tone"],
      extra_notes: data.extra_notes ? String(data.extra_notes) : null,
      scope_status: data.scope_status as ScopeStatus | null,
      risk_level: data.risk_level as RiskLevel | null,
      estimated_hours_min:
        data.estimated_hours_min === null
          ? null
          : Number(data.estimated_hours_min),
      estimated_hours_max:
        data.estimated_hours_max === null
          ? null
          : Number(data.estimated_hours_max),
      ai_reason: data.ai_reason ? String(data.ai_reason) : null,
      suggested_action: data.suggested_action
        ? String(data.suggested_action)
        : null,
      professional_reply: data.professional_reply
        ? String(data.professional_reply)
        : null,
      change_request_summary: data.change_request_summary
        ? String(data.change_request_summary)
        : null,
      matched_clauses: parseMatchedClauses(data.matched_clauses),
      matched_clause_ids: parseStringArray(data.matched_clause_ids),
      tokens_input: data.tokens_input === null ? null : Number(data.tokens_input),
      tokens_output:
        data.tokens_output === null ? null : Number(data.tokens_output),
      credits_used: Number(data.credits_used ?? 8),
      created_at: String(data.created_at),
    };
  } catch (error) {
    console.error("Scope check lookup failed", error);
    return null;
  }
}

export default async function CheckResultPage({ params }: CheckResultPageProps) {
  const check = await getScopeCheck(params.id);

  if (!check) {
    redirect("/dashboard");
  }

  const changeRequest =
    check.scope_status === "out_of_scope"
      ? await getChangeRequestForCheck(check.id)
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-slate-950">
            Scope Check Result
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the verdict, matched clauses, and suggested client response.
          </p>
        </div>
        <Link
          href={`/projects/${check.project_id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#534AB7] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </Link>
      </div>
      <ResultCard check={check} changeRequest={changeRequest} />
    </div>
  );
}
