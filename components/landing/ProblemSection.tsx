import { AlertTriangle, MessageCircleQuestion, ReceiptText } from "lucide-react";

const problems = [
  {
    title: "Small asks turn into unpaid work",
    description:
      "A casual add-on can become hours of strategy, design, revision, or implementation.",
    icon: AlertTriangle,
  },
  {
    title: "Protective clauses get buried",
    description:
      "The agreement language you need is usually hidden across proposals, notes, and exclusions.",
    icon: ReceiptText,
  },
  {
    title: "Boundary-setting is hard in the moment",
    description:
      "You need to protect margin without sounding defensive or slowing the client relationship.",
    icon: MessageCircleQuestion,
  },
];

export function ProblemSection() {
  return (
    <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-[#534AB7]">
              The problem
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">
              Scope creep usually starts as a reasonable-sounding request.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              ScopeShield gives you a practical check before you say yes,
              absorb the work, or reopen the whole contract manually.
            </p>
          </div>

          <div className="grid gap-4">
            {problems.map((problem) => (
              <div
                key={problem.title}
                className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5 sm:grid-cols-[44px_1fr]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <problem.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-950">
                    {problem.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {problem.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
