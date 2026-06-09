import { FileLock2, MessageSquareText, Sparkles } from "lucide-react";

const steps = [
  {
    label: "Lock the agreed scope",
    text: "Save the original scope, deliverables, exclusions, revision limit, and rates before analysis starts.",
    icon: FileLock2,
  },
  {
    label: "Submit the client ask",
    text: "Paste the new message, urgency, client tone, and any context the team needs to consider.",
    icon: MessageSquareText,
  },
  {
    label: "Send a grounded reply",
    text: "Get a verdict, matched clauses, risk level, extra hours, suggested action, and polished response.",
    icon: Sparkles,
  },
];

export function HowItWorks() {
  return (
    <section className="border-y border-slate-200 bg-slate-950 py-20 text-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-indigo-200">
            Workflow
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal sm:text-4xl">
            From client message to confident boundary in minutes.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className="rounded-lg border border-white/10 bg-white/[0.06] p-5"
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#534AB7]">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-semibold text-white/50">
                  0{index + 1}
                </span>
              </div>
              <h3 className="text-lg font-semibold">{step.label}</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
