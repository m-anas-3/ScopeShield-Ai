import { FileCheck2, MailCheck, Zap } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "Instant AI Analysis",
    description:
      "Compare a fresh client request against the original agreement in seconds.",
    icon: Zap,
  },
  {
    title: "Professional Replies",
    description:
      "Turn uncomfortable scope conversations into calm, client-ready messages.",
    icon: MailCheck,
  },
  {
    title: "Change Order Ready",
    description:
      "Capture the request, risk, and estimated effort before work starts.",
    icon: FileCheck2,
  },
];

export function Features() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-bold tracking-normal text-slate-950">
            Catch the hidden work before it becomes unpaid work.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="p-0">
              <CardHeader>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[#534AB7]/10 text-[#534AB7]">
                  <feature.icon className="h-5 w-5" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-6">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
