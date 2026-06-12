import Link from "next/link";
import type { ReactNode } from "react";
import { FileSignature, FolderKanban } from "lucide-react";

import {
  changeRequestAmountLabel,
  formatHoursRange,
} from "@/lib/change-requests/format";
import { getProjectMap, toChangeRequest } from "@/lib/change-requests/queries";
import {
  CHANGE_REQUEST_STATUSES,
  changeRequestStatusLabel,
} from "@/lib/change-requests/status";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { ChangeRequest, ChangeRequestStatus } from "@/types";
import { ChangeRequestStatusBadge } from "@/components/change-requests/ChangeRequestStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
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

interface ChangeRequestsPageProps {
  searchParams?: {
    status?: string;
  };
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function parseStatus(value: string | undefined): ChangeRequestStatus | null {
  if (
    value &&
    CHANGE_REQUEST_STATUSES.includes(value as ChangeRequestStatus)
  ) {
    return value as ChangeRequestStatus;
  }

  return null;
}

async function getChangeRequests(status: ChangeRequestStatus | null) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { changeRequests: [], projectMap: new Map() };
    }

    let query = supabase
      .from("change_requests")
      .select(
        "id, user_id, project_id, scope_check_id, title, summary, client_message, estimated_hours_min, estimated_hours_max, hourly_rate_snapshot, fixed_price, estimated_total, currency, status, public_share_token, client_response_note, approved_at, rejected_at, paid_at, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.error("Change requests lookup failed", error);
      return { changeRequests: [], projectMap: new Map() };
    }

    const changeRequests = data.map((row) =>
      toChangeRequest(row as Record<string, unknown>),
    );
    const projectIds = Array.from(
      new Set(changeRequests.map((request) => request.project_id)),
    );
    const projectMap = await getProjectMap(projectIds);

    return { changeRequests, projectMap };
  } catch (error) {
    console.error("Change requests lookup failed", error);
    return { changeRequests: [], projectMap: new Map() };
  }
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full border border-[#534AB7] bg-[#534AB7]/10 px-3 py-1.5 text-sm font-medium text-[#534AB7]"
          : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-slate-950"
      }
    >
      {children}
    </Link>
  );
}

export default async function ChangeRequestsPage({
  searchParams,
}: ChangeRequestsPageProps) {
  const status = parseStatus(searchParams?.status);
  const { changeRequests, projectMap } = await getChangeRequests(status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal text-slate-950">
            Change Requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track client-ready scope changes, approvals, and payment status.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/projects">
            <FolderKanban />
            Find Project
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterLink href="/change-requests" active={!status}>
          All
        </FilterLink>
        {CHANGE_REQUEST_STATUSES.map((item) => (
          <FilterLink
            key={item}
            href={`/change-requests?status=${item}`}
            active={status === item}
          >
            {changeRequestStatusLabel(item)}
          </FilterLink>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>
            Owner status, client response, and pricing snapshots.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changeRequests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeRequests.map((request: ChangeRequest) => {
                  const project = projectMap.get(request.project_id);

                  return (
                    <TableRow key={request.id} className="hover:bg-transparent">
                      <TableCell colSpan={6} className="p-0">
                        <Link
                          href={`/change-requests/${request.id}`}
                          className="grid gap-3 px-4 py-3 text-sm transition-colors hover:bg-slate-50 lg:grid-cols-[1.2fr_1fr_120px_110px_110px_110px] lg:items-center"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-950">
                              {request.title}
                            </span>
                            <span className="mt-1 block text-muted-foreground">
                              {truncate(request.summary, 90)}
                            </span>
                          </span>
                          <span className="min-w-0 text-muted-foreground">
                            <span className="block truncate text-slate-950">
                              {project?.name ?? "Project"}
                            </span>
                            <span className="mt-1 block truncate">
                              {project?.client_name ?? "No client set"}
                            </span>
                          </span>
                          <span>
                            <ChangeRequestStatusBadge
                              status={request.status}
                            />
                          </span>
                          <span className="text-muted-foreground">
                            {formatHoursRange(request)}
                          </span>
                          <span className="font-medium text-slate-950">
                            {changeRequestAmountLabel(request)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDate(request.created_at)}
                          </span>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={<FileSignature className="h-6 w-6" />}
              title="No change requests found"
              description="Create one from an out-of-scope scope check result."
              actionLabel="View Projects"
              actionHref="/projects"
            />
          )}
        </CardContent>
      </Card>

      {status ? (
        <Badge variant="outline" className="bg-white">
          Showing {changeRequestStatusLabel(status).toLowerCase()} requests
        </Badge>
      ) : null}
    </div>
  );
}
