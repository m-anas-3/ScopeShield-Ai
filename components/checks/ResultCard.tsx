"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Copy,
  FileSearch,
  MailCheck,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import type { ScopeCheck } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ResultCardProps {
  check: ScopeCheck;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const canCopy = text.trim().length > 0;

  async function handleCopy() {
    if (!canCopy) {
      return;
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleCopy}
      disabled={!canCopy}
    >
      <Copy />
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function statusMeta(status: ScopeCheck["scope_status"]) {
  switch (status) {
    case "in_scope":
      return {
        label: "In Scope",
        summary: "The request appears covered by the locked agreement.",
        icon: CheckCircle2,
        className: "border-emerald-200 bg-emerald-50 text-emerald-900",
        badgeClassName: "border-emerald-200 bg-white text-emerald-700",
      };
    case "out_of_scope":
      return {
        label: "Out of Scope",
        summary: "The request should be handled as extra or changed work.",
        icon: AlertTriangle,
        className: "border-red-200 bg-red-50 text-red-950",
        badgeClassName: "border-red-200 bg-white text-red-700",
      };
    case "needs_clarification":
      return {
        label: "Needs Clarification",
        summary: "The request needs more detail before scope can be confirmed.",
        icon: MessageSquareText,
        className: "border-amber-200 bg-amber-50 text-amber-950",
        badgeClassName: "border-amber-200 bg-white text-amber-700",
      };
    default:
      return {
        label: "Needs Review",
        summary: "Review the analysis before replying to the client.",
        icon: ShieldCheck,
        className: "border-gray-200 bg-gray-50 text-gray-900",
        badgeClassName: "border-gray-200 bg-white text-gray-700",
      };
  }
}

function scopeStatusLabel(status: ScopeCheck["scope_status"]) {
  switch (status) {
    case "in_scope":
      return "In Scope";
    case "out_of_scope":
      return "Out of Scope";
    case "needs_clarification":
      return "Needs Clarification";
    default:
      return "Unknown";
  }
}

function riskClassName(risk: ScopeCheck["risk_level"]) {
  switch (risk) {
    case "low":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "medium":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "high":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function extraHours(check: ScopeCheck) {
  const min = check.estimated_hours_min ?? 0;
  const max = check.estimated_hours_max ?? 0;

  if (min === 0 && max === 0) {
    return "No extra work";
  }

  return `${min}-${max} hrs`;
}

function sourceLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function ResultCard({ check }: ResultCardProps) {
  const verdict = statusMeta(check.scope_status);
  const VerdictIcon = verdict.icon;
  const professionalReply = check.professional_reply ?? "";
  const changeRequestSummary = check.change_request_summary ?? "";
  const matchedClauses = check.matched_clauses ?? [];

  return (
    <div className="space-y-6">
      <div className={`rounded-lg border p-6 ${verdict.className}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/80">
              <VerdictIcon className="h-6 w-6" />
            </span>
            <div>
              <Badge className={verdict.badgeClassName}>AI verdict</Badge>
              <h2 className="mt-3 text-3xl font-bold tracking-normal">
                {verdict.label}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6">
                {verdict.summary}
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-96">
            <div className="rounded-lg border border-white/60 bg-white/70 p-3">
              <p className="text-xs font-medium opacity-70">Risk</p>
              <Badge className={`mt-2 capitalize ${riskClassName(check.risk_level)}`}>
                {check.risk_level ?? "unknown"}
              </Badge>
            </div>
            <div className="rounded-lg border border-white/60 bg-white/70 p-3">
              <p className="text-xs font-medium opacity-70">Hours</p>
              <p className="mt-2 text-sm font-semibold">{extraHours(check)}</p>
            </div>
            <div className="rounded-lg border border-white/60 bg-white/70 p-3">
              <p className="text-xs font-medium opacity-70">Credits</p>
              <p className="mt-2 text-sm font-semibold">
                {check.credits_used} used
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Scope status",
            value: scopeStatusLabel(check.scope_status),
            icon: ShieldCheck,
          },
          {
            label: "Risk level",
            value: check.risk_level ?? "unknown",
            icon: AlertTriangle,
          },
          {
            label: "Extra hours",
            value: extraHours(check),
            icon: Clock3,
          },
          {
            label: "Credits used",
            value: `${check.credits_used} credits`,
            icon: WalletCards,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <item.icon className="h-4 w-4 text-[#534AB7]" />
                {item.label}
              </div>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-slate-700" />
              <CardTitle>Client Request</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {check.client_request}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-slate-700" />
              <CardTitle>Analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-700">
              {check.ai_reason ?? "No analysis was returned for this check."}
            </p>
          </CardContent>
        </Card>
      </div>

      {matchedClauses.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-slate-700" />
              <CardTitle>Matched Scope Clauses</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {matchedClauses.map((clause) => {
              const usedByAI = check.matched_clause_ids.includes(clause.id);

              return (
                <div
                  key={clause.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {sourceLabel(clause.source_field)}
                    </Badge>
                    <Badge variant="outline" className="bg-white">
                      {Math.round(clause.similarity * 100)}% match
                    </Badge>
                    {usedByAI ? (
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
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-slate-700" />
            <CardTitle>Recommended Action</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            {check.suggested_action ??
              "Review the result and decide how to respond before starting work."}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div className="flex items-center gap-2">
              <MailCheck className="h-5 w-5 text-slate-700" />
              <CardTitle>Professional Reply</CardTitle>
            </div>
            <CopyButton text={professionalReply} />
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              {professionalReply || "No reply draft was returned."}
            </div>
          </CardContent>
        </Card>

        {check.scope_status === "out_of_scope" ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-slate-700" />
                <CardTitle>Change Request Summary</CardTitle>
              </div>
              <CopyButton text={changeRequestSummary} />
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {changeRequestSummary ||
                  "No change request summary was returned."}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-slate-700" />
                <CardTitle>Change Request Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
                A change request summary is shown when a check is out of scope.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline">
          <Link href={`/projects/${check.project_id}`}>Back to Project</Link>
        </Button>
        <Button asChild>
          <Link href={`/projects/${check.project_id}/check`}>
            <RefreshCw />
            Run Another Check
          </Link>
        </Button>
      </div>
    </div>
  );
}
