export type ScopeStatus = "in_scope" | "out_of_scope" | "needs_clarification";
export type RiskLevel = "low" | "medium" | "high";
export type ProjectStatus = "active" | "completed" | "archived";
export type ChangeRequestStatus =
  | "draft"
  | "sent"
  | "approved"
  | "rejected"
  | "paid";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  credits_balance: number;
  credits_reset_at: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  client_name: string | null;
  original_scope: string;
  deliverables: string | null;
  exclusions: string | null;
  revision_limit: number | null;
  hourly_rate: number | null;
  status: ProjectStatus;
  scope_locked: boolean;
  locked_at: string | null;
  scope_embedding_model: string | null;
  scope_chunks_count: number;
  created_at: string;
  updated_at: string;
}

export interface MatchedClause {
  id: string;
  source_field: string;
  chunk_text: string;
  similarity: number;
}

export interface ScopeCheck {
  id: string;
  user_id: string;
  project_id: string;
  client_request: string;
  urgency: "low" | "medium" | "high" | null;
  client_tone: "friendly" | "neutral" | "pushy" | "aggressive" | null;
  extra_notes: string | null;
  scope_status: ScopeStatus | null;
  risk_level: RiskLevel | null;
  estimated_hours_min: number | null;
  estimated_hours_max: number | null;
  ai_reason: string | null;
  suggested_action: string | null;
  professional_reply: string | null;
  change_request_summary: string | null;
  matched_clauses: MatchedClause[];
  matched_clause_ids: string[];
  tokens_input: number | null;
  tokens_output: number | null;
  credits_used: number;
  created_at: string;
}

export interface ChangeRequest {
  id: string;
  user_id: string;
  project_id: string;
  scope_check_id: string | null;
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
  public_share_token: string;
  client_response_note: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIAnalysisResult {
  scope_status: ScopeStatus;
  risk_level: RiskLevel;
  estimated_hours_min: number;
  estimated_hours_max: number;
  ai_reason: string;
  suggested_action: string;
  professional_reply: string;
  change_request_summary: string;
  matched_clause_ids: string[];
}
