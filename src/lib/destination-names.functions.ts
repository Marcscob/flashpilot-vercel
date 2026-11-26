import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  lang: z.string().min(2).max(20),
  cards: z
    .array(z.object({ question: z.string().max(2000), answer: z.string().max(4000) }))
    .min(1)
    .max(12),
});

/** Names a destination subject/topic from a draft batch when the user selected none. */
export const resolveDestinationNamesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { resolveDestinationNames } = await import("./destination-names.server");
    const r = await resolveDestinationNames({ cards: data.cards, lang: data.lang });
    return { subject: r.subject, topic: r.topic };
  });
