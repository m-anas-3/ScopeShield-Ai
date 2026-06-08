import Link from "next/link";
import { AlertTriangle, Coins, FolderKanban, Plus, SearchX } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatsCards, type StatCardItem } from "@/components/dashboard/StatsCards";

interface DashboardStats {
  totalProjects: number;
  checksThisMonth: number;
  outOfScopeCaught: number;
  creditsRemaining: number;
}

async function getDashboardStats(): Promise<DashboardStats> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

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
      .gte("created_at", monthStart.toISOString());

    if (checksError) {
      console.error("Monthly checks count failed", checksError);
    }

    const { count: outOfScopeCount, error: outOfScopeError } = await supabase
      .from("scope_checks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("scope_status", "out_of_scope")
      .gte("created_at", monthStart.toISOString());

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

    return {
      totalProjects: projectCount ?? 0,
      checksThisMonth: checksCount ?? 0,
      outOfScopeCaught: outOfScopeCount ?? 0,
      creditsRemaining: Number(profile?.credits_balance ?? 30),
    };
  } catch (error) {
    console.error("Dashboard stats failed", error);
    return {
      totalProjects: 0,
      checksThisMonth: 0,
      outOfScopeCaught: 0,
      creditsRemaining: 0,
    };
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const statItems: StatCardItem[] = [
    {
      label: "Total Projects",
      value: stats.totalProjects,
      icon: FolderKanban,
      tone: "purple",
    },
    {
      label: "Checks This Month",
      value: stats.checksThisMonth,
      icon: SearchX,
      tone: "blue",
    },
    {
      label: "Out-of-Scope Caught",
      value: stats.outOfScopeCaught,
      icon: AlertTriangle,
      tone: "amber",
    },
    {
      label: "Credits Remaining",
      value: stats.creditsRemaining,
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
            AI check history will appear here after Part 2 is connected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody />
          </Table>
          <div className="mt-4">
            <EmptyState
              icon={<SearchX className="h-6 w-6" />}
              title="No scope checks yet"
              description="Create a project now. AI-powered request checks will be wired in Part 2."
              actionLabel="Create Project"
              actionHref="/projects/new"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
