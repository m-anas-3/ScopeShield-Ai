import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Printer, ShieldCheck } from "lucide-react";

import {
  changeRequestAmountLabel,
  formatHoursRange,
  sourceLabel,
} from "@/lib/change-requests/format";
import { getPublicChangeRequestByToken } from "@/lib/change-requests/queries";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ChangeRequestStatusBadge } from "@/components/change-requests/ChangeRequestStatusBadge";
import { PublicApprovalForm } from "@/components/change-requests/PublicApprovalForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PublicApprovalPageProps {
  params: {
    token: string;
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

export default async function PublicApprovalPage({
  params,
}: PublicApprovalPageProps) {
  const changeRequest = await getPublicChangeRequestByToken(params.token);

  if (!changeRequest) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#534AB7]">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#534AB7] text-white">
                <ShieldCheck className="h-5 w-5" />
              </span>
              ScopeShield AI
            </div>
            <h1 className="mt-5 text-3xl font-bold tracking-normal text-slate-950">
              {changeRequest.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {changeRequest.project_name}
              {changeRequest.client_name ? ` · ${changeRequest.client_name}` : ""}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <ChangeRequestStatusBadge status={changeRequest.status} />
            <Button asChild variant="outline">
              <Link href={`/approve/${params.token}/report`}>
                <Printer />
                Report
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Proposed Extra Work</CardTitle>
                <CardDescription>
                  Prepared {formatDate(changeRequest.created_at)}
                </CardDescription>
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
                    <CardTitle>Original Request</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {changeRequest.client_message}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {changeRequest.scope_status ? (
              <Card>
                <CardHeader>
                  <CardTitle>Scope Assessment</CardTitle>
                <CardDescription>
                    Based on the locked scope provided by the freelancer or
                    agency.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      className={scopeStatusClassName(
                        changeRequest.scope_status,
                      )}
                    >
                      {scopeStatusLabel(changeRequest.scope_status)}
                    </Badge>
                    <Badge className="capitalize" variant="outline">
                      {changeRequest.risk_level ?? "unknown"} risk
                    </Badge>
                  </div>
                  {changeRequest.ai_reason ? (
                    <p className="text-sm leading-6 text-slate-700">
                      {changeRequest.ai_reason}
                    </p>
                  ) : null}
                  {changeRequest.matched_clauses.length > 0 ? (
                    <div className="grid gap-3">
                      {changeRequest.matched_clauses.map((clause) => (
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
                          <p className="text-sm leading-6 text-slate-700">
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

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approval Summary</CardTitle>
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
                  <span className="text-muted-foreground">Status</span>
                  <ChangeRequestStatusBadge status={changeRequest.status} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Client Response</CardTitle>
                <CardDescription>
                  Approve or reject this change request.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PublicApprovalForm
                  token={params.token}
                  status={changeRequest.status}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
