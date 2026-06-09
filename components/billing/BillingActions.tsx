"use client";

import { useState } from "react";
import { CreditCard, Loader2, PackagePlus } from "lucide-react";
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
  setupIssues: string[];
}

type PendingAction = `credits:${string}` | null;

async function postBillingAction(url: string, body: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as { url?: string; error?: string };

  if (!response.ok || !result.url) {
    throw new Error(result.error ?? "Billing request failed.");
  }

  window.location.href = result.url;
}

export function BillingActions({ creditPacks, setupIssues }: BillingActionsProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const hasSetupIssues = setupIssues.length > 0;

  async function handleCreditCheckout(itemKey: string) {
    const actionKey = `credits:${itemKey}` as PendingAction;
    setPendingAction(actionKey);

    try {
      await postBillingAction("/api/stripe/checkout", {
        checkoutType: "credits",
        itemKey,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed.");
      setPendingAction(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PackagePlus className="h-5 w-5 text-[#534AB7]" />
          <CardTitle>Buy Credits</CardTitle>
        </div>
        <CardDescription>
          {hasSetupIssues
            ? setupIssues.join(" ")
            : "One-time packs added to your balance after the Stripe webhook succeeds."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {creditPacks.map((pack) => {
          const actionKey = `credits:${pack.key}` as PendingAction;
          const isPending = pendingAction === actionKey;

          return (
            <Button
              key={pack.key}
              type="button"
              variant="outline"
              className="h-auto justify-between gap-4 py-3 text-left"
              disabled={!pack.enabled || hasSetupIssues || pendingAction !== null}
              onClick={() => handleCreditCheckout(pack.key)}
            >
              <span>
                <span className="block font-semibold">{pack.label}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {pack.setupError ?? `${pack.credits} credits · ${pack.description}`}
                </span>
              </span>
              {isPending ? <Loader2 className="animate-spin" /> : <CreditCard />}
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
