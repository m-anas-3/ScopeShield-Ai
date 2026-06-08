import { z } from "zod";

export const checkSchema = z.object({
  project_id: z.string().uuid(),
  client_request: z
    .string()
    .min(20, "Must be at least 20 characters")
    .max(2000),
  urgency: z.enum(["low", "medium", "high"]).optional(),
  client_tone: z
    .enum(["friendly", "neutral", "pushy", "aggressive"])
    .optional(),
  extra_notes: z.string().max(500).optional(),
});

export type CheckFormValues = z.infer<typeof checkSchema>;
