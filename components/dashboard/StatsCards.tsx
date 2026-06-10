import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export interface StatCardItem {
  label: string;
  value: string | number;
  helper?: string;
  icon: LucideIcon;
  tone: "purple" | "blue" | "green" | "amber" | "red" | "slate";
}

const toneClasses: Record<StatCardItem["tone"], string> = {
  purple: "bg-[#534AB7]/10 text-[#534AB7]",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-700",
};

export function StatsCards({ items }: { items: StatCardItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="overflow-hidden">
          <CardContent className="flex min-h-36 flex-col justify-between p-5">
            <div className="flex items-start justify-between gap-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClasses[item.tone]}`}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {item.label}
              </p>
            </div>
            <div>
              <p className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
                {item.value}
              </p>
              {item.helper ? (
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.helper}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
