import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Coins,
  CreditCard,
  FileLock2,
  FolderKanban,
  Gauge,
  MessageSquareText,
  Plus,
  SearchX,
} from "lucide-react";

import { grantMonthlyFreeCredits, STARTER_CREDITS } from "@/lib/credits/monthly";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { RiskLevel, ScopeStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatsCards, type StatCardItem } from "@/components/dashboard/StatsCards";

interface RecentCheck {
  id: string;
  projectName: string;
  clientRequest: string;
  scopeStatus: ScopeStatus | null;
  riskLevel: RiskLevel | null;
  estimatedHoursMin: number | null;
  estimatedHoursMax: number | null;
  creditsUsed: number;
  createdAt: string;
}

interface AggregateCheck {
  scopeStatus: ScopeStatus | null;
  riskLevel: RiskLevel | null;
  estimatedHoursMax: number | null;
  creditsUsed: number;
  createdAt: string;
}

interface TrendPoint {
  label: string;
  value: number;
}

interface BreakdownItem {
  label: string;
  value: number;
  barClassName: string;
}

interface DashboardData {
  totalProjects: number;
  projectsNotLocked: number;
  checksThisMonth: number;
  outOfScopeCaught: number;
  creditsRemaining: number;
  highRiskRequests: number;
  estimatedExtraHours: number;
  recentChecks: RecentCheck[];
  scopeStatusDistribution: BreakdownItem[];
  riskBreakdown: BreakdownItem[];
  checksTrend: TrendPoint[];
  creditTrend: TrendPoint[];
}

function monthStartIso() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return monthStart.toISOString();
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function scopeStatusLabel(status: ScopeStatus | null) {
  switch (status) {
    case "in_scope":
      return "In Scope";
    case "out_of_scope":
      return "Out of Scope";
    case "needs_clarification":
      return "Needs Clarification";
    default:
      return "Unknown";
  }
}

function scopeStatusClassName(status: ScopeStatus | null) {
  switch (status) {
    case "in_scope":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "out_of_scope":
      return "border-red-200 bg-red-50 text-red-700";
    case "needs_clarification":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function riskClassName(risk: RiskLevel | null) {
  switch (risk) {
    case "low":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "medium":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "high":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

function hoursLabel(check: {
  estimatedHoursMin: number | null;
  estimatedHoursMax: number | null;
}) {
  const min = check.estimatedHoursMin ?? 0;
  const max = check.estimatedHoursMax ?? 0;

  if (min === 0 && max === 0) {
    return "No extra work";
  }

  return `${min}-${max} hrs`;
}

function projectNameFromRelation(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as Record<string, unknown> | undefined;
    return typeof first?.name === "string" ? first.name : "Unknown project";
  }

  if (value && typeof value === "object") {
    const project = value as Record<string, unknown>;
    return typeof project.name === "string" ? project.name : "Unknown project";
  }

  return "Unknown project";
}

function buildBreakdowns(rows: AggregateCheck[]) {
  const countStatus = (status: ScopeStatus) =>
    rows.filter((row) => row.scopeStatus === status).length;
  const countRisk = (risk: RiskLevel) =>
    rows.filter((row) => row.riskLevel === risk).length;

  return {
    scopeStatusDistribution: [
      {
        label: "In scope",
        value: countStatus("in_scope"),
        barClassName: "bg-emerald-500",
      },
      {
        label: "Out of scope",
        value: countStatus("out_of_scope"),
        barClassName: "bg-red-500",
      },
      {
        label: "Needs clarity",
        value: countStatus("needs_clarification"),
        barClassName: "bg-amber-500",
      },
    ],
    riskBreakdown: [
      { label: "Low", value: countRisk("low"), barClassName: "bg-blue-500" },
      {
        label: "Medium",
        value: countRisk("medium"),
        barClassName: "bg-orange-500",
      },
      { label: "High", value: countRisk("high"), barClassName: "bg-red-500" },
    ],
  };
}

function buildDailyTrend(
  rows: AggregateCheck[],
  days: number,
  valueForRow: (row: AggregateCheck) => number,
) {
  const formatter = new Intl.DateTimeFormat("en", { weekday: "short" });
  const points = Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (days - index - 1));
    date.setUTCHours(0, 0, 0, 0);
    const key = date.toISOString().slice(0, 10);

    return {
      key,
      label: formatter.format(date),
      value: 0,
    };
  });
  const pointMap = new Map(points.map((point) => [point.key, point]));

  rows.forEach((row) => {
    const point = pointMap.get(row.createdAt.slice(0, 10));

    if (point) {
      point.value += valueForRow(row);
    }
  });

  return points.map(({ label, value }) => ({ label, value }));
}

