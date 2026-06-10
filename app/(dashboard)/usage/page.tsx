import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  Coins,
  CreditCard,
  Gift,
  PackagePlus,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import {
  BILLING_MIGRATION_FILE,
  isMissingBillingSchemaError,
  stripeSetupIssues,
} from "@/lib/billing/setup";
import { grantMonthlyFreeCredits, STARTER_CREDITS } from "@/lib/credits/monthly";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { publicBillingOptions } from "@/lib/stripe/products";
import type { Profile } from "@/types";
import { BillingActions } from "@/components/billing/BillingActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  spentCredits: number;
  refundedCredits: number;
}

type UsageProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
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
        "id, full_name, avatar_url, credits_balance, credits_reset_at, stripe_customer_id, created_at",
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
          "id, full_name, avatar_url, credits_balance, credits_reset_at, created_at",
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
  const creditsUsedThisMonth = usageRows.reduce(
    (total, row) => total + row.creditsUsed,
    0,
  );
  const paidCredits = ledgerSummary.purchasedCredits;
  const trackedCredits = Math.max(credits + creditsUsedThisMonth, 1);
  const balancePercent = Math.round((credits / trackedCredits) * 100);
  const sortedUsageRows = [...usageRows].sort(
    (a, b) => b.creditsUsed - a.creditsUsed,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Badge variant="outline" className="mb-3 bg-white">
            Usage and billing
          </Badge>
          <h1 className="text-3xl font-bold tracking-normal text-slate-950">
            Credits
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Understand your balance, monthly spend, and available credit packs.
          </p>
        </div>
        <Button asChild>
          <Link href="#credit-packs">
            <PackagePlus />
            Buy Credits
          </Link>
        </Button>
      </div>

      {searchParams?.checkout === "success" ? (
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Checkout completed. Credits appear here after Stripe confirms
            payment through the verified webhook.
          </span>
        </div>
      ) : null}

      {searchParams?.checkout === "cancelled" ? (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ReceiptText className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Checkout was cancelled. No credits were added or charged.</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-slate-950 p-6 text-white">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <WalletCards className="h-4 w-4" />
                    Available balance
                  </div>
                  <p className="mt-4 text-5xl font-bold tracking-normal">
                    {credits}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    credits ready for AI scope checks
                  </p>
                </div>
                <Badge className="border-white/15 bg-white/10 text-white">
                  Credit balance
                </Badge>
              </div>
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-xs text-white/70">
                  <span>Balance vs. this month usage</span>
                  <span>{balancePercent}% available</span>
                </div>
                <div className="h-2 rounded-full bg-white/15">
                  <div
                    className="h-2 rounded-full bg-emerald-400"
                    style={{ width: `${balancePercent}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-0 border-t border-slate-200 sm:grid-cols-3">
              <div className="border-b border-slate-200 p-5 sm:border-b-0 sm:border-r">
                <p className="text-sm text-muted-foreground">Monthly used</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {creditsUsedThisMonth}
                </p>
              </div>
              <div className="border-b border-slate-200 p-5 sm:border-b-0 sm:border-r">
                <p className="text-sm text-muted-foreground">Free this month</p>
                <p className="mt-2 text-2xl font-bold text-slate-950">
                  {ledgerSummary.monthlyFreeThisMonth}
                </p>
              </div>
              <div className="p-5">
                <p className="text-sm text-muted-foreground">Next reset</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {profile?.credits_reset_at
                    ? formatDate(profile.credits_reset_at)
                    : "Not scheduled"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-slate-700" />
              <CardTitle>Billing Status</CardTitle>
            </div>
            <CardDescription>
              Credit grants are fulfilled after verified Stripe events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-muted-foreground">Paid credits</span>
                <span className="font-semibold text-slate-950">
                  {paidCredits}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-muted-foreground">Refunded credits</span>
                <span className="font-semibold text-slate-950">
                  {ledgerSummary.refundedCredits}
                </span>
              </div>
            </div>
            {billingSetupIssues.length > 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
                {billingSetupIssues.join(" ")}
              </p>
            ) : (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Stripe billing is configured.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-medium text-muted-foreground">
                Starter credits
              </p>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {ledgerSummary.starterCredits || STARTER_CREDITS}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Included when a user signs up.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#534AB7]" />
              <p className="text-sm font-medium text-muted-foreground">
                Purchased credits
              </p>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {ledgerSummary.purchasedCredits}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              One-time packs added by checkout.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-[#534AB7]" />
              <p className="text-sm font-medium text-muted-foreground">
                Credits spent
              </p>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-950">
              {ledgerSummary.spentCredits}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total check usage recorded in the ledger.
            </p>
          </CardContent>
        </Card>
      </div>

      <div id="credit-packs">
        <BillingActions
          creditPacks={billingOptions.creditPacks}
          setupIssues={billingSetupIssues}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-700" />
            <CardTitle>Usage This Month</CardTitle>
          </div>
          <CardDescription>
            Scope check credit usage grouped by action.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedUsageRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Credits Used</TableHead>
                  <TableHead>Average</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUsageRows.map((row) => (
                  <TableRow key={row.action}>
                    <TableCell className="font-medium text-slate-950">
                      {actionLabel(row.action)}
                    </TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell>{row.creditsUsed}</TableCell>
                    <TableCell>
                      {row.count > 0
                        ? `${Math.round(row.creditsUsed / row.count)} credits`
                        : "0 credits"}
                    </TableCell>
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
