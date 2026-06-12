import type { ChangeRequestStatus } from "@/types";
import {
  changeRequestStatusClassName,
  changeRequestStatusLabel,
} from "@/lib/change-requests/status";
import { Badge } from "@/components/ui/badge";

export function ChangeRequestStatusBadge({
  status,
}: {
  status: ChangeRequestStatus;
}) {
  return (
    <Badge className={changeRequestStatusClassName(status)}>
      {changeRequestStatusLabel(status)}
    </Badge>
  );
}
