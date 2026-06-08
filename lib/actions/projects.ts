"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  projectSchema,
  type ProjectFormValues,
} from "@/lib/validations/project";

type CreateProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

function toNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNullableNumber(value: string) {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : Number(trimmed);
}

export async function createProjectAction(
  values: ProjectFormValues,
): Promise<CreateProjectResult> {
  const parsed = projectSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, error: "Check the project details and try again." };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { ok: false, error: "You must be signed in to create projects." };
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        client_name: toNullableText(parsed.data.client_name),
        original_scope: parsed.data.original_scope,
        deliverables: toNullableText(parsed.data.deliverables),
        exclusions: toNullableText(parsed.data.exclusions),
        revision_limit: toNullableNumber(parsed.data.revision_limit),
        hourly_rate: toNullableNumber(parsed.data.hourly_rate),
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Project could not be created.",
      };
    }

    revalidatePath("/dashboard");
    revalidatePath("/projects");

    return { ok: true, projectId: String(data.id) };
  } catch (error) {
    console.error("Create project failed", error);
    return { ok: false, error: "Unable to create the project right now." };
  }
}
