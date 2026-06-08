import Link from "next/link";
import { FolderPlus, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ProjectCard } from "@/components/projects/ProjectCard";

async function getProjects(): Promise<Project[]> {
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
      .from("projects")
      .select(
        "id, user_id, name, client_name, original_scope, deliverables, exclusions, revision_limit, hourly_rate, status, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("Projects lookup failed", error);
      return [];
    }

    return data.map((project) => ({
      id: String(project.id),
      user_id: String(project.user_id),
      name: String(project.name),
      client_name: project.client_name ? String(project.client_name) : null,
      original_scope: String(project.original_scope),
      deliverables: project.deliverables ? String(project.deliverables) : null,
      exclusions: project.exclusions ? String(project.exclusions) : null,
      revision_limit:
        project.revision_limit === null ? null : Number(project.revision_limit),
      hourly_rate:
        project.hourly_rate === null ? null : Number(project.hourly_rate),
      status: (project.status ?? "active") as ProjectStatus,
      created_at: String(project.created_at),
      updated_at: String(project.updated_at),
    }));
  } catch (error) {
    console.error("Projects lookup failed", error);
    return [];
  }
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-slate-950">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Store original scopes before comparing new client requests.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus />
            New Project
          </Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderPlus className="h-6 w-6" />}
          title="No projects yet"
          description="Create your first project with the original scope, deliverables, exclusions, and terms."
          actionLabel="Create Your First Project"
          actionHref="/projects/new"
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
