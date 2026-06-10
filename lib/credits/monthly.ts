import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const MONTHLY_FREE_CREDITS = 10;
export const STARTER_CREDITS = 30;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function grantMonthlyFreeCredits(userId: string) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc(
      "admin_grant_monthly_free_credits",
      {
        p_user_id: userId,
      },
    );

    if (error) {
      console.error("Monthly free credit grant failed", error);
      return null;
    }

    return typeof data === "number" ? data : null;
  } catch (error) {
    console.error("Monthly free credit grant failed", {
      error: errorMessage(error),
    });
    return null;
  }
}
