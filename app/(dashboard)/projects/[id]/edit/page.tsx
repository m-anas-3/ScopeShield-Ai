import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/types";
import { ProjectForm } from "@/components/projects/ProjectForm";

interface ProjectEditPageProps {
  params: {
    id: string;
  };
}

interface EditableProject {
  id: string;
  name: string;
  client_name: string | null;
  original_scope: string;
  deliverables: string | null;
  exclusions: string | null;
  revision_limit: number | null;
  hourly_rate: number | null;
  status: ProjectStatus;
  scope_locked: boolean;
}

async function getEditableProject(
  projectId: string,
): Promise<EditableProject | null> {
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
        "id, name, client_name, original_scope, deliverables, exclusions, revision_limit, hourly_rate, status, scope_locked",
      )
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      console.error("Editable project lookup failed", error);
      return null;
    }

    return {
      id: String(data.id),
      name: String(data.name),
      client_name: data.client_name ? String(data.client_name) : null,
      original_scope: String(data.original_scope),
      deliverables: data.deliverables ? String(data.deliverables) : null,
      exclusions: data.exclusions ? String(data.exclusions) : null,
      revision_limit:
        data.revision_limit === null ? null : Number(data.revision_limit),
      hourly_rate: data.hourly_rate === null ? null : Number(data.hourly_rate),
      status: (data.status ?? "active") as ProjectStatus,
      scope_locked: Boolean(data.scope_locked),
    };
  } catch (error) {
    console.error("Editable project lookup failed", error);
    return null;
  }
}

export default async function ProjectEditPage({ params }: ProjectEditPageProps) {
  const project = await getEditableProject(params.id);

  if (!project) {
    redirect("/projects");
  }

  if (project.scope_locked) {
    redirect(`/projects/${project.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href={`/projects/${project.id}`}
        className="text-sm font-medium text-[#534AB7] hover:underline"
      >
        Back to {project.name}
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-normal text-slate-950">
          Edit Project Scope
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Changes are allowed until the scope is locked.
        </p>
      </div>
      <ProjectForm
        mode="edit"
        projectId={project.id}
        initialValues={{
          name: project.name,
          client_name: project.client_name ?? "",
          original_scope: project.original_scope,
          deliverables: project.deliverables ?? "",
          exclusions: project.exclusions ?? "",
          revision_limit:
            project.revision_limit === null ? "" : String(project.revision_limit),
          hourly_rate:
            project.hourly_rate === null ? "" : String(project.hourly_rate),
        }}
      />
    </div>
  );
}
