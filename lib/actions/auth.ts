"use server";

import { createClient } from "@/lib/supabase/server";
import { authSchema, type AuthFormValues } from "@/lib/validations/auth";

type AuthActionResult =
  | { ok: true; needsConfirmation?: boolean }
  | { ok: false; error: string };

export async function loginAction(
  values: AuthFormValues,
): Promise<AuthActionResult> {
  const parsed = authSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, error: "Check your email and password." };
  }

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error("Login failed", error);
    return { ok: false, error: "Unable to sign in right now." };
  }
}

export async function signupAction(
  values: AuthFormValues,
): Promise<AuthActionResult> {
  const parsed = authSchema.safeParse(values);

  if (!parsed.success) {
    return { ok: false, error: "Check your email and password." };
  }

  try {
    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { data, error } = await supabase.auth.signUp({
      ...parsed.data,
      options: {
        emailRedirectTo: `${appUrl}/dashboard`,
      },
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, needsConfirmation: !data.session };
  } catch (error) {
    console.error("Signup failed", error);
    return { ok: false, error: "Unable to create an account right now." };
  }
}

export async function signOutAction(): Promise<AuthActionResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error("Sign out failed", error);
    return { ok: false, error: "Unable to sign out right now." };
  }
}
