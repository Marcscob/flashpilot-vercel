import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getYoutubeTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    url: z.string().max(2048),
    lang: z.string().max(20).default("en"),
  }).parse(input))
  .handler(async ({ data }) => {
    const { readYoutubeTranscript } = await import("./youtube.server");
    return readYoutubeTranscript(data.url, data.lang);
  });