import { BarChart3, Coins, CreditCard, Gift, ReceiptText } from "lucide-react";

import {
  BILLING_MIGRATION_FILE,
  isMissingBillingSchemaError,
  stripeSetupIssues,
} from "@/lib/billing/setup";
import { grantMonthlyFreeCredits, STARTER_CREDITS } from "@/lib/credits/monthly";
import { createClient } from "@/lib/supabase/server";
import { publicBillingOptions } from "@/lib/stripe/products";
import type { Plan, Profile } from "@/types";
import { BillingActions } from "@/components/billing/BillingActions";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";

interface UsageSummaryRow {
  action: string;
  count: number;
  creditsUsed: number;
}

interface UsageData {
  profile: Profile | null;
  usageRows: UsageSummaryRow[];
  ledgerSummary: CreditLedgerSummary;
  billingSetupIssues: string[];
}

interface CreditLedgerRow {
  direction: string;
  source: string;
  credits: number | null;
  created_at: string | null;
}

interface CreditLedgerSummary {
  starterCredits: number;
  monthlyFreeThisMonth: number;
  purchasedCredits: number;
  subscriptionCredits: number;
  spentCredits: number;
  refundedCredits: number;
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
    credits_balance: STARTER_CREDITS,
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

function actionLabel(action: string) {
  return action
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function emptyLedgerSummary(): CreditLedgerSummary {
  return {
    starterCredits: 0,
    monthlyFreeThisMonth: 0,
    purchasedCredits: 0,
    subscriptionCredits: 0,
    spentCredits: 0,
    refundedCredits: 0,
  };
}

function summarizeLedger(rows: CreditLedgerRow[]): CreditLedgerSummary {
  const summary = emptyLedgerSummary();
  const monthStart = monthStartIso();

  rows.forEach((row) => {
    const credits = Number(row.credits ?? 0);

    if (row.source === "starter" && row.direction === "credit") {
      summary.starterCredits += credits;
    }

    if (
      row.source === "monthly_free" &&
      row.direction === "credit" &&
      String(row.created_at ?? "") >= monthStart
    ) {
      summary.monthlyFreeThisMonth += credits;
    }

    if (row.source === "purchase" && row.direction === "credit") {
      summary.purchasedCredits += credits;
    }

    if (row.source === "subscription" && row.direction === "credit") {
      summary.subscriptionCredits += credits;
    }

    if (row.source === "scope_check" && row.direction === "debit") {
      summary.spentCredits += credits;
    }

    if (row.source === "refund" && row.direction === "credit") {
      summary.refundedCredits += credits;
    }
  });

  return summary;
}

async function getUsageData(): Promise<UsageData> {
  const baseResult = {
    profile: null,
    usageRows: [],
    ledgerSummary: emptyLedgerSummary(),
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

    await grantMonthlyFreeCredits(user.id);

    let billingSchemaReady = true;
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

    let ledgerSummary = emptyLedgerSummary();
    const { data: ledgerData, error: ledgerError } = await supabase
      .from("credit_ledger_entries")
      .select("direction, source, credits, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (ledgerError) {
      if (isMissingBillingSchemaError(ledgerError)) {
        billingSchemaReady = false;
      } else {
        console.error("Credit ledger lookup failed", ledgerError);
      }
    } else {
      ledgerSummary = summarizeLedger((ledgerData ?? []) as CreditLedgerRow[]);
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
          credits_balance: Number(
            profileData.credits_balance ?? STARTER_CREDITS,
          ),
          credits_reset_at: String(profileData.credits_reset_at),
          created_at: String(profileData.created_at),
        }
      : fallbackProfile(user.id);

    return {
      profile,
      usageRows: Array.from(usageMap.values()),
      ledgerSummary,
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

export default async function UsagePage({
  searchParams,
}: {
  searchParams?: { checkout?: string };
}) {
  const { profile, usageRows, ledgerSummary, billingSetupIssues } =
    await getUsageData();
  const billingOptions = publicBillingOptions();
  const credits = profile?.credits_balance ?? 0;
  const plan = profile?.plan ?? "free";
  const creditsUsedThisMonth = usageRows.reduce(
    (total, row) => total + row.creditsUsed,
    0,
  );
  const paidCredits =
    ledgerSummary.purchasedCredits + ledgerSummary.subscriptionCredits;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-normal text-slate-950">
          Usage
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credit balance and check history for this month.
        </p>
      </div>

      {searchParams?.checkout === "success" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Checkout completed. Credits appear here after Stripe confirms payment
          through the verified webhook.
        </div>
      ) : null}

      {searchParams?.checkout === "cancelled" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Checkout was cancelled. No credits were added or charged.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Credit Balance</CardTitle>
            <CardDescription>Available credits for AI checks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Gift className="h-5 w-5 text-emerald-600" />
              <CardTitle>Free Credits</CardTitle>
            </div>
            <CardDescription>Starter and monthly free grants.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tracking-normal text-slate-950">
              {ledgerSummary.monthlyFreeThisMonth}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              monthly credits granted
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {ledgerSummary.starterCredits || STARTER_CREDITS} starter credits
              on signup.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#534AB7]" />
              <CardTitle>Paid Credits</CardTitle>
            </div>
            <CardDescription>Credits added by Stripe events.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tracking-normal text-slate-950">
              {paidCredits}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              purchased or subscription credits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-[#534AB7]" />
              <CardTitle>Monthly Usage</CardTitle>
            </div>
            <CardDescription>Credits spent on checks this month.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tracking-normal text-slate-950">
              {creditsUsedThisMonth}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">credits used</p>
            {ledgerSummary.refundedCredits > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {ledgerSummary.refundedCredits} credits refunded after failed
                checks.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-slate-700" />
            <CardTitle>Billing Status</CardTitle>
          </div>
          <CardDescription>
            Credit grants are fulfilled server-side after verified events.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge variant="outline" className="capitalize">
              {plan}
            </Badge>
            <p className="mt-2 text-sm text-muted-foreground">
              Free users receive 10 monthly credits after the signup month.
              Purchased credits stack on top of the current balance.
            </p>
          </div>
          {billingSetupIssues.length > 0 ? (
            <p className="max-w-xl text-sm text-amber-700">
              {billingSetupIssues.join(" ")}
            </p>
          ) : (
            <p className="text-sm text-emerald-700">Stripe billing is configured.</p>
          )}
        </CardContent>
      </Card>

      <BillingActions
        creditPacks={billingOptions.creditPacks}
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
