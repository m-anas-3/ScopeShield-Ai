import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  parseMatchedClauses,
  parseStringArray,
} from "@/lib/change-requests/format";
import type {
  ChangeRequest,
  ChangeRequestStatus,
  MatchedClause,
  ProjectStatus,
  RiskLevel,
  ScopeStatus,
} from "@/types";

export interface ChangeRequestProject {
  id: string;
  name: string;
  client_name: string | null;
  hourly_rate: number | null;
  status?: ProjectStatus;
}

export interface ChangeRequestCheck {
  id: string;
  client_request: string;
  scope_status: ScopeStatus | null;
  risk_level: RiskLevel | null;
  ai_reason: string | null;
  suggested_action: string | null;
  professional_reply: string | null;
  change_request_summary: string | null;
  matched_clauses: MatchedClause[];
  matched_clause_ids: string[];
  created_at: string;
}

export interface ChangeRequestDetail {
  changeRequest: ChangeRequest;
  project: ChangeRequestProject;
  check: ChangeRequestCheck | null;
}

export interface PublicChangeRequestDetail {
  id: string;
  title: string;
  summary: string;
  client_message: string | null;
  estimated_hours_min: number | null;
  estimated_hours_max: number | null;
  hourly_rate_snapshot: number | null;
  fixed_price: number | null;
  estimated_total: number | null;
  currency: string;
  status: ChangeRequestStatus;
  client_response_note: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  project_name: string;
  client_name: string | null;
  scope_status: ScopeStatus | null;
  risk_level: RiskLevel | null;
  ai_reason: string | null;
  matched_clauses: MatchedClause[];
  matched_clause_ids: string[];
}

const changeRequestColumns =
  "id, user_id, project_id, scope_check_id, title, summary, client_message, estimated_hours_min, estimated_hours_max, hourly_rate_snapshot, fixed_price, estimated_total, currency, status, public_share_token, client_response_note, approved_at, rejected_at, paid_at, created_at, updated_at";

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function nullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

