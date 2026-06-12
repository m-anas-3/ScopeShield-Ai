import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import {
  changeRequestAmountLabel,
  formatHoursRange,
  sourceLabel,
} from "@/lib/change-requests/format";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  ChangeRequestStatus,
  MatchedClause,
  RiskLevel,
  ScopeStatus,
} from "@/types";
import { ChangeRequestStatusBadge } from "@/components/change-requests/ChangeRequestStatusBadge";
import { PrintButton } from "@/components/change-requests/PrintButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ChangeRequestReportData {
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
  project_name: string;
  client_name: string | null;
  scope_status: ScopeStatus | null;
  risk_level: RiskLevel | null;
  ai_reason: string | null;
  matched_clauses: MatchedClause[];
  matched_clause_ids: string[];
}

function scopeStatusLabel(status: ScopeStatus | null) {
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

function scopeStatusClassName(status: ScopeStatus | null) {
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

function riskClassName(risk: RiskLevel | null) {
  switch (risk) {
    case "low":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "medium":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "high":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="border-b border-slate-200 py-3 last:border-b-0">
      <dt className="text-xs font-medium uppercase tracking-normal text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-950">{value}</dd>
    </div>
  );
}

export function ChangeRequestReport({
  data,
  backHref,
}: {
  data: ChangeRequestReportData;
  backHref?: string;
}) {
  const amountLabel = changeRequestAmountLabel({
    fixed_price: data.fixed_price,
    estimated_total: data.estimated_total,
    currency: data.currency,
  });

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="print-hidden border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {backHref ? (
              <Button asChild variant="outline" size="sm">
                <Link href={backHref}>
                  <ArrowLeft />
                  Back
                </Link>
              </Button>
            ) : null}
          </div>
          <PrintButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 print-report">
        <section className="border-b border-slate-300 pb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#534AB7]">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#534AB7] text-white">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                ScopeShield AI
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-normal">
                {data.title}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {data.project_name}
                {data.client_name ? ` · ${data.client_name}` : ""}
              </p>
            </div>
            <div className="space-y-2 text-left sm:text-right">
              <ChangeRequestStatusBadge status={data.status} />
              <p className="text-sm text-slate-600">
                Prepared {formatDate(data.created_at)}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-8">
            <div>
              <h2 className="text-base font-semibold">Proposed Extra Work</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {data.summary}
              </p>
            </div>

            {data.client_message ? (
              <div>
                <h2 className="text-base font-semibold">
                  Original Client Request
                </h2>
                <p className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {data.client_message}
                </p>
              </div>
            ) : null}

            {data.scope_status ? (
              <div>
                <h2 className="text-base font-semibold">Scope Assessment</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className={scopeStatusClassName(data.scope_status)}>
                    {scopeStatusLabel(data.scope_status)}
                  </Badge>
                  <Badge className={riskClassName(data.risk_level)}>
                    {data.risk_level ? `${data.risk_level} risk` : "Risk not set"}
                  </Badge>
                </div>
                {data.ai_reason ? (
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {data.ai_reason}
                  </p>
                ) : null}
              </div>
            ) : null}

            {data.matched_clauses.length > 0 ? (
              <div>
                <h2 className="text-base font-semibold">
                  Matched Scope Evidence
                </h2>
                <div className="mt-3 space-y-3">
                  {data.matched_clauses.map((clause) => {
                    const referenced = data.matched_clause_ids.includes(
                      clause.id,
                    );

                    return (
                      <div
                        key={clause.id}
                        className="rounded-lg border border-slate-200 p-4"
                      >
                        <div className="mb-2 flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            {sourceLabel(clause.source_field)}
                          </Badge>
                          <Badge variant="outline">
                            {Math.round(clause.similarity * 100)}% match
                          </Badge>
                          {referenced ? (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                              Referenced
                            </Badge>
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {clause.chunk_text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <aside>
            <dl className="rounded-lg border border-slate-200 p-4">
              <DetailItem label="Hours" value={formatHoursRange(data)} />
              <DetailItem
                label="Hourly Rate"
                value={formatCurrency(data.hourly_rate_snapshot, data.currency)}
              />
              <DetailItem label="Total" value={amountLabel} />
              <DetailItem label="Currency" value={data.currency} />
              <DetailItem label="Status" value={<ChangeRequestStatusBadge status={data.status} />} />
              {data.approved_at ? (
                <DetailItem
                  label="Approved"
                  value={formatDate(data.approved_at)}
                />
              ) : null}
              {data.rejected_at ? (
                <DetailItem
                  label="Rejected"
                  value={formatDate(data.rejected_at)}
                />
              ) : null}
              {data.paid_at ? (
                <DetailItem label="Paid" value={formatDate(data.paid_at)} />
              ) : null}
            </dl>
            {data.client_response_note ? (
              <div className="mt-4 rounded-lg border border-slate-200 p-4">
                <h2 className="text-sm font-semibold">Client Note</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {data.client_response_note}
                </p>
              </div>
            ) : null}
          </aside>
        </section>
      </main>
    </div>
  );
}
