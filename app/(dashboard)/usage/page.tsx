import { BarChart3, Coins } from "lucide-react";

import {
  BILLING_MIGRATION_FILE,
  isMissingBillingSchemaError,
  stripeSetupIssues,
} from "@/lib/billing/setup";
import { createClient } from "@/lib/supabase/server";
import { publicBillingOptions } from "@/lib/stripe/products";
import type { Plan, Profile } from "@/types";
import { Badge } from "@/components/ui/badge";
import { BillingActions } from "@/components/billing/BillingActions";
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
  TableCell,
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

interface UsageSummaryRow {
  action: string;
  count: number;
  creditsUsed: number;
}

interface UsageData {
  profile: Profile | null;
  usageRows: UsageSummaryRow[];
  hasBillingCustomer: boolean;
  billingSetupIssues: string[];
}

type UsageProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: string | null;
  credits_balance: number | null;
  credits_reset_at: string | null;
  stripe_customer_id?: string | null;
  created_at: string | null;
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

function monthStartIso() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return monthStart.toISOString();
}

function progressColorClassName(percentRemaining: number) {
  if (percentRemaining > 50) {
    return "bg-emerald-500";
  }

  if (percentRemaining >= 20) {
    return "bg-yellow-500";
  }

  return "bg-red-500";
}

function actionLabel(action: string) {
  return action
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

async function getUsageData(): Promise<UsageData> {
  const baseResult = {
    profile: null,
    usageRows: [],
    hasBillingCustomer: false,
    billingSetupIssues: stripeSetupIssues(),
  } satisfies UsageData;

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return baseResult;
    }

    let billingSchemaReady = true;
    let stripeCustomerId: string | null = null;
    let profileData: UsageProfileRow | null = null;
    let profileError: unknown = null;
    const profileResult = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, plan, credits_balance, credits_reset_at, stripe_customer_id, created_at",
      )
      .eq("id", user.id)
      .single();

    profileData = profileResult.data as UsageProfileRow | null;
    profileError = profileResult.error;

    if (profileError && isMissingBillingSchemaError(profileError)) {
      billingSchemaReady = false;
      console.error(
        `Billing schema is missing. Apply ${BILLING_MIGRATION_FILE}.`,
      );

      const fallbackProfileResult = await supabase
        .from("profiles")
        .select(
          "id, full_name, avatar_url, plan, credits_balance, credits_reset_at, created_at",
        )
        .eq("id", user.id)
        .single();

      profileData = fallbackProfileResult.data as UsageProfileRow | null;
      profileError = fallbackProfileResult.error;
    } else {
      stripeCustomerId =
        typeof profileData?.stripe_customer_id === "string"
          ? profileData.stripe_customer_id
          : null;
    }

    if (profileError || !profileData) {
      console.error("Usage profile lookup failed", profileError);
    }

    const { data: usageData, error: usageError } = await supabase
      .from("usage_logs")
      .select("action, credits_used")
      .eq("user_id", user.id)
      .gte("created_at", monthStartIso());

    if (usageError) {
      console.error("Usage summary lookup failed", usageError);
    }

    const usageMap = new Map<string, UsageSummaryRow>();

    usageData?.forEach((row) => {
      const action = String(row.action);
      const existing = usageMap.get(action) ?? {
        action,
        count: 0,
        creditsUsed: 0,
      };

      existing.count += 1;
      existing.creditsUsed += Number(row.credits_used ?? 0);
      usageMap.set(action, existing);
    });

    const profile = profileData
      ? {
          id: String(profileData.id),
          full_name: profileData.full_name
            ? String(profileData.full_name)
            : null,
          avatar_url: profileData.avatar_url
            ? String(profileData.avatar_url)
            : null,
          plan: (profileData.plan ?? "free") as Plan,
          credits_balance: Number(profileData.credits_balance ?? 30),
          credits_reset_at: String(profileData.credits_reset_at),
          created_at: String(profileData.created_at),
        }
      : fallbackProfile(user.id);

    return {
      profile,
      usageRows: Array.from(usageMap.values()),
      hasBillingCustomer: Boolean(stripeCustomerId),
      billingSetupIssues: [
        ...baseResult.billingSetupIssues,
        ...(billingSchemaReady
          ? []
          : [`Apply ${BILLING_MIGRATION_FILE} to Supabase.`]),
      ],
    };
  } catch (error) {
    console.error("Usage data lookup failed", error);
    return baseResult;
  }
}

export default async function UsagePage() {
  const {
    profile,
    usageRows,
    hasBillingCustomer,
    billingSetupIssues,
  } = await getUsageData();
  const billingOptions = publicBillingOptions();
  const plan = profile?.plan ?? "free";
  const planTotal = planLimits[plan];
  const credits = profile?.credits_balance ?? 0;
  const used = Math.max(0, planTotal - credits);
  const percentRemaining = Math.max(
    0,
    Math.min(100, Math.round((credits / planTotal) * 100)),
  );

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
              {used} used from {planTotal} monthly credits.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-medium text-slate-950">
                {credits} / {planTotal}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${progressColorClassName(percentRemaining)}`}
                style={{ width: `${percentRemaining}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <BillingActions
        creditPacks={billingOptions.creditPacks}
        subscriptionPlans={billingOptions.subscriptionPlans}
        hasBillingCustomer={hasBillingCustomer}
        setupIssues={billingSetupIssues}
      />

      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
          <CardDescription>
            Scope check credit usage grouped by action.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Credits Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageRows.map((row) => (
                  <TableRow key={row.action}>
                    <TableCell className="font-medium text-slate-950">
                      {actionLabel(row.action)}
                    </TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell>{row.creditsUsed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={<BarChart3 className="h-6 w-6" />}
              title="No usage yet"
              description="Run a scope check to create this month's first usage record."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
