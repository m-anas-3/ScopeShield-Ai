import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export interface StatCardItem {
  label: string;
  value: string | number;
  helper?: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "amber" | "red" | "slate";
}

const toneClasses: Record<StatCardItem["tone"], string> = {
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-700",
};

export function StatsCards({ items }: { items: StatCardItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.label}
          className="overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-muted-foreground">
                {item.label}
              </p>
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClasses[item.tone]}`}
              >
                <item.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-5">
              <p className="text-2xl font-semibold tracking-normal text-slate-950">
                {item.value}
              </p>
              {item.helper ? (
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
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
