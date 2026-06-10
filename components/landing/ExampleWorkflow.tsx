import { Fragment } from "react";
import {
  ArrowRight,
  FileSearch,
  MailCheck,
  MessageSquareText,
  ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function ExampleWorkflow() {
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-normal text-[#534AB7]">
            Example
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-normal text-slate-950 sm:text-4xl">
            See the full chain of evidence before you reply.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            The result is built for a real freelancer workflow: request, verdict,
            matched clause, and suggested reply.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
          {[
            {
              label: "Client request",
              title: "Add a pricing calculator before launch.",
              text: "The ask sounds simple, but it creates a new interactive feature.",
              icon: MessageSquareText,
            },
            {
              label: "AI verdict",
              title: "Out of scope",
              text: "Medium risk, 6-9 extra hours, change-order recommended.",
              icon: ShieldAlert,
            },
            {
              label: "Matched clause",
              title: "Custom tools are excluded.",
              text: "Interactive quote tools require a separate estimate and approval.",
              icon: FileSearch,
            },
            {
              label: "Suggested reply",
              title: "Set the boundary clearly.",
              text: "Confirm the value, separate it from locked scope, and offer timing.",
              icon: MailCheck,
            },
          ].map((item, index) => (
            <Fragment key={item.label}>
              <div
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <Badge variant="outline">{item.label}</Badge>
                  <item.icon className="h-4 w-4 text-[#534AB7]" />
                </div>
                <h3 className="text-base font-semibold leading-6 text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {item.text}
                </p>
              </div>
              {index < 3 ? (
                <div className="hidden items-center justify-center lg:flex">
                  <ArrowRight className="h-5 w-5 text-slate-400" />
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
