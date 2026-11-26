import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWebPageText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().max(2048) }).parse(input))
  .handler(async ({ data }) => {
    const { readWebPage } = await import("./web-page.server");
    return readWebPage(data.url);
  });

export const planWebPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        urls: z.array(z.string().max(2048)).min(1).max(5),
        lang: z.string().trim().min(2).max(35),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const [subjects, topics] = await Promise.all([
      context.supabase.from("subjects").select("id, name").order("name").limit(300),
      context.supabase.from("topics").select("id, name, subject_id, parent_id").limit(1500),
    ]);
    const { planWebImport } = await import("./web-import.server");
    return planWebImport({
      urls: data.urls,
      lang: data.lang,
      tree: { subjects: subjects.data ?? [], topics: topics.data ?? [] },
    });
  });

export const getWebImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().max(2048) }).parse(input))
  .handler(async ({ data }) => {
    const { readWebImage } = await import("./web-import.server");
    return { dataUrl: await readWebImage(data.url) };
  });
