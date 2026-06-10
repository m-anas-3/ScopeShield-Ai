import {
  Archive,
  Coins,
  FileSearch,
  Gauge,
  LockKeyhole,
  MailCheck,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    title: "Scope locking",
    description:
      "Freeze the agreed scope before AI checks run, with deliverables and exclusions kept together.",
    icon: LockKeyhole,
  },
  {
    title: "Matched scope clauses",
    description:
      "Surface the exact locked clauses that explain why a request is or is not covered.",
    icon: FileSearch,
  },
  {
    title: "AI scope checks",
    description:
      "Classify requests as in scope, out of scope, or needing clarification.",
    icon: ShieldCheck,
  },
  {
    title: "Risk levels",
    description:
      "Flag low, medium, and high-risk asks before they affect timeline or margin.",
    icon: Gauge,
  },
  {
    title: "Estimated extra hours",
    description:
      "Turn vague client requests into practical effort ranges for change-order conversations.",
    icon: Archive,
  },
  {
    title: "Professional reply",
    description:
      "Draft a calm answer that references scope without sounding stiff or defensive.",
    icon: MailCheck,
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
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-[#534AB7]">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">
            Everything needed to decide before the work starts.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            ScopeShield turns a client message into evidence, a decision, and a
            response your client can act on.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-slate-200 bg-slate-50 p-5"
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
