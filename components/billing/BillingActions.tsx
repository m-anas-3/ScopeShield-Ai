"use client";

import { useState } from "react";
import { ArrowRight, CreditCard, Loader2, PackagePlus } from "lucide-react";
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-[#534AB7]" />
              <CardTitle>Buy Credits</CardTitle>
            </div>
            <CardDescription className="mt-2">
              {hasSetupIssues
                ? setupIssues.join(" ")
                : "One-time packs are added to your balance after the Stripe webhook succeeds."}
            </CardDescription>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
            AI scope checks use credits
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {creditPacks.map((pack) => {
          const actionKey = `credits:${pack.key}` as PendingAction;
          const isPending = pendingAction === actionKey;

          return (
            <Button
              key={pack.key}
              type="button"
              variant="outline"
              className="h-auto min-h-32 justify-between gap-4 rounded-lg border-slate-200 bg-white p-4 text-left hover:border-[#534AB7]/40 hover:bg-slate-50"
              disabled={!pack.enabled || hasSetupIssues || pendingAction !== null}
              onClick={() => handleCreditCheckout(pack.key)}
            >
              <span className="min-w-0">
                <span className="block text-base font-semibold text-slate-950">
                  {pack.label}
                </span>
                <span className="mt-2 block text-3xl font-bold tracking-normal text-slate-950">
                  {pack.credits}
                </span>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  {pack.setupError ?? `credits - ${pack.description}`}
                </span>
              </span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#534AB7]/10 text-[#534AB7]">
                {isPending ? (
                  <Loader2 className="animate-spin" />
                ) : pack.enabled && !hasSetupIssues ? (
                  <ArrowRight />
                ) : (
                  <CreditCard />
                )}
              </span>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
