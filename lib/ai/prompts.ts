export interface AnalysisPromptParams {
  projectName: string;
  clientName: string | null;
  revisionLimit: number | null;
  hourlyRate: number | null;
  clientRequest: string;
  urgency: string | null;
  clientTone: string | null;
  extraNotes: string | null;
  matchedClauses: Array<{
    id: string;
    sourceField: string;
    chunkText: string;
    similarity: number;
  }>;
}

export function buildAnalysisPrompt(params: AnalysisPromptParams): string {
  const matchedClauses =
    params.matchedClauses.length > 0
      ? params.matchedClauses
          .map(
            (clause, index) =>
              `[${index + 1}] id=${clause.id} source=${clause.sourceField} similarity=${clause.similarity.toFixed(3)}\n${clause.chunkText}`,
          )
          .join("\n\n")
      : "No relevant locked-scope clauses were retrieved.";

  return `You are a scope management assistant for freelancers and agencies.
Analyze whether a client request falls within the agreed project scope.

PROJECT: ${params.projectName} | CLIENT: ${params.clientName ?? "Not specified"}
REVISION LIMIT: ${params.revisionLimit ? `${params.revisionLimit} revisions` : "Not specified"}
HOURLY RATE: ${params.hourlyRate ? `$${params.hourlyRate}/hr` : "Not specified"}

RETRIEVED LOCKED-SCOPE CLAUSES:
${matchedClauses}

CLIENT REQUEST:
"${params.clientRequest}"

URGENCY: ${params.urgency ?? "not specified"}
CLIENT TONE: ${params.clientTone ?? "not specified"}
ADDITIONAL NOTES: ${params.extraNotes ?? "none"}

Rules:
- Use only the retrieved locked-scope clauses as contractual evidence.
- Do not rely on unstated project assumptions or invent missing contract terms.
- Reference exact clause wording where possible.
- Put only retrieved clause ids in matched_clause_ids.
- If no retrieved clause is relevant enough to decide, use "needs_clarification".
- Hours must be realistic. Use 0 to 0 only when the request is clearly in scope.
- Risk: low=small change, medium=new feature, high=major addition or deadline risk.
- The professional reply must be a complete polite email with at least 3 sentences.`;
}
