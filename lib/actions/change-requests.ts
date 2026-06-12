"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  canOwnerTransitionChangeRequestStatus,
  isFinalChangeRequestStatus,
} from "@/lib/change-requests/status";
import { getOwnedChangeRequestDetail } from "@/lib/change-requests/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  changeRequestSchema,
  ownerChangeRequestStatusSchema,
  publicChangeRequestResponseSchema,
  type ChangeRequestFormValues,
} from "@/lib/validations/change-request";

type ChangeRequestActionResult =
  | { ok: true; changeRequestId: string }
  | { ok: false; error: string };

type ChangeRequestStatusResult =
  | { ok: true; status: string }
  | { ok: false; error: string };

type PublicChangeRequestResponseResult =
  | { ok: true; status: "approved" | "rejected" }
  | { ok: false; error: string };

const changeRequestIdSchema = z.string().uuid();

function toNullableText(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNullableNumber(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed.length === 0 ? null : Number(trimmed);
}

function toMoney(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

function normalizeChangeRequestValues(values: ChangeRequestFormValues) {
  const estimatedHoursMax = toNullableNumber(values.estimated_hours_max);
  const hourlyRateSnapshot = toNullableNumber(values.hourly_rate_snapshot);
  const fixedPrice = toMoney(toNullableNumber(values.fixed_price));
  const suppliedEstimatedTotal = toMoney(toNullableNumber(values.estimated_total));
  const estimatedTotal =
    suppliedEstimatedTotal ??
    (fixedPrice === null &&
    hourlyRateSnapshot !== null &&
    estimatedHoursMax !== null
      ? toMoney(hourlyRateSnapshot * estimatedHoursMax)
      : null);

  return {
    project_id: values.project_id,
    scope_check_id: toNullableText(values.scope_check_id),
    title: values.title.trim(),
    summary: values.summary.trim(),
    client_message: toNullableText(values.client_message),
    estimated_hours_min: toNullableNumber(values.estimated_hours_min),
    estimated_hours_max: estimatedHoursMax,
    hourly_rate_snapshot: toMoney(hourlyRateSnapshot),
    fixed_price: fixedPrice,
    estimated_total: estimatedTotal,
    currency: values.currency.trim().toUpperCase(),
  };
}

async function getSignedInUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, userId: null };
  }

  return { supabase, userId: user.id };
}

async function verifyProjectAndCheck({
  supabase,
  userId,
  projectId,
  scopeCheckId,
}: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  projectId: string;
  scopeCheckId: string | null;
}) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (projectError || !project) {
    return "Project not found.";
  }

  if (!scopeCheckId) {
    return null;
  }

  const { data: check, error: checkError } = await supabase
    .from("scope_checks")
    .select("id, project_id")
    .eq("id", scopeCheckId)
    .eq("user_id", userId)
    .single();

  if (checkError || !check || String(check.project_id) !== projectId) {
    return "Scope check not found for this project.";
  }

  const { data: existing, error: existingError } = await supabase
    .from("change_requests")
    .select("id")
    .eq("scope_check_id", scopeCheckId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    return existingError.message;
  }

  if (existing) {
    return "A change request already exists for this scope check.";
  }

  return null;
}

export async function createChangeRequestAction(
  values: ChangeRequestFormValues,
): Promise<ChangeRequestActionResult> {
  const parsed = changeRequestSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, error: "Check the change request details and try again." };
  }

  try {
    const { supabase, userId } = await getSignedInUser();

    if (!userId) {
      return {
        ok: false,
        error: "You must be signed in to create change requests.",
      };
    }

    const normalized = normalizeChangeRequestValues(parsed.data);
    const verificationError = await verifyProjectAndCheck({
      supabase,
      userId,
      projectId: normalized.project_id,
      scopeCheckId: normalized.scope_check_id,
    });

    if (verificationError) {
      return { ok: false, error: verificationError };
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("change_requests")
      .insert({
        user_id: userId,
        project_id: normalized.project_id,
        scope_check_id: normalized.scope_check_id,
        title: normalized.title,
        summary: normalized.summary,
        client_message: normalized.client_message,
        estimated_hours_min: normalized.estimated_hours_min,
        estimated_hours_max: normalized.estimated_hours_max,
        hourly_rate_snapshot: normalized.hourly_rate_snapshot,
        fixed_price: normalized.fixed_price,
        estimated_total: normalized.estimated_total,
        currency: normalized.currency,
        status: "draft",
        client_response_note: null,
        approved_at: null,
        rejected_at: null,
        paid_at: null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: error?.message ?? "Change request could not be created.",
      };
    }

    const changeRequestId = String(data.id);

    revalidatePath("/change-requests");
    revalidatePath(`/projects/${normalized.project_id}`);

    if (normalized.scope_check_id) {
      revalidatePath(`/checks/${normalized.scope_check_id}`);
    }

    return { ok: true, changeRequestId };
  } catch (error) {
    console.error("Create change request failed", error);
    return {
      ok: false,
      error: "Unable to create the change request right now.",
    };
  }
}

