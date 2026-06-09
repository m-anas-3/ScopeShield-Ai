import { ArrowRight, CheckCircle2, FileSearch, MailCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function ExampleWorkflow() {
  return (
    <section className="bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-[#534AB7]">
            Example
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">
            The answer includes the evidence, not just a label.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            ScopeShield gives the freelancer enough context to decide, document,
            and respond without reopening the whole contract.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.85fr_0.3fr_0.85fr] lg:items-center">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="outline">Client request</Badge>
            </div>
            <p className="text-lg font-semibold leading-7 text-slate-950">
              Add a pricing calculator to the new site before launch.
            </p>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Locked scope
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Five marketing pages, CMS setup, responsive QA, launch handoff.
                Custom app features excluded unless quoted separately.
              </p>
            </div>
          </div>

          <div className="hidden justify-center lg:flex">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#534AB7] shadow-sm">
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge className="border-red-200 bg-red-50 text-red-700">
                Out of scope
              </Badge>
              <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                Medium risk
              </Badge>
              <Badge variant="secondary">6-9 hours</Badge>
            </div>
            <div className="grid gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <FileSearch className="h-4 w-4 text-[#534AB7]" />
                  Matched clause
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Custom calculators and interactive quote tools are excluded
                  from the base website package.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <MailCheck className="h-4 w-4 text-[#534AB7]" />
                  Reply direction
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Acknowledge the request, explain it is separate from the
                  locked scope, and offer a change-order estimate.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Stored with the project history and credit usage
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
