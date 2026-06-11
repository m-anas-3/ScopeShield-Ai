import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Coins,
  CreditCard,
  FolderKanban,
  Gauge,
  MessageSquareText,
  Plus,
  SearchX,
} from "lucide-react";

import { grantMonthlyFreeCredits, STARTER_CREDITS } from "@/lib/credits/monthly";
import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus, RiskLevel, ScopeStatus } from "@/types";
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
import {
  DashboardCharts,
  type DashboardBreakdownDatum,
  type DashboardTrendDatum,
} from "@/components/dashboard/DashboardCharts";
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

interface RecentProject {
  id: string;
  name: string;
  clientName: string | null;
  status: ProjectStatus;
  scopeLocked: boolean;
  createdAt: string;
}

interface AggregateCheck {
  scopeStatus: ScopeStatus | null;
  riskLevel: RiskLevel | null;
  creditsUsed: number;
  createdAt: string;
}

interface DashboardData {
  totalProjects: number;
  activeProjects: number;
  projectsNotLocked: number;
  totalChecks: number;
  checksThisMonth: number;
  creditsRemaining: number;
  highRiskRequests: number;
  recentChecks: RecentCheck[];
  recentProjects: RecentProject[];
  scopeStatusDistribution: DashboardBreakdownDatum[];
  riskBreakdown: DashboardBreakdownDatum[];
  creditTrend: DashboardTrendDatum[];
}

const cardClassName = "shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

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

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
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

function riskLabel(risk: RiskLevel | null) {
  switch (risk) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    default:
      return "Unknown";
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

function projectStatusLabel(status: ProjectStatus) {
  switch (status) {
    case "completed":
      return "Completed";
    case "archived":
      return "Archived";
    case "active":
    default:
      return "Active";
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
        color: "#059669",
      },
      {
        label: "Out of scope",
        value: countStatus("out_of_scope"),
        color: "#dc2626",
      },
      {
        label: "Needs clarity",
        value: countStatus("needs_clarification"),
        color: "#d97706",
      },
    ],
    riskBreakdown: [
      { label: "Low", value: countRisk("low"), color: "#2563eb" },
      { label: "Medium", value: countRisk("medium"), color: "#d97706" },
      { label: "High", value: countRisk("high"), color: "#dc2626" },
    ],
  };
}

function buildDailyTrend(
  rows: AggregateCheck[],
  days: number,
  valueForRow: (row: AggregateCheck) => number,
): DashboardTrendDatum[] {
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
    activeProjects: 0,
    projectsNotLocked: 0,
    totalChecks: 0,
    checksThisMonth: 0,
    creditsRemaining: 0,
    highRiskRequests: 0,
    recentChecks: [],
    recentProjects: [],
    scopeStatusDistribution,
    riskBreakdown,
    creditTrend: buildDailyTrend([], 7, () => 0),
  };
}

