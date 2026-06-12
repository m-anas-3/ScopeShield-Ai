import { notFound } from "next/navigation";

import { getOwnedChangeRequestDetail } from "@/lib/change-requests/queries";
import { ChangeRequestReport } from "@/components/change-requests/ChangeRequestReport";

interface OwnerChangeRequestReportPageProps {
  params: {
    id: string;
  };
}

export default async function OwnerChangeRequestReportPage({
  params,
}: OwnerChangeRequestReportPageProps) {
  const detail = await getOwnedChangeRequestDetail(params.id);

  if (!detail) {
    notFound();
  }

  return (
    <ChangeRequestReport
      backHref={`/change-requests/${detail.changeRequest.id}`}
      data={{
        id: detail.changeRequest.id,
        title: detail.changeRequest.title,
        summary: detail.changeRequest.summary,
        client_message:
          detail.changeRequest.client_message ?? detail.check?.client_request ?? null,
        estimated_hours_min: detail.changeRequest.estimated_hours_min,
        estimated_hours_max: detail.changeRequest.estimated_hours_max,
        hourly_rate_snapshot: detail.changeRequest.hourly_rate_snapshot,
        fixed_price: detail.changeRequest.fixed_price,
        estimated_total: detail.changeRequest.estimated_total,
        currency: detail.changeRequest.currency,
        status: detail.changeRequest.status,
        client_response_note: detail.changeRequest.client_response_note,
        approved_at: detail.changeRequest.approved_at,
        rejected_at: detail.changeRequest.rejected_at,
        paid_at: detail.changeRequest.paid_at,
        created_at: detail.changeRequest.created_at,
        project_name: detail.project.name,
        client_name: detail.project.client_name,
        scope_status: detail.check?.scope_status ?? null,
        risk_level: detail.check?.risk_level ?? null,
        ai_reason: detail.check?.ai_reason ?? null,
        matched_clauses: detail.check?.matched_clauses ?? [],
        matched_clause_ids: detail.check?.matched_clause_ids ?? [],
      }}
    />
  );
}
