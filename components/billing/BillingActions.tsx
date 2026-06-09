"use client";

import { useState } from "react";
import { CreditCard, Loader2, PackagePlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BillingOption {
  key: string;
  label: string;
  description: string;
  credits: number;
  enabled: boolean;
  setupError: string | null;
}

interface BillingActionsProps {
  creditPacks: BillingOption[];
  subscriptionPlans: BillingOption[];
  hasBillingCustomer: boolean;
  setupIssues: string[];
}

type PendingAction =
  | `credits:${string}`
  | `subscription:${string}`
  | "portal"
  | null;

async function postBillingAction(url: string, body?: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = (await response.json()) as { url?: string; error?: string };

  if (!response.ok || !result.url) {
    throw new Error(result.error ?? "Billing request failed.");
  }

  window.location.href = result.url;
}

export function BillingActions({
  creditPacks,
  subscriptionPlans,
  hasBillingCustomer,
  setupIssues,
}: BillingActionsProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const hasSetupIssues = setupIssues.length > 0;

  async function handleCheckout(
    checkoutType: "credits" | "subscription",
    itemKey: string,
  ) {
    const actionKey = `${checkoutType}:${itemKey}` as PendingAction;
    setPendingAction(actionKey);

    try {
      await postBillingAction("/api/stripe/checkout", {
        checkoutType,
        itemKey,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed.");
      setPendingAction(null);
    }
  }

  async function handlePortal() {
    setPendingAction("portal");

    try {
      await postBillingAction("/api/stripe/portal");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Billing portal failed.",
      );
      setPendingAction(null);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-[#534AB7]" />
            <CardTitle>Buy Credits</CardTitle>
          </div>
          <CardDescription>
            {hasSetupIssues
              ? setupIssues.join(" ")
              : "One-time packs added to your balance."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {creditPacks.map((pack) => {
            const actionKey = `credits:${pack.key}` as PendingAction;
            const isPending = pendingAction === actionKey;

            return (
              <Button
                key={pack.key}
                type="button"
                variant="outline"
                className="h-auto w-full justify-between gap-4 py-3 text-left"
                disabled={!pack.enabled || hasSetupIssues || pendingAction !== null}
                onClick={() => handleCheckout("credits", pack.key)}
              >
                <span>
                  <span className="block font-semibold">{pack.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {pack.setupError ?? `${pack.credits} credits · ${pack.description}`}
                  </span>
                </span>
                {isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CreditCard />
                )}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-[#534AB7]" />
            <CardTitle>Monthly Plans</CardTitle>
          </div>
          <CardDescription>
            {hasSetupIssues
              ? setupIssues.join(" ")
              : "Recurring credits fulfilled by Stripe."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscriptionPlans.map((plan) => {
            const actionKey = `subscription:${plan.key}` as PendingAction;
            const isPending = pendingAction === actionKey;

            return (
              <Button
                key={plan.key}
                type="button"
                variant="outline"
                className="h-auto w-full justify-between gap-4 py-3 text-left"
                disabled={!plan.enabled || hasSetupIssues || pendingAction !== null}
                onClick={() => handleCheckout("subscription", plan.key)}
              >
                <span>
                  <span className="block font-semibold">{plan.label}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {plan.setupError ??
                      `${plan.credits} credits/month · ${plan.description}`}
                  </span>
                </span>
                {isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CreditCard />
                )}
              </Button>
            );
          })}

          {hasBillingCustomer ? (
            <Button
              type="button"
              className="w-full"
              disabled={hasSetupIssues || pendingAction !== null}
              onClick={handlePortal}
            >
              {pendingAction === "portal" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CreditCard />
              )}
              Manage Billing
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
