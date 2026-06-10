import {
  FileCheck2,
  FileLock2,
  MessageSquareReply,
  MessageSquareText,
} from "lucide-react";

const steps = [
  {
    label: "Save the scope",
    text: "Add the original scope, deliverables, exclusions, revision limits, and commercial terms.",
    icon: FileCheck2,
  },
  {
    label: "Lock the agreement",
    text: "Freeze the scope before checks run so each request is compared against a stable baseline.",
    icon: FileLock2,
  },
  {
    label: "Analyze the request",
    text: "Paste the client message and get status, risk, estimated hours, and matched evidence.",
    icon: MessageSquareText,
  },
  {
    label: "Send the reply",
    text: "Use a professional draft that explains the boundary and offers the next step clearly.",
    icon: MessageSquareReply,
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-b border-slate-200 bg-slate-950 py-16 text-white sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-indigo-200">
            Workflow
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal sm:text-4xl">
            A repeatable scope check for every client request.
          </h2>
          <p className="mt-4 text-base leading-7 text-white/70">
            Keep the workflow simple enough to use before a call, after an
            email, or when a client drops a new ask into chat.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
