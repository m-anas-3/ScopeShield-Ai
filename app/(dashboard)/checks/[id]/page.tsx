import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { RiskLevel, ScopeCheck, ScopeStatus } from "@/types";
import { ResultCard } from "@/components/checks/ResultCard";

interface CheckResultPageProps {
  params: {
    id: string;
  };
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
        "id, user_id, project_id, client_request, urgency, client_tone, extra_notes, scope_status, risk_level, estimated_hours_min, estimated_hours_max, ai_reason, suggested_action, professional_reply, change_request_summary, tokens_input, tokens_output, credits_used, created_at",
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href={`/projects/${check.project_id}`}
          className="text-sm font-medium text-[#534AB7] hover:underline"
        >
          ← Back to Project
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-normal text-slate-950">
          Scope Check Result
        </h1>
      </div>
      <ResultCard check={check} />
    </div>
  );
}
