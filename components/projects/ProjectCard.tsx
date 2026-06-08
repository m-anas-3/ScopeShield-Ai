import Link from "next/link";
import { CalendarDays, UserRound } from "lucide-react";

import { formatDate } from "@/lib/utils";
import type { Project } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="h-full transition-colors hover:border-[#534AB7]/40">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="line-clamp-2">{project.name}</CardTitle>
            <Badge variant={project.status}>{project.status}</Badge>
          </div>
          <CardDescription className="flex items-center gap-2">
            <UserRound className="h-4 w-4" />
            {project.client_name ?? "No client set"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
            {project.original_scope}
          </p>
          <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            Created {formatDate(project.created_at)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
