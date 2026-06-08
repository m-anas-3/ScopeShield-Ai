"use client";

import Link from "next/link";
import { useState } from "react";

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

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

function statusMeta(status: ScopeCheck["scope_status"]) {
  switch (status) {
    case "in_scope":
      return {
        label: "✓ In Scope",
        className: "border-green-200 bg-green-50 text-green-800",
      };
    case "out_of_scope":
      return {
        label: "✕ Out of Scope",
        className: "border-red-200 bg-red-50 text-red-800",
      };
    case "needs_clarification":
      return {
        label: "⚠ Needs Clarification",
        className: "border-yellow-200 bg-yellow-50 text-yellow-800",
      };
    default:
      return {
        label: "Needs Review",
        className: "border-gray-200 bg-gray-50 text-gray-800",
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

  return `${min}–${max} hrs`;
}

export function ResultCard({ check }: ResultCardProps) {
  const verdict = statusMeta(check.scope_status);
  const professionalReply = check.professional_reply ?? "";
  const changeRequestSummary = check.change_request_summary ?? "";

  return (
    <div className="space-y-6">
      <Card className={`border py-8 text-center ${verdict.className}`}>
        <CardContent className="p-0">
          <h2 className="text-3xl font-bold tracking-normal">{verdict.label}</h2>
          <Badge className={`mt-3 capitalize ${riskClassName(check.risk_level)}`}>
            {check.risk_level ?? "unknown"} risk
          </Badge>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Scope Status</p>
            <Badge className="mt-3" variant="secondary">
              {scopeStatusLabel(check.scope_status)}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Risk Level</p>
            <Badge className={`mt-3 capitalize ${riskClassName(check.risk_level)}`}>
              {check.risk_level ?? "unknown"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Extra Hours</p>
            <p className="mt-3 text-lg font-semibold text-slate-950">
              {extraHours(check)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Credits Used</p>
            <p className="mt-3 text-lg font-semibold text-slate-950">
              {check.credits_used} credits
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            {check.ai_reason}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommended Action</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            {check.suggested_action}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Professional Reply</CardTitle>
          <CopyButton text={professionalReply} />
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-slate-700">
            {professionalReply}
          </div>
        </CardContent>
      </Card>

      {check.scope_status === "out_of_scope" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Change Request Summary</CardTitle>
            <CopyButton text={changeRequestSummary} />
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-slate-700">
              {changeRequestSummary}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/projects/${check.project_id}`}
          className="text-sm font-medium text-[#534AB7] hover:underline"
        >
          ← Back to Project
        </Link>
        <Button asChild>
          <Link href={`/projects/${check.project_id}/check`}>
            Run Another Check
          </Link>
        </Button>
      </div>
    </div>
  );
}
