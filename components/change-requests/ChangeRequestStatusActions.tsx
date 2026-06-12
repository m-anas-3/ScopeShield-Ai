"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, CreditCard, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { updateChangeRequestStatusAction } from "@/lib/actions/change-requests";
import type { ChangeRequestStatus } from "@/types";
import { Button } from "@/components/ui/button";

interface ChangeRequestStatusActionsProps {
  changeRequestId: string;
  status: ChangeRequestStatus;
}

export function ChangeRequestStatusActions({
  changeRequestId,
  status,
}: ChangeRequestStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function updateStatus(nextStatus: "draft" | "sent" | "paid") {
    startTransition(async () => {
      const result = await updateChangeRequestStatusAction(
        changeRequestId,
        nextStatus,
      );

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Status updated.");
      router.refresh();
    });
  }

  if (status === "paid" || status === "rejected") {
    return null;
  }

  if (status === "approved") {
    return (
      <Button
        type="button"
        onClick={() => updateStatus("paid")}
        disabled={isPending}
      >
        <CreditCard />
        {isPending ? "Updating..." : "Mark Paid"}
      </Button>
    );
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={() => updateStatus("draft")}
          disabled={isPending}
        >
          <Undo2 />
          Move to Draft
        </Button>
        <Button
          type="button"
          onClick={() => updateStatus("paid")}
          disabled={isPending}
        >
          <CheckCircle2 />
          Mark Paid
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => updateStatus("sent")}
      disabled={isPending}
    >
      <Send />
      {isPending ? "Updating..." : "Mark Sent"}
    </Button>
  );
}
