export interface AnalysisPromptParams {
  projectName: string;
  clientName: string | null;
  originalScope: string;
  deliverables: string | null;
  exclusions: string | null;
  revisionLimit: number | null;
  hourlyRate: number | null;
  clientRequest: string;
  urgency: string | null;
  clientTone: string | null;
  extraNotes: string | null;
}

export function buildAnalysisPrompt(params: AnalysisPromptParams): string {
  return `You are a scope management assistant for freelancers and agencies.
Analyze whether a client request falls within the agreed project scope.

PROJECT: ${params.projectName} | CLIENT: ${params.clientName ?? "Not specified"}
ORIGINAL SCOPE: ${params.originalScope}
DELIVERABLES: ${params.deliverables ?? "Not specified"}
EXCLUSIONS: ${params.exclusions ?? "None specified"}
REVISION LIMIT: ${params.revisionLimit ? `${params.revisionLimit} revisions` : "Not specified"}
HOURLY RATE: ${params.hourlyRate ? `$${params.hourlyRate}/hr` : "Not specified"}

CLIENT REQUEST:
"${params.clientRequest}"

URGENCY: ${params.urgency ?? "not specified"}
CLIENT TONE: ${params.clientTone ?? "not specified"}
ADDITIONAL NOTES: ${params.extraNotes ?? "none"}

Return ONLY valid JSON — no markdown, no text outside the JSON:
{
  "scope_status": "in_scope" | "out_of_scope" | "needs_clarification",
  "risk_level": "low" | "medium" | "high",
  "estimated_hours_min": number (0 if in_scope),
  "estimated_hours_max": number (0 if in_scope),
  "ai_reason": "2-3 sentences referencing specific scope items",
  "suggested_action": "One clear action for the freelancer",
  "professional_reply": "Complete polite email. If out_of_scope: diplomatic + mention change order. If in_scope: warm confirmation. If needs_clarification: friendly question. Never robotic. Min 3 sentences.",
  "change_request_summary": "Formal summary if out_of_scope, else empty string"
}
Rules: reference exact scope clauses. Hours must be realistic.
Risk: low=small change, medium=new feature, high=major addition or deadline risk.`;
}
