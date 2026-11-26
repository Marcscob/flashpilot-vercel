import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureDestinationForUser } from "./bulk-demo.server";

const DestinationInput = z.object({
  subjectName: z.string().trim().max(120).optional(),
  topicName: z.string().trim().max(120).optional(),
  language: z.string().trim().min(2).max(35).optional(),
  cards: z
    .array(z.object({ question: z.string().max(2000), answer: z.string().max(4000) }))
    .max(12)
    .optional(),
});

const ensureDemoDestinationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DestinationInput.parse(input))
  .handler(async ({ context, data }) => {
    return ensureDestinationForUser(context.userId, data);
  });

export function ensureBulkDemoDestination(input?: {
  subjectName?: string;
  topicName?: string;
  language?: string;
  cards?: Array<{ question: string; answer: string }>;
}) {
  return ensureDemoDestinationFn({ data: input ?? {} });
}
