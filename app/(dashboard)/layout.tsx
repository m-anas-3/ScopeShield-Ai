import { redirect } from "next/navigation";

import { grantMonthlyFreeCredits, STARTER_CREDITS } from "@/lib/credits/monthly";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";

export const dynamic = "force-dynamic";

async function getCurrentUser() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("User lookup failed", error);
      return null;
    }

    return user;
  } catch (error) {
    console.error("User lookup failed", error);
    return null;
  }
}

function fallbackProfile(userId: string): Profile {
  const now = new Date().toISOString();

  return {
    id: userId,
    full_name: null,
    avatar_url: null,
    credits_balance: STARTER_CREDITS,
    credits_reset_at: now,
    created_at: now,
  };
}

async function getProfile(userId: string): Promise<Profile> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, credits_balance, credits_reset_at, created_at",
      )
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.error("Profile lookup failed", error);
      return fallbackProfile(userId);
    }

    return {
      id: String(data.id),
      full_name: data.full_name ? String(data.full_name) : null,
      avatar_url: data.avatar_url ? String(data.avatar_url) : null,
      credits_balance: Number(data.credits_balance ?? STARTER_CREDITS),
      credits_reset_at: String(data.credits_reset_at),
      created_at: String(data.created_at),
    };
  } catch (error) {
    console.error("Profile lookup failed", error);
    return fallbackProfile(userId);
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  await grantMonthlyFreeCredits(user.id);
  const profile = await getProfile(user.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <Sidebar />
      </div>
      <div className="lg:pl-64">
        <TopBar profile={profile} email={user.email} />
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
