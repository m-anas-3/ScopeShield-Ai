import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, FileText, MessageSquareText } from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectStatus, RiskLevel, ScopeStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";

interface ProjectDetailPageProps {
  params: {
    id: string;
  };
}

interface ProjectCheck {
  id: string;
  clientRequest: string;
  scopeStatus: ScopeStatus | null;
  riskLevel: RiskLevel | null;
  estimatedHoursMin: number | null;
  estimatedHoursMax: number | null;
  createdAt: string;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
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
      return "Unknown";
  }
}

function scopeStatusClassName(status: ScopeStatus | null) {
  switch (status) {
    case "in_scope":
      return "border-green-200 bg-green-50 text-green-700";
    case "out_of_scope":
      return "border-red-200 bg-red-50 text-red-700";
    case "needs_clarification":
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
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
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function hoursLabel(check: ProjectCheck) {
  const min = check.estimatedHoursMin ?? 0;
  const max = check.estimatedHoursMax ?? 0;

  if (min === 0 && max === 0) {
    return "No extra work";
  }

  return `${min}–${max} hrs`;
}

async function getProject(projectId: string): Promise<Project | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, user_id, name, client_name, original_scope, deliverables, exclusions, revision_limit, hourly_rate, status, created_at, updated_at",
      )
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      console.error("Project detail lookup failed", error);
      return null;
    }

    return {
      id: String(data.id),
      user_id: String(data.user_id),
      name: String(data.name),
      client_name: data.client_name ? String(data.client_name) : null,
      original_scope: String(data.original_scope),
      deliverables: data.deliverables ? String(data.deliverables) : null,
      exclusions: data.exclusions ? String(data.exclusions) : null,
      revision_limit:
        data.revision_limit === null ? null : Number(data.revision_limit),
      hourly_rate: data.hourly_rate === null ? null : Number(data.hourly_rate),
      status: (data.status ?? "active") as ProjectStatus,
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
    };
  } catch (error) {
    console.error("Project detail lookup failed", error);
    return null;
  }
}

async function getProjectChecks(projectId: string): Promise<ProjectCheck[]> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return [];
    }

    const { data, error } = await supabase
      .from("scope_checks")
      .select(
        "id, client_request, scope_status, risk_level, estimated_hours_min, estimated_hours_max, created_at",
      )
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("Project checks lookup failed", error);
      return [];
    }

    return data.map((check) => ({
      id: String(check.id),
      clientRequest: String(check.client_request),
      scopeStatus: (check.scope_status ?? null) as ScopeStatus | null,
      riskLevel: (check.risk_level ?? null) as RiskLevel | null,
      estimatedHoursMin:
        check.estimated_hours_min === null
          ? null
          : Number(check.estimated_hours_min),
      estimatedHoursMax:
        check.estimated_hours_max === null
          ? null
          : Number(check.estimated_hours_max),
      createdAt: String(check.created_at),
    }));
  } catch (error) {
    console.error("Project checks lookup failed", error);
    return [];
  }
}

function ScopeCard({
  title,
  value,
}: {
  title: string;
  value: string | number | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {value ?? "Not specified"}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const project = await getProject(params.id);

  if (!project) {
    notFound();
  }

  const checks = await getProjectChecks(params.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge variant={project.status}>{project.status}</Badge>
            <span className="text-sm text-muted-foreground">
              Created {formatDate(project.created_at)}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-normal text-slate-950">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.client_name ?? "No client name set"}
          </p>
        </div>
        <Button asChild>
          <Link href={`/projects/${project.id}/check`}>
            <MessageSquareText />
            Run Scope Check
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <ScopeCard title="Original Scope" value={project.original_scope} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Terms</CardTitle>
            <CardDescription>Commercial details for change requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Revision limit</span>
              <span className="font-medium text-slate-950">
                {project.revision_limit ?? "Not set"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Hourly rate</span>
              <span className="font-medium text-slate-950">
                {formatCurrency(project.hourly_rate)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={project.status}>{project.status}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ScopeCard title="Deliverables" value={project.deliverables} />
        <ScopeCard title="Exclusions" value={project.exclusions} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[#534AB7]" />
            <CardTitle>Scope Checks</CardTitle>
          </div>
          <CardDescription>
            Saved scope checks for this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Request</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checks.map((check) => (
                  <TableRow key={check.id} className="hover:bg-transparent">
                    <TableCell colSpan={5} className="p-0">
                      <Link
                        href={`/checks/${check.id}`}
                        className="grid gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50 lg:grid-cols-[1.4fr_150px_110px_120px_120px] lg:items-center"
                      >
                        <span className="text-slate-950">
                          {truncate(check.clientRequest, 70)}
                        </span>
                        <span>
                          <Badge
                            className={scopeStatusClassName(check.scopeStatus)}
                          >
                            {scopeStatusLabel(check.scopeStatus)}
                          </Badge>
                        </span>
                        <span>
                          <Badge
                            className={`capitalize ${riskClassName(check.riskLevel)}`}
                          >
                            {check.riskLevel ?? "unknown"}
                          </Badge>
                        </span>
                        <span className="text-muted-foreground">
                          {hoursLabel(check)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(check.createdAt)}
                        </span>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No checks for this project"
              description="Run a scope check to compare a client request against the saved project scope."
              actionLabel="Run First Check"
              actionHref={`/projects/${project.id}/check`}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
