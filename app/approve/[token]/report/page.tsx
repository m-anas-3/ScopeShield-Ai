import { notFound } from "next/navigation";

import { getPublicChangeRequestByToken } from "@/lib/change-requests/queries";
import { ChangeRequestReport } from "@/components/change-requests/ChangeRequestReport";

interface PublicChangeRequestReportPageProps {
  params: {
    token: string;
  };
}

export default async function PublicChangeRequestReportPage({
  params,
}: PublicChangeRequestReportPageProps) {
  const changeRequest = await getPublicChangeRequestByToken(params.token);

  if (!changeRequest) {
    notFound();
  }

  return (
    <ChangeRequestReport
      backHref={`/approve/${params.token}`}
      data={{
        id: changeRequest.id,
        title: changeRequest.title,
        summary: changeRequest.summary,
        client_message: changeRequest.client_message,
        estimated_hours_min: changeRequest.estimated_hours_min,
        estimated_hours_max: changeRequest.estimated_hours_max,
        hourly_rate_snapshot: changeRequest.hourly_rate_snapshot,
        fixed_price: changeRequest.fixed_price,
        estimated_total: changeRequest.estimated_total,
        currency: changeRequest.currency,
        status: changeRequest.status,
        client_response_note: changeRequest.client_response_note,
        approved_at: changeRequest.approved_at,
        rejected_at: changeRequest.rejected_at,
        paid_at: changeRequest.paid_at,
        created_at: changeRequest.created_at,
        project_name: changeRequest.project_name,
        client_name: changeRequest.client_name,
        scope_status: changeRequest.scope_status,
        risk_level: changeRequest.risk_level,
        ai_reason: changeRequest.ai_reason,
        matched_clauses: changeRequest.matched_clauses,
        matched_clause_ids: changeRequest.matched_clause_ids,
      }}
    />
  );
}
