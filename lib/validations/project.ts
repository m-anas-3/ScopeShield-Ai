import { z } from "zod";

const optionalText = z.string().trim().max(12000);

const optionalIntegerString = z
  .string()
  .trim()
  .refine((value) => {
    if (value.length === 0) {
      return true;
    }

    const numberValue = Number(value);
    return Number.isInteger(numberValue) && numberValue >= 0;
  }, "Revision limit must be a whole number of 0 or more.");

const optionalMoneyString = z
  .string()
  .trim()
  .refine((value) => {
    if (value.length === 0) {
      return true;
    }

    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0;
  }, "Hourly rate must be 0 or more.");

export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Project name must be at least 3 characters.")
    .max(120, "Project name must be 120 characters or fewer."),
  client_name: optionalText,
  original_scope: z
    .string()
    .trim()
    .min(20, "Original scope must be at least 20 characters.")
    .max(12000, "Original scope must be 12,000 characters or fewer."),
  deliverables: optionalText,
  exclusions: optionalText,
  revision_limit: optionalIntegerString,
  hourly_rate: optionalMoneyString,
});

export type ProjectFormValues = z.infer<typeof projectSchema>;
