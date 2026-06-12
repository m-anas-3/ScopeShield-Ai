import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getOwnedChangeRequestDetail } from "@/lib/change-requests/queries";
import type { ChangeRequestFormValues } from "@/lib/validations/change-request";
import { ChangeRequestForm } from "@/components/change-requests/ChangeRequestForm";

interface EditChangeRequestPageProps {
  params: {
    id: string;
  };
}

function numberToField(value: number | null) {
  return value === null ? "" : String(value);
}

export default async function EditChangeRequestPage({
  params,
}: EditChangeRequestPageProps) {
  const detail = await getOwnedChangeRequestDetail(params.id);

  if (!detail) {
    notFound();
  }

  if (
    detail.changeRequest.status === "approved" ||
    detail.changeRequest.status === "rejected" ||
    detail.changeRequest.status === "paid"
  ) {
    redirect(`/change-requests/${detail.changeRequest.id}`);
  }

  const initialValues: ChangeRequestFormValues = {
    project_id: detail.changeRequest.project_id,
    scope_check_id: detail.changeRequest.scope_check_id ?? "",
    title: detail.changeRequest.title,
    summary: detail.changeRequest.summary,
    client_message: detail.changeRequest.client_message ?? "",
    estimated_hours_min: numberToField(
      detail.changeRequest.estimated_hours_min,
    ),
    estimated_hours_max: numberToField(
      detail.changeRequest.estimated_hours_max,
    ),
    hourly_rate_snapshot: numberToField(
      detail.changeRequest.hourly_rate_snapshot,
    ),
    fixed_price: numberToField(detail.changeRequest.fixed_price),
    estimated_total: numberToField(detail.changeRequest.estimated_total),
    currency: detail.changeRequest.currency,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={`/change-requests/${detail.changeRequest.id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#534AB7] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Change Request
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-normal text-slate-950">
          Edit Change Request
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {detail.project.name}
          {detail.project.client_name ? ` · ${detail.project.client_name}` : ""}
        </p>
      </div>
      <ChangeRequestForm
        mode="edit"
        changeRequestId={detail.changeRequest.id}
        initialValues={initialValues}
        cancelHref={`/change-requests/${detail.changeRequest.id}`}
      />
    </div>
  );
}
