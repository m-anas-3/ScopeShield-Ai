import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function ProductPreview() {
  return (
    <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-200/70">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-950">
              Website redesign scope check
            </p>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
              <LockKeyhole className="mr-1 h-3 w-3" />
              Scope locked
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Client request compared against 6 matched clauses
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
          <WalletCards className="h-4 w-4 text-[#534AB7]" />
          8 credits used
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge className="border-red-200 bg-white text-red-700">
                Out of scope
              </Badge>
              <Badge className="border-amber-200 bg-amber-50 text-amber-700">
                Medium risk
              </Badge>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-normal text-slate-950">
              6-9 extra hours
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              The request adds a new pricing calculator that was not part of the
              locked page-build deliverables.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                <FileText className="h-4 w-4 text-[#534AB7]" />
                Matched clause
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Deliverables include five responsive marketing pages, CMS setup,
                and launch handoff notes.
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Clock3 className="h-4 w-4 text-[#534AB7]" />
                Suggested action
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Confirm the request, separate it from the current scope, and
                offer a paid change order before starting.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <MessageSquareText className="h-4 w-4 text-[#534AB7]" />
              Reply draft
            </div>
            <div className="space-y-3 text-sm leading-6 text-slate-700">
              <p>Hi Jordan, thanks for sending this over.</p>
              <p>
                The pricing calculator is a valuable addition, but it sits
                outside the locked scope for the five-page redesign. I can quote
                it as a separate change request and share timing before we begin.
              </p>
              <p>
                If you want, I can send a short estimate today and keep the
                original launch plan moving.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Status", "Out of scope"],
              ["Evidence", "6 clauses"],
              ["Saved", "History log"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 bg-white p-3"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="overflow-hidden border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_58%,#f1f5f9_100%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#534AB7] text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-base font-bold tracking-normal text-slate-950">
            ScopeShield
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="bg-[#534AB7] hover:bg-[#463da2]">
            <Link href="/signup">Start free</Link>
          </Button>
        </nav>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-12 pt-10 sm:pb-16 lg:pt-14">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Scope creep protection for freelancers and agencies
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-normal text-slate-950 sm:text-6xl lg:text-7xl">
            Know when a client ask becomes paid extra work.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Lock the original scope, paste a new client request, and get a
            grounded verdict with matched clauses, risk, hours, and a polished
            reply draft.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="bg-[#534AB7] hover:bg-[#463da2]"
            >
              <Link href="/signup">
                Protect my scope
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>

        <div className="mt-10 sm:mt-12">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
