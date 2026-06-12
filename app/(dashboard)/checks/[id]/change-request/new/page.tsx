import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { ChangeRequestFormValues } from "@/lib/validations/change-request";
import { ChangeRequestForm } from "@/components/change-requests/ChangeRequestForm";

interface NewChangeRequestFromCheckPageProps {
  params: {
    id: string;
  };
}

interface CheckBuilderSeed {
  checkId: string;
  projectId: string;
  projectName: string;
  clientName: string | null;
  clientRequest: string;
  changeRequestSummary: string | null;
  suggestedAction: string | null;
  professionalReply: string | null;
  estimatedHoursMin: number | null;
  estimatedHoursMax: number | null;
  hourlyRate: number | null;
  existingChangeRequestId: string | null;
  scopeStatus: string | null;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function numberToField(value: number | null) {
  return value === null ? "" : String(value);
}

function buildSummary(seed: CheckBuilderSeed) {
  const sections = [
    seed.changeRequestSummary,
    seed.suggestedAction ? `Recommended action: ${seed.suggestedAction}` : null,
    seed.professionalReply
      ? `Suggested client reply:\n${seed.professionalReply}`
      : null,
  ].filter((section): section is string => Boolean(section?.trim()));

  return sections.join("\n\n");
}

async function getSeed(checkId: string): Promise<CheckBuilderSeed | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data: check, error: checkError } = await supabase
      .from("scope_checks")
      .select(
        "id, user_id, project_id, client_request, scope_status, estimated_hours_min, estimated_hours_max, suggested_action, professional_reply, change_request_summary",
      )
      .eq("id", checkId)
      .eq("user_id", user.id)
      .single();

    if (checkError || !check) {
      console.error("Change request seed check lookup failed", checkError);
      return null;
    }

    const { data: existing } = await supabase
      .from("change_requests")
      .select("id")
      .eq("scope_check_id", checkId)
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, client_name, hourly_rate")
      .eq("id", String(check.project_id))
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      console.error("Change request seed project lookup failed", projectError);
      return null;
    }

    return {
      checkId: String(check.id),
      projectId: String(check.project_id),
      projectName: String(project.name),
      clientName: project.client_name ? String(project.client_name) : null,
      clientRequest: String(check.client_request),
      changeRequestSummary: check.change_request_summary
        ? String(check.change_request_summary)
        : null,
      suggestedAction: check.suggested_action
        ? String(check.suggested_action)
        : null,
      professionalReply: check.professional_reply
        ? String(check.professional_reply)
        : null,
      estimatedHoursMin:
        check.estimated_hours_min === null
          ? null
          : Number(check.estimated_hours_min),
      estimatedHoursMax:
        check.estimated_hours_max === null
          ? null
          : Number(check.estimated_hours_max),
      hourlyRate: project.hourly_rate === null ? null : Number(project.hourly_rate),
      existingChangeRequestId: existing?.id ? String(existing.id) : null,
      scopeStatus: check.scope_status ? String(check.scope_status) : null,
    };
  } catch (error) {
    console.error("Change request seed lookup failed", error);
    return null;
  }
}

export default async function NewChangeRequestFromCheckPage({
  params,
}: NewChangeRequestFromCheckPageProps) {
  const seed = await getSeed(params.id);

  if (!seed) {
    redirect("/projects");
  }

  if (seed.existingChangeRequestId) {
    redirect(`/change-requests/${seed.existingChangeRequestId}`);
  }

  if (seed.scopeStatus !== "out_of_scope") {
    redirect(`/checks/${seed.checkId}`);
  }

  const estimatedTotal =
    seed.hourlyRate !== null && seed.estimatedHoursMax !== null
      ? seed.hourlyRate * seed.estimatedHoursMax
      : null;
  const initialValues: ChangeRequestFormValues = {
    project_id: seed.projectId,
    scope_check_id: seed.checkId,
    title: `Change request: ${truncate(seed.projectName, 90)}`,
    summary: buildSummary(seed),
    client_message: seed.clientRequest,
    estimated_hours_min: numberToField(seed.estimatedHoursMin),
    estimated_hours_max: numberToField(seed.estimatedHoursMax),
    hourly_rate_snapshot: numberToField(seed.hourlyRate),
    fixed_price: "",
    estimated_total: numberToField(estimatedTotal),
    currency: "USD",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={`/checks/${seed.checkId}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#534AB7] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Scope Check
      </Link>
      <div>
        <h1 className="text-3xl font-bold tracking-normal text-slate-950">
          Create Change Request
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {seed.projectName}
          {seed.clientName ? ` · ${seed.clientName}` : ""}
        </p>
      </div>
      <ChangeRequestForm
        initialValues={initialValues}
        cancelHref={`/checks/${seed.checkId}`}
      />
    </div>
  );
}
