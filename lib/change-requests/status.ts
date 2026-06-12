import type { ChangeRequestStatus } from "@/types";

export const CHANGE_REQUEST_STATUSES = [
  "draft",
  "sent",
  "approved",
  "rejected",
  "paid",
] as const satisfies readonly ChangeRequestStatus[];

export const OWNER_CHANGE_REQUEST_STATUSES = [
  "draft",
  "sent",
  "paid",
] as const;

export function changeRequestStatusLabel(status: ChangeRequestStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "paid":
      return "Paid";
  }
}

export function changeRequestStatusClassName(status: ChangeRequestStatus) {
  switch (status) {
    case "draft":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "sent":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    case "paid":
      return "border-violet-200 bg-violet-50 text-violet-700";
  }
}

export function isFinalChangeRequestStatus(status: ChangeRequestStatus) {
  return status === "rejected" || status === "paid";
}

export function canOwnerTransitionChangeRequestStatus(
  current: ChangeRequestStatus,
  next: (typeof OWNER_CHANGE_REQUEST_STATUSES)[number],
) {
  if (current === next) {
    return true;
  }

  if (current === "draft") {
    return next === "sent";
  }

  if (current === "sent") {
    return next === "draft" || next === "paid";
  }

  if (current === "approved") {
    return next === "paid";
  }

  return false;
}
