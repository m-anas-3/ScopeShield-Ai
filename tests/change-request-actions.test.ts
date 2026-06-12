import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canOwnerTransitionChangeRequestStatus,
  isFinalChangeRequestStatus,
} from "@/lib/change-requests/status";
import {
  changeRequestSchema,
  publicChangeRequestResponseSchema,
} from "@/lib/validations/change-request";

const changeRequestId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const shareToken =
  "0123456789abcdef0123456789abcdef0123456789abcdef";

function detail(status: "draft" | "sent" | "approved" | "rejected" | "paid") {
  return {
    changeRequest: {
      id: changeRequestId,
      user_id: userId,
      project_id: projectId,
      scope_check_id: null,
      title: "Additional checkout work",
      summary: "Add the requested checkout changes.",
      client_message: null,
      estimated_hours_min: 2,
      estimated_hours_max: 4,
      hourly_rate_snapshot: 100,
      fixed_price: null,
      estimated_total: 400,
      currency: "USD",
      status,
      public_share_token: shareToken,
      client_response_note: null,
      approved_at: null,
      rejected_at: null,
      paid_at: null,
      created_at: "2026-06-11T00:00:00Z",
      updated_at: "2026-06-11T00:00:00Z",
    },
    project: {
      id: projectId,
      name: "Website rebuild",
      client_name: "Acme",
      hourly_rate: 100,
    },
    check: null,
  };
}

async function loadActions({
  currentStatus = "draft",
  publicRpcData = [],
}: {
  currentStatus?: "draft" | "sent" | "approved" | "rejected" | "paid";
  publicRpcData?: unknown;
} = {}) {
  vi.resetModules();

  const revalidatePath = vi.fn();
  const adminUpdate = vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  }));
  const rpc = vi.fn(() => Promise.resolve({ data: publicRpcData, error: null }));

  vi.doMock("next/cache", () => ({
    revalidatePath,
  }));
  vi.doMock("@/lib/change-requests/queries", () => ({
    getOwnedChangeRequestDetail: vi.fn(() =>
      Promise.resolve(detail(currentStatus)),
    ),
  }));
  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
      from: vi.fn((table: string) => {
        if (table !== "change_requests") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          update: adminUpdate,
        };
      }),
    }),
  }));
  vi.doMock("@/lib/supabase/server", () => ({
    createClient: () => ({
      rpc,
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({
            data: { user: { id: userId } },
            error: null,
          }),
        ),
      },
    }),
  }));

  const actions = await import("../lib/actions/change-requests");

  return { ...actions, revalidatePath, adminUpdate, rpc };
}

describe("change request validation and transitions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("validates editable change request input", () => {
    expect(
      changeRequestSchema.safeParse({
        project_id: projectId,
        scope_check_id: "",
        title: "CR",
        summary: "Add the work.",
        client_message: "",
        estimated_hours_min: "8",
        estimated_hours_max: "4",
        hourly_rate_snapshot: "100",
        fixed_price: "",
        estimated_total: "",
        currency: "usd",
      }).success,
    ).toBe(false);

    const parsed = changeRequestSchema.safeParse({
      project_id: projectId,
      scope_check_id: "",
      title: "Change request",
      summary: "Add the requested work.",
      client_message: "",
      estimated_hours_min: "2",
      estimated_hours_max: "4",
      hourly_rate_snapshot: "100",
      fixed_price: "",
      estimated_total: "",
      currency: "usd",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.currency : null).toBe("USD");
  });

  it("validates public approval response input", () => {
    expect(
      publicChangeRequestResponseSchema.safeParse({
        token: "short",
        response: "approved",
        note: "",
      }).success,
    ).toBe(false);
    expect(
      publicChangeRequestResponseSchema.safeParse({
        token: shareToken,
        response: "maybe",
        note: "",
      }).success,
    ).toBe(false);
    expect(
      publicChangeRequestResponseSchema.safeParse({
        token: shareToken,
        response: "rejected",
        note: "Not approved.",
      }).success,
    ).toBe(true);
  });

  it("allows only safe owner status transitions", () => {
    expect(canOwnerTransitionChangeRequestStatus("draft", "sent")).toBe(true);
    expect(canOwnerTransitionChangeRequestStatus("sent", "draft")).toBe(true);
    expect(canOwnerTransitionChangeRequestStatus("sent", "paid")).toBe(true);
    expect(canOwnerTransitionChangeRequestStatus("approved", "paid")).toBe(
      true,
    );
    expect(canOwnerTransitionChangeRequestStatus("approved", "sent")).toBe(
      false,
    );
    expect(canOwnerTransitionChangeRequestStatus("rejected", "draft")).toBe(
      false,
    );
    expect(isFinalChangeRequestStatus("paid")).toBe(true);
    expect(isFinalChangeRequestStatus("rejected")).toBe(true);
  });

  it("rejects unavailable owner status transitions before updating", async () => {
    const { updateChangeRequestStatusAction, adminUpdate } = await loadActions({
      currentStatus: "approved",
    });

    const result = await updateChangeRequestStatusAction(
      changeRequestId,
      "sent",
    );

    expect(result).toEqual({
      ok: false,
      error: "That status change is not available for this request.",
    });
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it("updates owner status when the transition is allowed", async () => {
    const { updateChangeRequestStatusAction, adminUpdate } = await loadActions({
      currentStatus: "approved",
    });

    const result = await updateChangeRequestStatusAction(
      changeRequestId,
      "paid",
    );

    expect(result).toEqual({ ok: true, status: "paid" });
    expect(adminUpdate).toHaveBeenCalledWith({ status: "paid" });
  });

  it("handles public approval tokens with no mutable row", async () => {
    const { respondToSharedChangeRequestAction, rpc } = await loadActions({
      publicRpcData: [],
    });

    const result = await respondToSharedChangeRequestAction({
      token: shareToken,
      response: "approved",
      note: "Looks good.",
    });

    expect(result).toEqual({
      ok: false,
      error: "This change request is no longer open for approval.",
    });
    expect(rpc).toHaveBeenCalledWith("respond_to_shared_change_request", {
      p_token: shareToken,
      p_response: "approved",
      p_note: "Looks good.",
    });
  });
});
