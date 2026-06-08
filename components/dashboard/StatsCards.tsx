import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export interface StatCardItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone: "purple" | "blue" | "green" | "amber";
}

const toneClasses: Record<StatCardItem["tone"], string> = {
  purple: "bg-[#534AB7]/10 text-[#534AB7]",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
};

export function StatsCards({ items }: { items: StatCardItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
                {item.value}
              </p>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClasses[item.tone]}`}>
              <item.icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
