import { z } from "zod";

import {
  CHANGE_REQUEST_STATUSES,
  OWNER_CHANGE_REQUEST_STATUSES,
} from "@/lib/change-requests/status";

const optionalIntegerString = z
  .string()
  .trim()
  .refine((value) => {
    if (value.length === 0) {
      return true;
    }

    const numberValue = Number(value);
    return Number.isInteger(numberValue) && numberValue >= 0;
  }, "Enter a whole number of 0 or more.");

const optionalMoneyString = z
  .string()
  .trim()
  .refine((value) => {
    if (value.length === 0) {
      return true;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0;
  }, "Enter an amount of 0 or more.");

export const changeRequestStatusSchema = z.enum(CHANGE_REQUEST_STATUSES);

export const ownerChangeRequestStatusSchema = z.enum(
  OWNER_CHANGE_REQUEST_STATUSES,
);

export const changeRequestSchema = z
  .object({
    project_id: z.string().uuid(),
    scope_check_id: z.string().uuid().optional().or(z.literal("")),
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters.")
      .max(160, "Title must be 160 characters or fewer."),
    summary: z
      .string()
      .trim()
      .min(1, "Describe the proposed extra work.")
      .max(6000, "Summary must be 6,000 characters or fewer."),
    client_message: z.string().trim().max(4000),
    estimated_hours_min: optionalIntegerString,
    estimated_hours_max: optionalIntegerString,
    hourly_rate_snapshot: optionalMoneyString,
    fixed_price: optionalMoneyString,
    estimated_total: optionalMoneyString,
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code."),
  })
  .superRefine((value, context) => {
    const min =
      value.estimated_hours_min.length > 0
        ? Number(value.estimated_hours_min)
        : null;
    const max =
      value.estimated_hours_max.length > 0
        ? Number(value.estimated_hours_max)
        : null;

    if (min !== null && max !== null && min > max) {
      context.addIssue({
        code: "custom",
        message: "Minimum hours cannot exceed maximum hours.",
        path: ["estimated_hours_max"],
      });
    }
  });

export const publicChangeRequestResponseSchema = z.object({
  token: z.string().trim().min(32).max(128),
  response: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).optional(),
});

export type ChangeRequestFormValues = z.infer<typeof changeRequestSchema>;
export type OwnerChangeRequestStatus = z.infer<
  typeof ownerChangeRequestStatusSchema
>;
