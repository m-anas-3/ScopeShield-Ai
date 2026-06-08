import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CheckForm } from "@/components/checks/CheckForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProjectCheckPageProps {
  params: {
    id: string;
  };
}

interface ProjectSummary {
  id: string;
  name: string;
  client_name: string | null;
}

async function getProject(projectId: string): Promise<ProjectSummary | null> {
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
      .select("id, user_id, name, client_name")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      console.error("Project check lookup failed", error);
      return null;
    }

    return {
      id: String(data.id),
      name: String(data.name),
      client_name: data.client_name ? String(data.client_name) : null,
    };
  } catch (error) {
    console.error("Project check lookup failed", error);
    return null;
  }
}

export default async function ProjectCheckPage({
  params,
}: ProjectCheckPageProps) {
  const project = await getProject(params.id);

  if (!project) {
    redirect("/projects");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/projects/${project.id}`}
        className="text-sm font-medium text-[#534AB7] hover:underline"
      >
        ← Back to {project.name}
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-normal text-slate-950">
          Run Scope Check
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Project: {project.name} · Client: {project.client_name ?? "N/A"}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Analyze Client Request</CardTitle>
          <CardDescription>
            Compare the new ask against the saved project scope.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CheckForm projectId={project.id} projectName={project.name} />
        </CardContent>
      </Card>
    </div>
  );
}
