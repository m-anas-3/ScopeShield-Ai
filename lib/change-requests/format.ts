import type { ChangeRequest, MatchedClause } from "@/types";
import { formatCurrency } from "@/lib/utils";

export function parseMatchedClauses(value: unknown): MatchedClause[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = record.id;
      const sourceField = record.source_field;
      const chunkText = record.chunk_text;
      const similarity = record.similarity;

      if (
        typeof id !== "string" ||
        typeof sourceField !== "string" ||
        typeof chunkText !== "string"
      ) {
        return null;
      }

      return {
        id,
        source_field: sourceField,
        chunk_text: chunkText,
        similarity:
          typeof similarity === "number" && Number.isFinite(similarity)
            ? similarity
            : 0,
      };
    })
    .filter((item): item is MatchedClause => item !== null);
}

export function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function sourceLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function formatHoursRange(changeRequest: {
  estimated_hours_min: number | null;
  estimated_hours_max: number | null;
}) {
  const min = changeRequest.estimated_hours_min;
  const max = changeRequest.estimated_hours_max;

  if (min === null && max === null) {
    return "Not set";
  }

  if (min !== null && max !== null) {
    if (min === max) {
      return `${min} hrs`;
    }

    return `${min}-${max} hrs`;
  }

  return `${min ?? max} hrs`;
}

export function changeRequestAmountLabel(
  changeRequest: Pick<
    ChangeRequest,
    "fixed_price" | "estimated_total" | "currency"
  >,
) {
  if (changeRequest.fixed_price !== null) {
    return formatCurrency(changeRequest.fixed_price, changeRequest.currency);
  }

  if (changeRequest.estimated_total !== null) {
    return formatCurrency(changeRequest.estimated_total, changeRequest.currency);
  }

  return "Not set";
}

export function changeRequestSharePath(token: string) {
  return `/approve/${token}`;
}

export function changeRequestReportPath(id: string) {
  return `/change-requests/${id}/report`;
}
