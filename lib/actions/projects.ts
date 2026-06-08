"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { embedTexts } from "@/lib/rag/embeddings";
import { chunkProjectScope } from "@/lib/rag/chunk";
import { createClient } from "@/lib/supabase/server";
import {
  projectSchema,
  type ProjectFormValues,
} from "@/lib/validations/project";

type CreateProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

type ProjectActionResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string };

type LockProjectResult =
  | { ok: true; chunksCount: number }
  | { ok: false; error: string };

type ProjectScopeRow = {
  id: string;
  user_id: string;
  name: string;
  original_scope: string;
  deliverables: string | null;
  exclusions: string | null;
  revision_limit: number | null;
  hourly_rate: number | null;
  scope_locked: boolean;
};

const projectIdSchema = z.string().uuid();

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

export async function updateProjectAction(
  projectId: string,
  values: ProjectFormValues,
): Promise<ProjectActionResult> {
  const parsedProjectId = projectIdSchema.safeParse(projectId);
  const parsed = projectSchema.safeParse(values);

  if (!parsedProjectId.success || !parsed.success) {
    return { ok: false, error: "Check the project details and try again." };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { ok: false, error: "You must be signed in to update projects." };
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, scope_locked")
      .eq("id", parsedProjectId.data)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return { ok: false, error: "Project not found." };
    }

    if (Boolean(project.scope_locked)) {
      return {
        ok: false,
        error: "This scope is locked and cannot be edited.",
      };
    }

    const { error } = await supabase
      .from("projects")
      .update({
        name: parsed.data.name,
        client_name: toNullableText(parsed.data.client_name),
        original_scope: parsed.data.original_scope,
        deliverables: toNullableText(parsed.data.deliverables),
        exclusions: toNullableText(parsed.data.exclusions),
        revision_limit: toNullableNumber(parsed.data.revision_limit),
        hourly_rate: toNullableNumber(parsed.data.hourly_rate),
      })
      .eq("id", parsedProjectId.data)
      .eq("user_id", user.id);

    if (error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath(`/projects/${parsedProjectId.data}`);

    return { ok: true, projectId: parsedProjectId.data };
  } catch (error) {
    console.error("Update project failed", error);
    return { ok: false, error: "Unable to update the project right now." };
  }
}

function toProjectScopeRow(value: unknown): ProjectScopeRow | null {
  const parsed = z
    .object({
      id: z.string(),
      user_id: z.string(),
      name: z.string(),
      original_scope: z.string(),
      deliverables: z.string().nullable(),
      exclusions: z.string().nullable(),
      revision_limit: z.number().nullable(),
      hourly_rate: z.coerce.number().nullable(),
      scope_locked: z.boolean(),
    })
    .safeParse(value);

  return parsed.success ? parsed.data : null;
}

export async function lockProjectScopeAction(
  projectId: string,
): Promise<LockProjectResult> {
  const parsedProjectId = projectIdSchema.safeParse(projectId);

  if (!parsedProjectId.success) {
    return { ok: false, error: "Invalid project." };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { ok: false, error: "You must be signed in to lock scopes." };
    }

    const { data: projectData, error: projectError } = await supabase
      .from("projects")
      .select(
        "id, user_id, name, original_scope, deliverables, exclusions, revision_limit, hourly_rate, scope_locked",
      )
      .eq("id", parsedProjectId.data)
      .eq("user_id", user.id)
      .single();

    if (projectError || !projectData) {
      return { ok: false, error: "Project not found." };
    }

    const project = toProjectScopeRow(projectData);

    if (!project) {
      return { ok: false, error: "Project could not be read." };
    }

    if (project.scope_locked) {
      return { ok: true, chunksCount: 0 };
    }

    const chunks = chunkProjectScope(project);

    if (chunks.length === 0) {
      return { ok: false, error: "Add scope text before locking the project." };
    }

    const embeddingResult = await embedTexts(
      chunks.map((chunk) => chunk.chunkText),
    );

    if (embeddingResult.embeddings.length !== chunks.length) {
      return { ok: false, error: "Scope embeddings could not be generated." };
    }

    const { error: deleteError } = await supabase
      .from("scope_chunks")
      .delete()
      .eq("project_id", project.id)
      .eq("user_id", user.id);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    const { error: insertError } = await supabase.from("scope_chunks").insert(
      chunks.map((chunk, index) => ({
        user_id: user.id,
        project_id: project.id,
        chunk_index: chunk.chunkIndex,
        source_field: chunk.sourceField,
        chunk_text: chunk.chunkText,
        token_estimate: chunk.tokenEstimate,
        embedding: embeddingResult.embeddings[index],
        embedding_model: embeddingResult.model,
      })),
    );

    if (insertError) {
      return { ok: false, error: insertError.message };
    }

    const { error: updateError } = await supabase
      .from("projects")
      .update({
        scope_locked: true,
        locked_at: new Date().toISOString(),
        scope_embedding_model: embeddingResult.model,
        scope_chunks_count: chunks.length,
      })
      .eq("id", project.id)
      .eq("user_id", user.id);

    if (updateError) {
      await supabase
        .from("scope_chunks")
        .delete()
        .eq("project_id", project.id)
        .eq("user_id", user.id);

      return { ok: false, error: updateError.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);

    return { ok: true, chunksCount: chunks.length };
  } catch (error) {
    console.error("Lock project scope failed", error);
    return { ok: false, error: "Unable to lock the scope right now." };
  }
}
