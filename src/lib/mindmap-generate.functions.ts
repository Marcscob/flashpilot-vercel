import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  actionId: z.string().uuid(),
  source: z.enum(["note", "cards", "text"]),
  text: z.string().max(100_000).optional(),
  lang: z.string().max(20).optional(),
  noteId: z.string().uuid().optional(),
  cardIds: z.array(z.string().uuid()).min(1).max(60).optional(),
  detail: z.enum(["short", "normal", "deep"]).default("normal"),
  title: z.string().max(200).default(""),
});

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Idioma da maioria — cards sem idioma contam como português. */
function majorityLang(langs: Array<string | null | undefined>): string {
  const tally = new Map<string, number>();
  for (const raw of langs) {
    const lang = raw && raw.trim() ? raw.trim() : "pt-BR";
    tally.set(lang, (tally.get(lang) ?? 0) + 1);
  }
  let best = "pt-BR";
  let bestCount = -1;
  for (const [lang, count] of tally) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best;
}

/** Gera a árvore do mapa mental a partir de uma anotação ou de flashcards escolhidos. */
export const generateMindMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { recordAiUsage } = await import("./ai-credits.server");
    const { AiQuotaPreflightError, runWithAiQuota, throwIfAiGenerationAborted } =
      await import("./ai-quota.server");
    const { generateMindMapTree } = await import("./mindmap-generate.server");

    let sourceText = "";
    let lang = "pt-BR";
    let suggestedTitle = data.title;

    if (data.source === "note") {
      if (!data.noteId) throw new Error("Anotação não informada.");
      const { data: note, error } = await context.supabase
        .from("notes")
        .select("id, title, content_html")
        .eq("id", data.noteId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!note) throw new Error("Anotação não encontrada.");
      sourceText = htmlToText(note.content_html ?? "");
      suggestedTitle = suggestedTitle || (note.title ?? "");
    } else if (data.source === "text") {
      sourceText = (data.text ?? "").trim();
      lang = data.lang || lang;
    } else {
      const ids = data.cardIds ?? [];
      if (!ids.length) throw new Error("Nenhum flashcard selecionado.");
      const { data: cards, error } = await context.supabase
        .from("flashcards")
        .select("id, question, answer, language, topics(name, subjects(name, language))")
        .in("id", ids);
      if (error) throw new Error(error.message);
      const rows = (cards ?? []) as Array<{
        question: string;
        answer: string;
        language: string | null;
        topics: { name: string; subjects: { name: string; language: string | null } | null } | null;
      }>;
      if (!rows.length) throw new Error("Não encontrei os flashcards selecionados.");
      lang = majorityLang(rows.map((r) => r.language ?? r.topics?.subjects?.language ?? null));
      sourceText = rows
        .map((r) => `- ${htmlToText(r.question)}\n  ${htmlToText(r.answer)}`)
        .join("\n");
      suggestedTitle =
        suggestedTitle || rows[0]?.topics?.name || rows[0]?.topics?.subjects?.name || "";
    }

    if (sourceText.replace(/\s/g, "").length < 40) {
      throw new Error("O conteúdo é curto demais para gerar um mapa mental.");
    }

    const billing: { receipt?: import("./ai-quota.server").AiBillingReceipt } = {};
    const mapCache = await import("./ai-result-cache.server");
    const mapKey = await mapCache.aiCacheKey(
      "mindmap",
      lang,
      data.detail,
      suggestedTitle,
      sourceText,
    );
    const cachedTree = await mapCache.readAiCache<Awaited<ReturnType<typeof generateMindMapTree>>>(mapKey);
    if (cachedTree) return { tree: cachedTree, billing: null };
    const tree = await runWithAiQuota(
      {
        userId: context.userId,
        actionId: data.actionId,
        jobId: data.actionId,
        resource: "mindmap",
        units: 1,
        coinActionId: "mindmap",
      },
      async ({ isPro }, signal) => {
        const maxChars = isPro ? 100_000 : 20_000;
        if (sourceText.length > maxChars) {
          throw new AiQuotaPreflightError(
            `O conteúdo excede o limite de ${maxChars.toLocaleString()} caracteres do seu plano.`,
          );
        }
        const result = await generateMindMapTree(
          {
            source: sourceText,
            title: suggestedTitle,
            lang,
            detail: data.detail,
          },
          signal,
        );
        throwIfAiGenerationAborted(signal);
        await recordAiUsage(context.userId, "mindmap", sourceText.length, lang);
        return result;
      },
      (receipt) => {
        billing.receipt = receipt;
      },
    );
    await mapCache.writeAiCache("mindmap", mapKey, tree);
    return { tree, billing: billing.receipt ?? null };
  });
