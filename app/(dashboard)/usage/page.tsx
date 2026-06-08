import { BarChart3, Coins } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { Plan, Profile } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";

const planLimits: Record<Plan, number> = {
  free: 30,
  pro: 300,
  agency: 1000,
};

const planLabels: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  agency: "Agency",
};

function fallbackProfile(userId: string): Profile {
  const now = new Date().toISOString();

  return {
    id: userId,
    full_name: null,
    avatar_url: null,
    plan: "free",
    credits_balance: 30,
    credits_reset_at: now,
    created_at: now,
  };
}

async function getProfile(): Promise<Profile | null> {
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
      .from("profiles")
      .select(
        "id, full_name, avatar_url, plan, credits_balance, credits_reset_at, created_at",
      )
      .eq("id", user.id)
      .single();

    if (error || !data) {
      console.error("Usage profile lookup failed", error);
      return fallbackProfile(user.id);
    }

    return {
      id: String(data.id),
      full_name: data.full_name ? String(data.full_name) : null,
      avatar_url: data.avatar_url ? String(data.avatar_url) : null,
      plan: (data.plan ?? "free") as Plan,
      credits_balance: Number(data.credits_balance ?? 30),
      credits_reset_at: String(data.credits_reset_at),
      created_at: String(data.created_at),
    };
  } catch (error) {
    console.error("Usage profile lookup failed", error);
    return null;
  }
}

export default async function UsagePage() {
  const profile = await getProfile();
  const plan = profile?.plan ?? "free";
  const limit = planLimits[plan];
  const credits = profile?.credits_balance ?? 0;
  const percent = Math.max(0, Math.min(100, Math.round((credits / limit) * 100)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-normal text-slate-950">
          Usage
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credits and check history for the current billing period.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
            <CardDescription>Current workspace allowance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge className="capitalize" variant="secondary">
              {planLabels[plan]}
            </Badge>
            <div>
              <p className="text-4xl font-bold tracking-normal text-slate-950">
                {credits}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                credits remaining
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-[#534AB7]" />
              <CardTitle>Credit Balance</CardTitle>
            </div>
            <CardDescription>
              Credit deduction and reset logic will be wired in Part 2.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-medium text-slate-950">
                {credits} / {limit}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[#534AB7]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage Log</CardTitle>
          <CardDescription>
            Token and credit events will appear after the AI flow is connected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Credits</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody />
          </Table>
          <div className="mt-4">
            <EmptyState
              icon={<BarChart3 className="h-6 w-6" />}
              title="No usage yet"
              description="Scope check usage records will be created in Part 2."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
