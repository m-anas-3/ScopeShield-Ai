import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PricingCTA() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-normal text-slate-950">
            Start free. Upgrade when scope checks pay for themselves.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Free includes 30 checks per month. Pro is $19 per month for freelancers
            who want more room to protect bigger client pipelines.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-slate-50 p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-lg bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground">Free</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">30 checks/mo</p>
            </div>
            <div className="rounded-lg bg-white p-4">
              <p className="text-sm font-medium text-muted-foreground">Pro</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">$19/mo</p>
            </div>
          </div>
          <Button asChild className="mt-5 w-full">
            <Link href="/signup">
              Get Started Free
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
