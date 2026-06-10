import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free",
    price: "$0",
    detail: "30 starter credits, then 10 monthly",
    points: ["Create projects", "Lock scopes", "Run first AI checks"],
  },
  {
    name: "Credit packs",
    price: "Flexible",
    detail: "One-time packs for busy client weeks",
    points: ["Credits stack on balance", "Stripe checkout", "Usage history"],
  },
  {
    name: "Agency",
    price: "Custom",
    detail: "For multi-client pipelines",
    points: ["More credits", "Team-ready workflows", "Priority capacity"],
  },
];

export function PricingCTA() {
  return (
    <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-[#534AB7]">
              Pricing and credits
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">
              Start free, then add credits when scope checks become part of
              client delivery.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              ScopeShield uses credits for AI checks so occasional freelancers
              and busy agencies can control usage without guessing.
            </p>
          </div>
          <Button asChild className="bg-[#534AB7] hover:bg-[#463da2]">
            <Link href="/signup">
              Start Free
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="rounded-lg border border-slate-200 bg-slate-50 p-5"
            >
              <p className="text-sm font-semibold text-[#534AB7]">
                {plan.name}
              </p>
              <div className="mt-3 flex items-end gap-2">
                <p className="text-4xl font-bold tracking-normal text-slate-950">
                  {plan.price}
                </p>
                {plan.price === "$0" ? (
                  <p className="pb-1 text-sm text-muted-foreground">/mo</p>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {plan.detail}
              </p>
              <div className="mt-6 space-y-3">
                {plan.points.map((point) => (
                  <div key={point} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-slate-700">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="bg-slate-950 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-normal sm:text-5xl">
          Protect the margin before the extra work begins.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/70">
          ScopeShield gives freelancers and agencies a clear, documented way to
          answer client requests without relying on memory or awkward guesswork.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="bg-white text-slate-950 hover:bg-slate-100"
          >
            <Link href="/signup">
              Start Free
              <ArrowRight />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/25 bg-transparent text-white hover:bg-white hover:text-slate-950"
          >
            <Link href="#how-it-works">See How It Works</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
