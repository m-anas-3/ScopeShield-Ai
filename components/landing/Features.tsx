import {
  Archive,
  Coins,
  FileSearch,
  Gauge,
  MailCheck,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    title: "Matched scope clauses",
    description:
      "Retrieves the locked clauses most relevant to the new request before analysis.",
    icon: FileSearch,
  },
  {
    title: "Grounded AI verdicts",
    description:
      "Classifies each ask as in scope, out of scope, or needing clarification.",
    icon: ShieldCheck,
  },
  {
    title: "Client-ready replies",
    description:
      "Drafts calm, professional responses for confirmations, questions, and change orders.",
    icon: MailCheck,
  },
  {
    title: "Risk and hours",
    description:
      "Estimates added effort and flags deadline or delivery risk before work starts.",
    icon: Gauge,
  },
  {
    title: "Project history",
    description:
      "Keeps every check attached to the right project for later reference.",
    icon: Archive,
  },
  {
    title: "Credit tracking",
    description:
      "Shows usage clearly so teams know what each AI analysis costs.",
    icon: Coins,
  },
];

export function Features() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-[#534AB7]">
            Product
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">
            Built for the exact moment a client asks for one more thing.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            ScopeShield turns a vague request into evidence, a decision, and a
            reply your client can understand.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-[#534AB7]">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-950">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
