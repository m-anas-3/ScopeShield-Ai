"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { respondToSharedChangeRequestAction } from "@/lib/actions/change-requests";
import type { ChangeRequestStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PublicApprovalFormProps {
  token: string;
  status: ChangeRequestStatus;
}

export function PublicApprovalForm({ token, status }: PublicApprovalFormProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const isOpen = status === "sent";

  function submit(response: "approved" | "rejected") {
    startTransition(async () => {
      const result = await respondToSharedChangeRequestAction({
        token,
        response,
        note,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        result.status === "approved"
          ? "Change request approved."
          : "Change request rejected.",
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client-response-note">Client Note</Label>
        <Textarea
          id="client-response-note"
          rows={4}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          disabled={!isOpen || isPending}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          onClick={() => submit("approved")}
          disabled={!isOpen || isPending}
        >
          <CheckCircle2 />
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => submit("rejected")}
          disabled={!isOpen || isPending}
        >
          <XCircle />
          Reject
        </Button>
      </div>
      {!isOpen ? (
        <p className="text-sm text-muted-foreground">
          This request is not open for approval.
        </p>
      ) : null}
    </div>
  );
}
