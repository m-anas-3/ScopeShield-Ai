import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative isolate min-h-[680px] overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(83,74,183,0.42),transparent_32%),linear-gradient(135deg,#111827_0%,#1f2937_42%,#0f172a_100%)]" />
      <div className="absolute inset-x-0 bottom-0 top-24 opacity-90">
        <div className="mx-auto grid h-full max-w-6xl grid-cols-1 gap-5 px-4 sm:grid-cols-3">
          <div className="hidden rounded-t-xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur sm:block">
            <div className="mb-4 h-2 w-24 rounded-full bg-white/30" />
            <div className="space-y-3">
              <div className="h-20 rounded-lg bg-white/10" />
              <div className="h-20 rounded-lg bg-emerald-300/20" />
              <div className="h-20 rounded-lg bg-white/10" />
            </div>
          </div>
          <div className="rounded-t-xl border border-white/10 bg-white/15 p-4 shadow-2xl backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div className="h-2 w-28 rounded-full bg-white/40" />
              <div className="h-8 w-8 rounded-full bg-[#534AB7]" />
            </div>
            <div className="space-y-4">
              <div className="rounded-lg bg-white p-4 text-slate-900">
                <div className="mb-3 h-2 w-20 rounded-full bg-slate-200" />
                <div className="space-y-2">
                  <div className="h-2 rounded-full bg-slate-200" />
                  <div className="h-2 w-5/6 rounded-full bg-slate-200" />
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <div className="mb-3 h-2 w-32 rounded-full bg-amber-200" />
                <div className="h-10 rounded-md bg-amber-100" />
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <div className="mb-3 h-2 w-28 rounded-full bg-emerald-200" />
                <div className="h-10 rounded-md bg-emerald-100" />
              </div>
            </div>
          </div>
          <div className="hidden rounded-t-xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur lg:block">
            <div className="mb-4 h-2 w-24 rounded-full bg-white/30" />
            <div className="space-y-3">
              <div className="h-12 rounded-lg bg-white/10" />
              <div className="h-12 rounded-lg bg-white/10" />
              <div className="h-12 rounded-lg bg-[#534AB7]/50" />
              <div className="h-12 rounded-lg bg-white/10" />
            </div>
          </div>
        </div>
      </div>
      <div className="relative mx-auto flex min-h-[680px] max-w-6xl flex-col justify-center px-4 py-20">
        <div className="max-w-3xl">
          <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-medium text-white/90 backdrop-blur">
            Scope creep detection for freelancers
          </p>
          <h1 className="max-w-4xl text-5xl font-bold leading-tight tracking-normal sm:text-6xl lg:text-7xl">
            Stop Losing Money to Scope Creep
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80 sm:text-xl">
            Paste a client request. Know in seconds if it is in scope.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-[#534AB7] hover:bg-[#463da2]">
              <Link href="/signup">
                Get Started Free
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white hover:text-slate-950"
            >
              <Link href="/dashboard">
                <PlayCircle />
                View Demo
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