function emptyDashboardData(): DashboardData {
  const { scopeStatusDistribution, riskBreakdown } = buildBreakdowns([]);

  return {
    totalProjects: 0,
    projectsNotLocked: 0,
    checksThisMonth: 0,
    outOfScopeCaught: 0,
    creditsRemaining: 0,
    highRiskRequests: 0,
    estimatedExtraHours: 0,
    recentChecks: [],
    scopeStatusDistribution,
    riskBreakdown,
    checksTrend: buildDailyTrend([], 7, () => 0),
    creditTrend: buildDailyTrend([], 7, () => 0),
  };
}

async function getDashboardData(): Promise<DashboardData> {
  const monthStart = monthStartIso();
  const thirtyDaysAgo = daysAgoIso(30);
  const aggregateStart = monthStart < thirtyDaysAgo ? monthStart : thirtyDaysAgo;
  const emptyData = emptyDashboardData();

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return emptyData;
    }

    await grantMonthlyFreeCredits(user.id);

    const [
      projectsResult,
      unlockedProjectsResult,
      checksResult,
      outOfScopeResult,
      highRiskResult,
      profileResult,
      recentResult,
      aggregateResult,
    ] = await Promise.all([
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("scope_locked", false),
      supabase
        .from("scope_checks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart),
      supabase
        .from("scope_checks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("scope_status", "out_of_scope"),
      supabase
        .from("scope_checks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("risk_level", "high"),
      supabase
        .from("profiles")
        .select("credits_balance")
        .eq("id", user.id)
        .single(),
      supabase
        .from("scope_checks")
        .select(
          "id, client_request, scope_status, risk_level, estimated_hours_min, estimated_hours_max, credits_used, created_at, project:projects!scope_checks_project_owner_fk(name)",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("scope_checks")
        .select(
          "scope_status, risk_level, estimated_hours_max, credits_used, created_at",
        )
        .eq("user_id", user.id)
        .gte("created_at", aggregateStart)
        .order("created_at", { ascending: false }),
    ]);

    const queryErrors: Array<[string, unknown]> = [
      ["Project count", projectsResult.error],
      ["Unlocked project count", unlockedProjectsResult.error],
      ["Monthly checks count", checksResult.error],
      ["Out-of-scope count", outOfScopeResult.error],
      ["High-risk count", highRiskResult.error],
      ["Credits lookup", profileResult.error],
      ["Recent checks lookup", recentResult.error],
      ["Dashboard aggregate lookup", aggregateResult.error],
    ];

    queryErrors.forEach(([label, error]) => {
      if (error) {
        console.error(`${label} failed`, error);
      }
    });

    const recentChecks =
      recentResult.data?.map((row) => {
        const record = row as Record<string, unknown>;

        return {
          id: String(record.id),
          projectName: projectNameFromRelation(record.project),
          clientRequest: String(record.client_request ?? ""),
          scopeStatus: (record.scope_status ?? null) as ScopeStatus | null,
          riskLevel: (record.risk_level ?? null) as RiskLevel | null,
          estimatedHoursMin:
            record.estimated_hours_min === null
              ? null
              : Number(record.estimated_hours_min ?? 0),
          estimatedHoursMax:
            record.estimated_hours_max === null
              ? null
              : Number(record.estimated_hours_max ?? 0),
          creditsUsed: Number(record.credits_used ?? 8),
          createdAt: String(record.created_at),
        };
      }) ?? [];

    const aggregateChecks =
      aggregateResult.data?.map((row) => {
        const record = row as Record<string, unknown>;

        return {
          scopeStatus: (record.scope_status ?? null) as ScopeStatus | null,
          riskLevel: (record.risk_level ?? null) as RiskLevel | null,
          estimatedHoursMax:
            record.estimated_hours_max === null
              ? null
              : Number(record.estimated_hours_max ?? 0),
          creditsUsed: Number(record.credits_used ?? 0),
          createdAt: String(record.created_at),
        };
      }) ?? [];
    const { scopeStatusDistribution, riskBreakdown } =
      buildBreakdowns(aggregateChecks);
    const estimatedExtraHours = aggregateChecks
      .filter((row) => row.createdAt >= monthStart)
      .reduce((total, row) => total + Number(row.estimatedHoursMax ?? 0), 0);

    return {
      totalProjects: projectsResult.count ?? 0,
      projectsNotLocked: unlockedProjectsResult.count ?? 0,
      checksThisMonth: checksResult.count ?? 0,
      outOfScopeCaught: outOfScopeResult.count ?? 0,
      creditsRemaining: Number(
        profileResult.data?.credits_balance ?? STARTER_CREDITS,
      ),
      highRiskRequests: highRiskResult.count ?? 0,
      estimatedExtraHours,
      recentChecks,
      scopeStatusDistribution,
      riskBreakdown,
      checksTrend: buildDailyTrend(aggregateChecks, 7, () => 1),
      creditTrend: buildDailyTrend(
        aggregateChecks,
        7,
        (row) => row.creditsUsed,
      ),
    };
  } catch (error) {
    console.error("Dashboard data failed", error);
    return emptyData;
  }
}

function BreakdownChart({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: BreakdownItem[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-slate-700" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;

          return (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{item.label}</span>
                <span className="text-muted-foreground">
                  {item.value} ({percent}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className={`h-2 rounded-full ${item.barClassName}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
        {total === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
            Run scope checks to populate this chart.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TrendChart({
  title,
  description,
  data,
  barClassName,
}: {
  title: string;
  description: string;
  data: TrendPoint[];
  barClassName: string;
}) {
  const maxValue = Math.max(...data.map((point) => point.value), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-slate-700" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-36 items-end gap-2">
          {data.map((point) => {
            const height =
              maxValue > 0 ? Math.max((point.value / maxValue) * 100, 8) : 0;

            return (
              <div
                key={point.label}
                className="flex min-w-0 flex-1 flex-col items-center gap-2"
              >
                <div className="flex h-24 w-full items-end rounded-md bg-slate-100">
                  <div
                    className={`w-full rounded-md ${barClassName}`}
                    style={{ height: `${height}%` }}
                    title={`${point.value} on ${point.label}`}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {point.label}
                </span>
              </div>
            );
          })}
        </div>
        {maxValue === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
            No activity in the last seven days.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ActionNeededPanel({ data }: { data: DashboardData }) {
  const items = [
    {
      show: data.creditsRemaining < 10,
      title: "Low credits",
      description: `${data.creditsRemaining} credits remaining. Add credits before the next busy client review.`,
      href: "/usage",
      label: "Buy credits",
      icon: CreditCard,
      className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      show: data.highRiskRequests > 0,
      title: "High-risk checks",
      description: `${data.highRiskRequests} high-risk request${
        data.highRiskRequests === 1 ? "" : "s"
      } found across project history.`,
      href: "/dashboard",
      label: "Review table",
      icon: AlertTriangle,
      className: "border-red-200 bg-red-50 text-red-800",
    },
    {
      show: data.projectsNotLocked > 0,
      title: "Projects not locked",
      description: `${data.projectsNotLocked} project${
        data.projectsNotLocked === 1 ? "" : "s"
      } cannot run AI checks until scope is locked.`,
      href: "/projects",
      label: "View projects",
      icon: FileLock2,
      className: "border-blue-200 bg-blue-50 text-blue-800",
    },
  ].filter((item) => item.show);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Action Needed</CardTitle>
        <CardDescription>Operational signals that may need attention.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.title}
              className={`rounded-lg border p-4 ${item.className}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <item.icon className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-6">{item.description}</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="bg-white">
                  <Link href={item.href}>
                    {item.label}
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <div className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">No urgent items</p>
                <p className="mt-1 text-sm leading-6">
                  Credits, locked projects, and high-risk checks look stable.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  const actions = [
    {
      href: "/projects/new",
      label: "New Project",
      description: "Save scope and client terms",
      icon: Plus,
    },
    {
      href: "/projects",
      label: "Run Scope Check",
      description: "Choose a locked project",
      icon: MessageSquareText,
    },
    {
      href: "/usage",
      label: "Buy Credits",
      description: "Add one-time packs",
      icon: CreditCard,
    },
    {
      href: "/usage",
      label: "View Usage",
      description: "Review spend this month",
      icon: Coins,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common scope protection tasks.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-[#534AB7]/40 hover:bg-white"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#534AB7]">
                <action.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-950">
                  {action.label}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {action.description}
                </span>
              </span>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const statItems: StatCardItem[] = [
    {
      label: "Total projects",
      value: data.totalProjects,
      helper: `${data.projectsNotLocked} not locked`,
      icon: FolderKanban,
      tone: "purple",
    },
    {
      label: "Checks this month",
      value: data.checksThisMonth,
      helper: "AI analyses run",
      icon: SearchX,
      tone: "blue",
    },
    {
      label: "Out-of-scope caught",
      value: data.outOfScopeCaught,
      helper: "all time",
      icon: AlertTriangle,
      tone: "amber",
    },
    {
      label: "Credits remaining",
      value: data.creditsRemaining,
      helper: "available balance",
      icon: Coins,
      tone: data.creditsRemaining < 10 ? "amber" : "green",
    },
    {
      label: "High-risk requests",
      value: data.highRiskRequests,
      helper: "all time",
      icon: Gauge,
      tone: data.highRiskRequests > 0 ? "red" : "slate",
    },
    {
      label: "Estimated extra hours",
      value: data.estimatedExtraHours,
      helper: "upper estimate this month",
      icon: Clock3,
      tone: "slate",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge variant="outline" className="mb-3 bg-white">
            Scope operations
          </Badge>
          <h1 className="text-3xl font-bold tracking-normal text-slate-950">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track project coverage, scope risk, credit usage, and recent AI
            checks.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus />
            New Project
          </Link>
        </Button>
      </div>

      <StatsCards items={statItems} />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <QuickActions />
          <div className="grid gap-6 lg:grid-cols-2">
            <BreakdownChart
              title="Scope Status Distribution"
              description="Last 30 days of scope check outcomes."
              items={data.scopeStatusDistribution}
            />
            <BreakdownChart
              title="Risk Breakdown"
              description="Last 30 days by AI-assigned risk."
              items={data.riskBreakdown}
            />
            <TrendChart
              title="Checks Over Time"
              description="Daily checks across the last seven days."
              data={data.checksTrend}
              barClassName="bg-[#534AB7]"
            />
            <TrendChart
              title="Credit Usage Trend"
              description="Credits consumed by checks over the last seven days."
              data={data.creditTrend}
              barClassName="bg-emerald-500"
            />
          </div>
        </div>

        <ActionNeededPanel data={data} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Recent Checks</CardTitle>
              <CardDescription>
                Latest AI scope decisions across your project history.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/projects">
                Run Scope Check
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentChecks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentChecks.map((check) => (
                  <TableRow key={check.id} className="hover:bg-transparent">
                    <TableCell colSpan={6} className="p-0">
                      <Link
                        href={`/checks/${check.id}`}
                        className="grid gap-3 px-4 py-4 text-sm transition-colors hover:bg-slate-50 lg:grid-cols-[1fr_1.4fr_150px_110px_110px_120px] lg:items-center"
                      >
                        <span>
                          <span className="block font-semibold text-slate-950">
                            {check.projectName}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground lg:hidden">
                            {formatDate(check.createdAt)}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          {truncate(check.clientRequest, 82)}
                        </span>
                        <span>
                          <Badge
                            className={scopeStatusClassName(check.scopeStatus)}
                          >
                            {scopeStatusLabel(check.scopeStatus)}
                          </Badge>
                        </span>
                        <span>
                          <Badge
                            className={`capitalize ${riskClassName(
                              check.riskLevel,
                            )}`}
                          >
                            {check.riskLevel ?? "unknown"}
                          </Badge>
                        </span>
                        <span className="text-muted-foreground">
                          {hoursLabel(check)}
                        </span>
                        <span className="hidden text-muted-foreground lg:block">
                          {formatDate(check.createdAt)}
                        </span>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : data.totalProjects === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-6 w-6" />}
              title="Create your first project"
              description="Save the original scope and lock the agreement before running AI checks."
              actionLabel="New Project"
              actionHref="/projects/new"
            />
          ) : (
            <EmptyState
              icon={<SearchX className="h-6 w-6" />}
              title="No scope checks yet"
              description="Choose a locked project and compare the next client request against the saved scope."
              actionLabel="Run Scope Check"
              actionHref="/projects"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
