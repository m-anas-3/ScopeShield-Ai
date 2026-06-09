import { ExampleWorkflow } from "@/components/landing/ExampleWorkflow";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FinalCTA, PricingCTA } from "@/components/landing/PricingCTA";
import { ProblemSection } from "@/components/landing/ProblemSection";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <Features />
      <ExampleWorkflow />
      <PricingCTA />
      <FinalCTA />
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-slate-700">ScopeShield</p>
          <p>Built for freelancers and agencies protecting scoped work.</p>
        </div>
      </footer>
    </main>
  );
}