export function toChangeRequest(row: Record<string, unknown>): ChangeRequest {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    project_id: String(row.project_id),
    scope_check_id: nullableString(row.scope_check_id),
    title: String(row.title),
    summary: String(row.summary),
    client_message: nullableString(row.client_message),
    estimated_hours_min: nullableNumber(row.estimated_hours_min),
    estimated_hours_max: nullableNumber(row.estimated_hours_max),
    hourly_rate_snapshot: nullableNumber(row.hourly_rate_snapshot),
    fixed_price: nullableNumber(row.fixed_price),
    estimated_total: nullableNumber(row.estimated_total),
    currency: String(row.currency ?? "USD"),
    status: (row.status ?? "draft") as ChangeRequestStatus,
    public_share_token: String(row.public_share_token),
    client_response_note: nullableString(row.client_response_note),
    approved_at: nullableString(row.approved_at),
    rejected_at: nullableString(row.rejected_at),
    paid_at: nullableString(row.paid_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function toProject(row: Record<string, unknown>): ChangeRequestProject {
  return {
    id: String(row.id),
    name: String(row.name ?? "Untitled project"),
    client_name: nullableString(row.client_name),
    hourly_rate: nullableNumber(row.hourly_rate),
    status: row.status ? (row.status as ProjectStatus) : undefined,
  };
}

function toCheck(row: Record<string, unknown>): ChangeRequestCheck {
  return {
    id: String(row.id),
    client_request: String(row.client_request ?? ""),
    scope_status: (row.scope_status ?? null) as ScopeStatus | null,
    risk_level: (row.risk_level ?? null) as RiskLevel | null,
    ai_reason: nullableString(row.ai_reason),
    suggested_action: nullableString(row.suggested_action),
    professional_reply: nullableString(row.professional_reply),
    change_request_summary: nullableString(row.change_request_summary),
    matched_clauses: parseMatchedClauses(row.matched_clauses),
    matched_clause_ids: parseStringArray(row.matched_clause_ids),
    created_at: String(row.created_at),
  };
}

async function getCurrentUserId(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function getOwnedChangeRequestDetail(
  changeRequestId: string,
): Promise<ChangeRequestDetail | null> {
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId(supabase);

    if (!userId) {
      return null;
    }

    const { data: changeRequestData, error: changeRequestError } =
      await supabase
        .from("change_requests")
        .select(changeRequestColumns)
        .eq("id", changeRequestId)
        .eq("user_id", userId)
        .single();

    if (changeRequestError || !changeRequestData) {
      console.error("Change request lookup failed", changeRequestError);
      return null;
    }

    const changeRequest = toChangeRequest(
      changeRequestData as Record<string, unknown>,
    );

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select("id, name, client_name, hourly_rate, status")
      .eq("id", changeRequest.project_id)
      .eq("user_id", userId)
      .single();

    if (projectError || !projectData) {
      console.error("Change request project lookup failed", projectError);
      return null;
    }

    let check: ChangeRequestCheck | null = null;

    if (changeRequest.scope_check_id) {
      const { data: checkData, error: checkError } = await supabase
        .from("scope_checks")
        .select(
          "id, client_request, scope_status, risk_level, ai_reason, suggested_action, professional_reply, change_request_summary, matched_clauses, matched_clause_ids, created_at",
        )
        .eq("id", changeRequest.scope_check_id)
        .eq("user_id", userId)
        .single();

      if (!checkError && checkData) {
        check = toCheck(checkData as Record<string, unknown>);
      }
    }

    return {
      changeRequest,
      project: toProject(projectData as Record<string, unknown>),
      check,
    };
  } catch (error) {
    console.error("Change request lookup failed", error);
    return null;
  }
}

export async function getChangeRequestForCheck(checkId: string) {
  try {
    const supabase = createClient();
    const userId = await getCurrentUserId(supabase);

    if (!userId) {
      return null;
    }

    const { data, error } = await supabase
      .from("change_requests")
      .select("id, title, status")
      .eq("scope_check_id", checkId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as Record<string, unknown>;

    return {
      id: String(row.id),
      title: String(row.title),
      status: (row.status ?? "draft") as ChangeRequestStatus,
    };
  } catch (error) {
    console.error("Change request for check lookup failed", error);
    return null;
  }
}

export async function getPublicChangeRequestByToken(
  token: string,
): Promise<PublicChangeRequestDetail | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_shared_change_request", {
      p_token: token,
    });

    if (error || !data) {
      console.error("Shared change request lookup failed", error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return null;
    }

    const record = row as Record<string, unknown>;

    return {
      id: String(record.id),
      title: String(record.title),
      summary: String(record.summary),
      client_message: nullableString(record.client_message),
      estimated_hours_min: nullableNumber(record.estimated_hours_min),
      estimated_hours_max: nullableNumber(record.estimated_hours_max),
      hourly_rate_snapshot: nullableNumber(record.hourly_rate_snapshot),
      fixed_price: nullableNumber(record.fixed_price),
      estimated_total: nullableNumber(record.estimated_total),
      currency: String(record.currency ?? "USD"),
      status: (record.status ?? "draft") as ChangeRequestStatus,
      client_response_note: nullableString(record.client_response_note),
      approved_at: nullableString(record.approved_at),
      rejected_at: nullableString(record.rejected_at),
      paid_at: nullableString(record.paid_at),
      created_at: String(record.created_at),
      updated_at: String(record.updated_at),
      project_name: String(record.project_name ?? "Project"),
      client_name: nullableString(record.client_name),
      scope_status: (record.scope_status ?? null) as ScopeStatus | null,
      risk_level: (record.risk_level ?? null) as RiskLevel | null,
      ai_reason: nullableString(record.ai_reason),
      matched_clauses: parseMatchedClauses(record.matched_clauses),
      matched_clause_ids: parseStringArray(record.matched_clause_ids),
    };
  } catch (error) {
    console.error("Shared change request lookup failed", error);
    return null;
  }
}

export async function getProjectMap(projectIds: string[]) {
  const supabase = createClient();

  if (projectIds.length === 0) {
    return new Map<string, ChangeRequestProject>();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Map<string, ChangeRequestProject>();
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, client_name, hourly_rate, status")
    .eq("user_id", user.id)
    .in("id", projectIds);

  if (error || !data) {
    console.error("Project map lookup failed", error);
    return new Map<string, ChangeRequestProject>();
  }

  return new Map(
    data.map((row) => {
      const project = toProject(row as Record<string, unknown>);
      return [project.id, project];
    }),
  );
}