async function getDashboardData(): Promise<DashboardData> {
  const monthStart = monthStartIso();
  const thirtyDaysAgo = daysAgoIso(30);
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
      activeProjectsResult,
      unlockedProjectsResult,
      totalChecksResult,
      monthlyChecksResult,
      highRiskResult,
      profileResult,
      recentChecksResult,
      recentProjectsResult,
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
        .eq("status", "active"),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("scope_locked", false),
      supabase
        .from("scope_checks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("scope_checks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart),
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
        .from("projects")
        .select("id, name, client_name, status, scope_locked, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("scope_checks")
        .select("scope_status, risk_level, credits_used, created_at")
        .eq("user_id", user.id)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false }),
    ]);

    const queryErrors: Array<[string, unknown]> = [
      ["Project count", projectsResult.error],
      ["Active project count", activeProjectsResult.error],
      ["Unlocked project count", unlockedProjectsResult.error],
      ["Total checks count", totalChecksResult.error],
      ["Monthly checks count", monthlyChecksResult.error],
      ["High-risk count", highRiskResult.error],
      ["Credits lookup", profileResult.error],
      ["Recent checks lookup", recentChecksResult.error],
      ["Recent projects lookup", recentProjectsResult.error],
      ["Dashboard aggregate lookup", aggregateResult.error],
    ];

    queryErrors.forEach(([label, error]) => {
      if (error) {
        console.error(`${label} failed`, error);
      }
    });

    const recentChecks =
      recentChecksResult.data?.map((row) => {
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

    const recentProjects =
      recentProjectsResult.data?.map((row) => {
        const record = row as Record<string, unknown>;

        return {
          id: String(record.id),
          name: String(record.name ?? "Untitled project"),
          clientName:
            record.client_name === null ? null : String(record.client_name ?? ""),
          status: (record.status ?? "active") as ProjectStatus,
          scopeLocked: Boolean(record.scope_locked),
          createdAt: String(record.created_at),
        };
      }) ?? [];

    const aggregateChecks =
      aggregateResult.data?.map((row) => {
        const record = row as Record<string, unknown>;

        return {
          scopeStatus: (record.scope_status ?? null) as ScopeStatus | null,
          riskLevel: (record.risk_level ?? null) as RiskLevel | null,
          creditsUsed: Number(record.credits_used ?? 0),
          createdAt: String(record.created_at),
        };
      }) ?? [];
    const { scopeStatusDistribution, riskBreakdown } =
      buildBreakdowns(aggregateChecks);

    return {
      totalProjects: projectsResult.count ?? 0,
      activeProjects: activeProjectsResult.count ?? 0,
      projectsNotLocked: unlockedProjectsResult.count ?? 0,
      totalChecks: totalChecksResult.count ?? 0,
      checksThisMonth: monthlyChecksResult.count ?? 0,
      creditsRemaining: Number(
        profileResult.data?.credits_balance ?? STARTER_CREDITS,
      ),
      highRiskRequests: highRiskResult.count ?? 0,
      recentChecks,
      recentProjects,
      scopeStatusDistribution,
      riskBreakdown,
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

function CompactEmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <Button asChild className="mt-5" size="sm">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

function NextActions({ data }: { data: DashboardData }) {
  const creditAction =
    data.creditsRemaining < 10
      ? {
          href: "/usage",
          label: "Buy credits",
          description: `${pluralize(
            data.creditsRemaining,
            "credit",
          )} remaining. Add credits before the next review.`,
          icon: CreditCard,
          tone: "bg-amber-50 text-amber-700",
        }
        : {
          href: "/usage",
          label: "Review usage",
          description: "Check credit spend and balance history.",
          icon: Coins,
          tone: "bg-slate-100 text-slate-700",
        };

  const actions = [
    {
      href: "/projects/new",
      label: "Create project",
      description: "Save original scope, terms, and exclusions.",
      icon: Plus,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      href: "/projects",
      label: "Run scope check",
      description:
        data.totalProjects > 0
          ? "Compare a client request against a locked scope."
          : "Create and lock a project before checking requests.",
      icon: MessageSquareText,
      tone: "bg-emerald-50 text-emerald-700",
    },
    creditAction,
  ];

  return (
    <Card className={cardClassName}>
      <CardHeader className="p-5 pb-3">
        <CardTitle className="text-base">Next Actions</CardTitle>
        <CardDescription>Practical steps to keep scope work moving.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.tone}`}
                >
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-950">
                    {action.label}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                    {action.description}
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentProjects({ projects }: { projects: RecentProject[] }) {
  return (
    <Card className={cardClassName}>
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Recent Projects</CardTitle>
            <CardDescription>Newest project scopes in this workspace.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/projects">View All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {projects.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-slate-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <FolderKanban className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950">
                      {project.name}
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {project.clientName || formatDate(project.createdAt)}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <Badge variant={project.status}>
                    {projectStatusLabel(project.status)}
                  </Badge>
                  <Badge
                    className={
                      project.scopeLocked
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }
                  >
                    {project.scopeLocked ? "Locked" : "Not locked"}
                  </Badge>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <CompactEmptyState
            icon={<FolderKanban className="h-5 w-5" />}
            title="No projects yet"
            description="Create a project to save scope terms and run AI checks against future requests."
            actionLabel="Create Project"
            actionHref="/projects/new"
          />
        )}
      </CardContent>
    </Card>
  );
}

function RecentChecks({ data }: { data: DashboardData }) {
  return (
    <Card className={cardClassName}>
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Recent Scope Checks</CardTitle>
            <CardDescription>
              Latest AI decisions across your project history.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href="/projects">
              Run Scope Check
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {data.recentChecks.length > 0 ? (
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Project</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentChecks.map((check) => (
                <TableRow key={check.id}>
                  <TableCell>
                    <Link
                      href={`/checks/${check.id}`}
                      className="font-medium text-slate-950 hover:text-primary"
                    >
                      {check.projectName}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[320px] text-muted-foreground">
                    {truncate(check.clientRequest, 96)}
                  </TableCell>
                  <TableCell>
                    <Badge className={scopeStatusClassName(check.scopeStatus)}>
                      {scopeStatusLabel(check.scopeStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={riskClassName(check.riskLevel)}>
                      {riskLabel(check.riskLevel)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {hoursLabel(check)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(check.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/checks/${check.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : data.totalProjects === 0 ? (
          <CompactEmptyState
            icon={<FolderKanban className="h-5 w-5" />}
            title="Create your first project"
            description="Save the original scope and lock the agreement before running AI checks."
            actionLabel="New Project"
            actionHref="/projects/new"
          />
        ) : (
          <CompactEmptyState
            icon={<SearchX className="h-5 w-5" />}
            title="No scope checks yet"
            description="Choose a locked project and compare the next client request against saved scope."
            actionLabel="Run Scope Check"
            actionHref="/projects"
          />
        )}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const statItems: StatCardItem[] = [
    {
      label: "Active projects",
      value: data.activeProjects,
      helper: `${pluralize(data.projectsNotLocked, "project")} not locked`,
      icon: FolderKanban,
      tone: "blue",
    },
    {
      label: "Total scope checks",
      value: data.totalChecks,
      helper: `${pluralize(data.checksThisMonth, "check")} this month`,
      icon: SearchX,
      tone: "slate",
    },
    {
      label: "Credits remaining",
      value: data.creditsRemaining,
      helper:
        data.creditsRemaining < 10
          ? "Low balance"
          : "Available for scope checks",
      icon: Coins,
      tone: data.creditsRemaining < 10 ? "amber" : "green",
    },
    {
      label: "High-risk checks",
      value: data.highRiskRequests,
      helper:
        data.highRiskRequests > 0
          ? "Review recent risky requests"
          : "No high-risk checks found",
      icon: data.highRiskRequests > 0 ? AlertTriangle : Gauge,
      tone: data.highRiskRequests > 0 ? "red" : "slate",
    },
  ];

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">
            Dashboard
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Monitor project coverage, scope decisions, risk, and credit usage.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/projects/new">
            <Plus />
            New Project
          </Link>
        </Button>
      </header>

      <StatsCards items={statItems} />

      <DashboardCharts
        scopeStatusData={data.scopeStatusDistribution}
        riskLevelData={data.riskBreakdown}
        creditUsageData={data.creditTrend}
      />

      <section
        aria-labelledby="recent-activity-heading"
        className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]"
      >
        <div className="space-y-3">
          <h2
            id="recent-activity-heading"
            className="text-lg font-semibold text-slate-950"
          >
            Recent Activity
          </h2>
          <RecentChecks data={data} />
        </div>
        <div className="space-y-4 xl:pt-9">
          <RecentProjects projects={data.recentProjects} />
          <NextActions data={data} />
        </div>
      </section>
    </div>
  );
}
