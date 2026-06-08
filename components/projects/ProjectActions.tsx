"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Lock, Pencil } from "lucide-react";
import { toast } from "sonner";

import { lockProjectScopeAction } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";

interface ProjectActionsProps {
  projectId: string;
  isLocked: boolean;
}

export function ProjectActions({ projectId, isLocked }: ProjectActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleLock() {
    const confirmed = window.confirm(
      "Lock this scope? Locked scope text cannot be edited later.",
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await lockProjectScopeAction(projectId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.chunksCount > 0
          ? `Scope locked with ${result.chunksCount} chunks.`
          : "Scope is already locked.",
      );
      window.location.reload();
    });
  }

  if (isLocked) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button asChild variant="outline">
        <Link href={`/projects/${projectId}/edit`}>
          <Pencil />
          Edit
        </Link>
      </Button>
      <Button type="button" onClick={handleLock} disabled={isPending}>
        <Lock />
        {isPending ? "Locking..." : "Lock Scope"}
      </Button>
    </div>
  );
}
