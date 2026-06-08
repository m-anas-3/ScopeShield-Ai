import Link from "next/link";
import { AlertTriangle, Coins, FolderKanban, Plus, SearchX } from "lucide-react";

import { formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import type { ScopeStatus } from "@/types";
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
  createdAt: string;
}

interface DashboardData {
  totalProjects: number;
  checksThisMonth: number;
  outOfScopeCaught: number;
  creditsRemaining: number;
  recentChecks: RecentCheck[];
}

function monthStartIso() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return monthStart.toISOString();
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
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
      return "border-green-200 bg-green-50 text-green-700";
    case "out_of_scope":
      return "border-red-200 bg-red-50 text-red-700";
    case "needs_clarification":
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
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

async function getDashboardData(): Promise<DashboardData> {
  const monthStart = monthStartIso();

  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        totalProjects: 0,
        checksThisMonth: 0,
        outOfScopeCaught: 0,
        creditsRemaining: 0,
        recentChecks: [],
      };
    }

    const { count: projectCount, error: projectsError } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (projectsError) {
      console.error("Project count failed", projectsError);
    }

    const { count: checksCount, error: checksError } = await supabase
      .from("scope_checks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart);

    if (checksError) {
      console.error("Monthly checks count failed", checksError);
    }

    const { count: outOfScopeCount, error: outOfScopeError } = await supabase
      .from("scope_checks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("scope_status", "out_of_scope");

    if (outOfScopeError) {
      console.error("Out-of-scope count failed", outOfScopeError);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Credits lookup failed", profileError);
    }

    const { data: recentRows, error: recentError } = await supabase
      .from("scope_checks")
      .select("id, client_request, scope_status, created_at, projects(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentError) {
      console.error("Recent checks lookup failed", recentError);
    }

    const recentChecks =
      recentRows?.map((row) => {
        const record = row as Record<string, unknown>;

        return {
          id: String(record.id),
          projectName: projectNameFromRelation(record.projects),
          clientRequest: String(record.client_request ?? ""),
          scopeStatus: (record.scope_status ?? null) as ScopeStatus | null,
          createdAt: String(record.created_at),
        };
      }) ?? [];

    return {
      totalProjects: projectCount ?? 0,
      checksThisMonth: checksCount ?? 0,
      outOfScopeCaught: outOfScopeCount ?? 0,
      creditsRemaining: Number(profile?.credits_balance ?? 30),
      recentChecks,
    };
  } catch (error) {
    console.error("Dashboard data failed", error);
    return {
      totalProjects: 0,
      checksThisMonth: 0,
      outOfScopeCaught: 0,
      creditsRemaining: 0,
      recentChecks: [],
    };
  }
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const statItems: StatCardItem[] = [
    {
      label: "Total Projects",
      value: data.totalProjects,
      icon: FolderKanban,
      tone: "purple",
    },
    {
      label: "Checks This Month",
      value: data.checksThisMonth,
      icon: SearchX,
      tone: "blue",
    },
    {
      label: "Out-of-Scope",
      value: data.outOfScopeCaught,
      icon: AlertTriangle,
      tone: "amber",
    },
    {
      label: "Credits Remaining",
      value: data.creditsRemaining,
      icon: Coins,
      tone: "green",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-slate-950">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor projects, credits, and scope risk signals.
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

      <Card>
        <CardHeader>
          <CardTitle>Recent Checks</CardTitle>
          <CardDescription>
            The latest AI scope checks across your projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentChecks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentChecks.map((check) => (
                  <TableRow key={check.id} className="hover:bg-transparent">
                    <TableCell colSpan={4} className="p-0">
                      <Link
                        href={`/checks/${check.id}`}
                        className="grid gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50 md:grid-cols-[1fr_1.4fr_150px_120px] md:items-center"
                      >
                        <span className="font-medium text-slate-950">
                          {check.projectName}
                        </span>
                        <span className="text-muted-foreground">
                          {truncate(check.clientRequest, 60)}
                        </span>
                        <span>
                          <Badge
                            className={scopeStatusClassName(check.scopeStatus)}
                          >
                            {scopeStatusLabel(check.scopeStatus)}
                          </Badge>
                        </span>
                        <span className="text-muted-foreground">
                          {formatDate(check.createdAt)}
                        </span>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={<SearchX className="h-6 w-6" />}
              title="No checks yet"
              description="Run your first check from a project to start tracking scope creep."
              actionLabel="Run Your First Check"
              actionHref="/projects"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
