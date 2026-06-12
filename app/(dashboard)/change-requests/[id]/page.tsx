import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  Pencil,
  Printer,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";

import {
  changeRequestAmountLabel,
  changeRequestReportPath,
  changeRequestSharePath,
  formatHoursRange,
  sourceLabel,
} from "@/lib/change-requests/format";
import { getOwnedChangeRequestDetail } from "@/lib/change-requests/queries";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ChangeRequestStatusActions } from "@/components/change-requests/ChangeRequestStatusActions";
import { ChangeRequestStatusBadge } from "@/components/change-requests/ChangeRequestStatusBadge";
import { ShareLinkButton } from "@/components/change-requests/ShareLinkButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ChangeRequestDetailPageProps {
  params: {
    id: string;
  };
}

function scopeStatusLabel(status: string | null) {
  switch (status) {
    case "in_scope":
      return "In Scope";
    case "out_of_scope":
      return "Out of Scope";
    case "needs_clarification":
      return "Needs Clarification";
    default:
      return "Not linked";
  }
}

function scopeStatusClassName(status: string | null) {
  switch (status) {
    case "in_scope":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "out_of_scope":
      return "border-red-200 bg-red-50 text-red-700";
    case "needs_clarification":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default async function ChangeRequestDetailPage({
  params,
}: ChangeRequestDetailPageProps) {
  const detail = await getOwnedChangeRequestDetail(params.id);

  if (!detail) {
    notFound();
  }

  const { changeRequest, project, check } = detail;
  const canEdit =
    changeRequest.status === "draft" || changeRequest.status === "sent";
  const sharePath = changeRequestSharePath(changeRequest.public_share_token);
  const reportPath = changeRequestReportPath(changeRequest.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/change-requests"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-[#534AB7] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Change Requests
          </Link>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <ChangeRequestStatusBadge status={changeRequest.status} />
            <span className="text-sm text-muted-foreground">
              Created {formatDate(changeRequest.created_at)}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-normal text-slate-950">
            {changeRequest.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.name}
            {project.client_name ? ` · ${project.client_name}` : ""}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          {canEdit ? (
            <Button asChild variant="outline">
              <Link href={`/change-requests/${changeRequest.id}/edit`}>
                <Pencil />
                Edit
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={reportPath}>
              <Printer />
              Report
            </Link>
          </Button>
          <ShareLinkButton sharePath={sharePath} />
          <ChangeRequestStatusActions
            changeRequestId={changeRequest.id}
            status={changeRequest.status}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-slate-700" />
                <CardTitle>Proposed Extra Work</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {changeRequest.summary}
              </p>
            </CardContent>
          </Card>

          {changeRequest.client_message ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-700" />
                  <CardTitle>Original Client Request</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {changeRequest.client_message}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {check ? (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-slate-700" />
                  <CardTitle>Linked Scope Check</CardTitle>
                </div>
                <CardDescription>
                  Evidence carried into the client-ready report.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Badge className={scopeStatusClassName(check.scope_status)}>
                    {scopeStatusLabel(check.scope_status)}
                  </Badge>
                  <Badge className="capitalize" variant="outline">
                    {check.risk_level ?? "unknown"} risk
                  </Badge>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/checks/${check.id}`}>Open Check</Link>
                  </Button>
                </div>
                {check.ai_reason ? (
                  <p className="text-sm leading-6 text-slate-700">
                    {check.ai_reason}
                  </p>
                ) : null}
                {check.matched_clauses.length > 0 ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {check.matched_clauses.map((clause) => (
                      <div
                        key={clause.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="mb-2 flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            {sourceLabel(clause.source_field)}
                          </Badge>
                          <Badge variant="outline" className="bg-white">
                            {Math.round(clause.similarity * 100)}% match
                          </Badge>
                        </div>
                        <p className="line-clamp-4 text-sm leading-6 text-slate-700">
                          {clause.chunk_text}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Commercial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Hours</span>
                <span className="font-medium text-slate-950">
                  {formatHoursRange(changeRequest)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Hourly rate</span>
                <span className="font-medium text-slate-950">
                  {formatCurrency(
                    changeRequest.hourly_rate_snapshot,
                    changeRequest.currency,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-semibold text-slate-950">
                  {changeRequestAmountLabel(changeRequest)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Currency</span>
                <span className="font-medium text-slate-950">
                  {changeRequest.currency}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Response</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <ChangeRequestStatusBadge status={changeRequest.status} />
              </div>
              {changeRequest.approved_at ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Approved</span>
                  <span className="font-medium text-slate-950">
                    {formatDate(changeRequest.approved_at)}
                  </span>
                </div>
              ) : null}
              {changeRequest.rejected_at ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Rejected</span>
                  <span className="font-medium text-slate-950">
                    {formatDate(changeRequest.rejected_at)}
                  </span>
                </div>
              ) : null}
              {changeRequest.paid_at ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-slate-950">
                    {formatDate(changeRequest.paid_at)}
                  </span>
                </div>
              ) : null}
              {changeRequest.client_response_note ? (
                <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 leading-6 text-slate-700">
                  {changeRequest.client_response_note}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
