import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, FileText, MessageSquareText } from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectStatus } from "@/types";
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
            Checks for this project will be listed after Part 2 is built.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody />
          </Table>
          <div className="mt-4">
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No checks for this project"
              description="Part 2 will add the AI check flow and save results here."
              actionLabel="Run Scope Check"
              actionHref={`/projects/${project.id}/check`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
