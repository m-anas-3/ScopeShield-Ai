import { AlertTriangle, MessageCircleQuestion, ReceiptText } from "lucide-react";

const problems = [
  {
    title: "Small asks become unpaid projects",
    description:
      "A quick add-on can quietly become hours of extra strategy, design, and implementation.",
    icon: AlertTriangle,
  },
  {
    title: "Scope language gets buried",
    description:
      "The clause that protects you is usually somewhere in the proposal, contract, or handoff notes.",
    icon: ReceiptText,
  },
  {
    title: "Replies are awkward under pressure",
    description:
      "Freelancers need to protect margins without sounding defensive or damaging the relationship.",
    icon: MessageCircleQuestion,
  },
];

export function ProblemSection() {
  return (
    <section className="border-b border-slate-200 bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-[#534AB7]">
              The problem
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">
              Scope creep is rarely obvious when it arrives.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Clients usually ask naturally. The risk is deciding from memory
              instead of comparing the ask against the exact agreement.
            </p>
          </div>

          <div className="grid gap-4">
            {problems.map((problem) => (
              <div
                key={problem.title}
                className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[44px_1fr]"
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