export async function updateChangeRequestAction(
  changeRequestId: string,
  values: ChangeRequestFormValues,
): Promise<ChangeRequestActionResult> {
  const parsedId = changeRequestIdSchema.safeParse(changeRequestId);
  const parsed = changeRequestSchema.safeParse(values);

  if (!parsedId.success || !parsed.success) {
    return { ok: false, error: "Check the change request details and try again." };
  }

  try {
    const detail = await getOwnedChangeRequestDetail(parsedId.data);

    if (!detail) {
      return { ok: false, error: "Change request not found." };
    }

    if (isFinalChangeRequestStatus(detail.changeRequest.status)) {
      return {
        ok: false,
        error: "Finalized change requests cannot be edited.",
      };
    }

    if (detail.changeRequest.status === "approved") {
      return {
        ok: false,
        error: "Approved change requests can only be marked paid.",
      };
    }

    const normalized = normalizeChangeRequestValues(parsed.data);

    if (
      normalized.project_id !== detail.changeRequest.project_id ||
      normalized.scope_check_id !== detail.changeRequest.scope_check_id
    ) {
      return {
        ok: false,
        error: "Change requests cannot be moved to another project or check.",
      };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("change_requests")
      .update({
        title: normalized.title,
        summary: normalized.summary,
        client_message: normalized.client_message,
        estimated_hours_min: normalized.estimated_hours_min,
        estimated_hours_max: normalized.estimated_hours_max,
        hourly_rate_snapshot: normalized.hourly_rate_snapshot,
        fixed_price: normalized.fixed_price,
        estimated_total: normalized.estimated_total,
        currency: normalized.currency,
      })
      .eq("id", detail.changeRequest.id)
      .eq("user_id", detail.changeRequest.user_id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/change-requests");
    revalidatePath(`/change-requests/${detail.changeRequest.id}`);
    revalidatePath(`/change-requests/${detail.changeRequest.id}/report`);
    revalidatePath(`/projects/${detail.changeRequest.project_id}`);

    if (detail.changeRequest.scope_check_id) {
      revalidatePath(`/checks/${detail.changeRequest.scope_check_id}`);
    }

    return { ok: true, changeRequestId: detail.changeRequest.id };
  } catch (error) {
    console.error("Update change request failed", error);
    return {
      ok: false,
      error: "Unable to update the change request right now.",
    };
  }
}

export async function updateChangeRequestStatusAction(
  changeRequestId: string,
  nextStatus: string,
): Promise<ChangeRequestStatusResult> {
  const parsedId = changeRequestIdSchema.safeParse(changeRequestId);
  const parsedStatus = ownerChangeRequestStatusSchema.safeParse(nextStatus);

  if (!parsedId.success || !parsedStatus.success) {
    return { ok: false, error: "Invalid status update." };
  }

  try {
    const detail = await getOwnedChangeRequestDetail(parsedId.data);

    if (!detail) {
      return { ok: false, error: "Change request not found." };
    }

    if (
      !canOwnerTransitionChangeRequestStatus(
        detail.changeRequest.status,
        parsedStatus.data,
      )
    ) {
      return {
        ok: false,
        error: "That status change is not available for this request.",
      };
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("change_requests")
      .update({ status: parsedStatus.data })
      .eq("id", detail.changeRequest.id)
      .eq("user_id", detail.changeRequest.user_id);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/change-requests");
    revalidatePath(`/change-requests/${detail.changeRequest.id}`);
    revalidatePath(`/change-requests/${detail.changeRequest.id}/report`);
    revalidatePath(`/projects/${detail.changeRequest.project_id}`);
    revalidatePath(
      `/approve/${detail.changeRequest.public_share_token}`,
    );
    revalidatePath(
      `/approve/${detail.changeRequest.public_share_token}/report`,
    );

    if (detail.changeRequest.scope_check_id) {
      revalidatePath(`/checks/${detail.changeRequest.scope_check_id}`);
    }

    return { ok: true, status: parsedStatus.data };
  } catch (error) {
    console.error("Change request status update failed", error);
    return {
      ok: false,
      error: "Unable to update the change request status right now.",
    };
  }
}

export async function respondToSharedChangeRequestAction(
  values: z.infer<typeof publicChangeRequestResponseSchema>,
): Promise<PublicChangeRequestResponseResult> {
  const parsed = publicChangeRequestResponseSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, error: "Check the response and try again." };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      "respond_to_shared_change_request",
      {
        p_token: parsed.data.token,
        p_response: parsed.data.response,
        p_note: parsed.data.note ?? null,
      },
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      return {
        ok: false,
        error: "This change request is no longer open for approval.",
      };
    }

    revalidatePath(`/approve/${parsed.data.token}`);
    revalidatePath(`/approve/${parsed.data.token}/report`);

    return { ok: true, status: parsed.data.response };
  } catch (error) {
    console.error("Shared change request response failed", error);
    return {
      ok: false,
      error: "Unable to save the response right now.",
    };
  }
}
