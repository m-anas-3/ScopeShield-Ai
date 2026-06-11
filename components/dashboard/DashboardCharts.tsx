"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface DashboardBreakdownDatum {
  label: string;
  value: number;
  color: string;
}

export interface DashboardTrendDatum {
  label: string;
  value: number;
}

interface DashboardChartsProps {
  scopeStatusData: DashboardBreakdownDatum[];
  riskLevelData: DashboardBreakdownDatum[];
  creditUsageData: DashboardTrendDatum[];
}

interface TooltipPayload {
  name?: string;
  value?: number | string;
  payload?: {
    label?: string;
  };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const firstItem = payload[0];
  const tooltipLabel = firstItem.payload?.label ?? label;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-slate-950">{tooltipLabel}</p>
      <p className="mt-1 text-muted-foreground">
        {firstItem.value ?? 0} {Number(firstItem.value ?? 0) === 1 ? "check" : "checks"}
      </p>
    </div>
  );
}

function CreditTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const value = Number(payload[0].value ?? 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-slate-950">{label}</p>
      <p className="mt-1 text-muted-foreground">
        {value} {value === 1 ? "credit" : "credits"} used
      </p>
    </div>
  );
}

function EmptyChart({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  );
}

function BreakdownChart({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: DashboardBreakdownDatum[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {total > 0 ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 16, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
                  {data.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="top"
                    className="fill-slate-700 text-xs"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart>Run scope checks to populate this chart.</EmptyChart>
        )}
      </CardContent>
    </Card>
  );
}

function CreditUsageChart({ data }: { data: DashboardTrendDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base">Credit Usage Trend</CardTitle>
        <CardDescription>Credits consumed by checks over the last seven days.</CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-0">
        {total > 0 ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 16, right: 12, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip content={<CreditTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2, fill: "#fff" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyChart>No credits used in the last seven days.</EmptyChart>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardCharts({
  scopeStatusData,
  riskLevelData,
  creditUsageData,
}: DashboardChartsProps) {
  return (
    <section aria-labelledby="dashboard-charts-heading" className="space-y-4">
      <div>
        <h2 id="dashboard-charts-heading" className="text-lg font-semibold text-slate-950">
          Scope Insights
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent check outcomes, risk distribution, and credit usage.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownChart
          title="Scope Checks by Status"
          description="Outcomes from the last 30 days."
          data={scopeStatusData}
        />
        <BreakdownChart
          title="Risk Level Breakdown"
          description="AI-assigned risk across recent checks."
          data={riskLevelData}
        />
        <CreditUsageChart data={creditUsageData} />
      </div>
    </section>
  );
}
