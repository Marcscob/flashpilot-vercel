import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { StudyNoteInput } from "./study-note-input";
import { generateStudyNoteDraft } from "./study-note-generate.server";
import { PROGRAMMING_EXAMPLE_RULES } from "./card-guidelines";

const Input = z.object({
  actionId: z.string().uuid(),
  cardId: z.string().uuid(),
  lang: z.string().trim().min(2).max(40),
});

const LANG_NAMES: Record<string, string> = {
  pt: "Brazilian Portuguese",
  "pt-PT": "European Portuguese",
  en: "English",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  de: "German",
};

/** PilotAI drafts a study note (title + text) from both faces of one card; the user edits before saving. */
export const generateCardNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { data: card } = await context.supabase
      .from("flashcards")
      .select("id, question, answer")
      .eq("id", data.cardId)
      .maybeSingle();
    if (!card) throw new Error("Card não encontrado.");
    const name = LANG_NAMES[data.lang] ?? LANG_NAMES[data.lang.split("-")[0]] ?? data.lang;
    const { runWithAiQuota } = await import("./ai-quota.server");
    const { fetchLightChat } = await import("./gemini-api.server");
    return runWithAiQuota(
      {
        userId: context.userId,
        actionId: data.actionId,
        jobId: data.actionId,
        resource: "note_format",
        units: 1,
        coinActionId: "note_format",
      },
      async (_r, signal) => {
        const resp = await fetchLightChat(
          {
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You write a concise study note that explains ONE flashcard, using both its front (question) and back (answer).
Write in ${name}. Keep foreign technical terms and legal citations exactly as in the card; never translate them. Be faithful; never invent facts.
Plain text, short paragraphs separated by blank lines; bullet lines may start with "- ". 80-220 words. If the subject is a programming language or language learning (Portuguese, English, Spanish, etc.), add a practical example of what is explained (a short working code snippet or real usage sentences), preserving valid code exactly as written but correcting malformed syntax. Put it at the end, after a line starting with the word "Example" in ${name}.
${PROGRAMMING_EXAMPLE_RULES}
Return JSON only: {"title":"short title, max 80 chars","text":"the note"}`,
              },
              { role: "user", content: `FRONT:\n${card.question}\n\nBACK:\n${card.answer}` },
            ],
            max_tokens: 1200,
          },
          signal,
          "card-note",
        );
        if (!resp.ok)
          throw new Error("O PilotAI não conseguiu criar a anotação agora. Tente novamente.");
        const json = await resp.json();
        const raw: string = json?.choices?.[0]?.message?.content ?? "";
        const m = raw.match(/\{[\s\S]*\}/);
        const parsed = m ? JSON.parse(m[0]) : null;
        const title = String(parsed?.title ?? "")
          .trim()
          .slice(0, 200);
        const text = String(parsed?.text ?? "").trim();
        if (!text)
          throw new Error("O PilotAI não conseguiu criar a anotação agora. Tente novamente.");
        return { title, text };
      },
    );
  });

const TitleInput = z.object({
  cardId: z.string().uuid(),
  lang: z.string().trim().min(2).max(40),
  kind: z.enum(["mindmap"]),
});

/** Draft only: saving/linking always requires a separate user confirmation. */
export const generateStudyNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StudyNoteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { runWithAiQuota } = await import("./ai-quota.server");
    return runWithAiQuota(
      {
        userId: context.userId,
        actionId: data.actionId,
        jobId: data.actionId,
        resource: "note_format",
        units: 1,
        coinActionId: "note_format",
      },
      (_r, signal) => generateStudyNoteDraft(data.text, data.lang, signal),
    );
  });

/** PilotAI suggests a short, context-aware title (subject/topic + both faces) for a card material; the user can edit it. */
export const suggestCardMaterialTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TitleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: card } = await context.supabase
      .from("flashcards")
      .select("id, question, answer, topic_id")
      .eq("id", data.cardId)
      .maybeSingle();
    if (!card) throw new Error("Card não encontrado.");
    let topic = "",
      subject = "";
    if (card.topic_id) {
      const { data: tp } = await context.supabase
        .from("topics")
        .select("name, subject_id")
        .eq("id", card.topic_id)
        .maybeSingle();
      topic = tp?.name ?? "";
      if (tp?.subject_id) {
        const { data: sb } = await context.supabase
          .from("subjects")
          .select("name")
          .eq("id", tp.subject_id)
          .maybeSingle();
        subject = (sb as { name?: string } | null)?.name ?? "";
      }
    }
    const name = LANG_NAMES[data.lang] ?? LANG_NAMES[data.lang.split("-")[0]] ?? data.lang;
    const { fetchLightChat } = await import("./gemini-api.server");
    const resp = await fetchLightChat({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `Suggest ONE short, specific title (max 70 chars) for a mind map that explains a flashcard, fitting its subject and topic. Write in ${name}; keep foreign technical terms and legal citations exactly as written. Return only the title, no quotes.`,
        },
        {
          role: "user",
          content: `SUBJECT: ${subject}\nTOPIC: ${topic}\nFRONT:\n${String(card.question).slice(0, 2000)}\n\nBACK:\n${String(card.answer).slice(0, 2000)}`,
        },
      ],
      max_tokens: 200,
    }, undefined, "card-mindmap-title");
    if (!resp.ok) return { title: "" };
    const json = await resp.json();
    const title = String(json?.choices?.[0]?.message?.content ?? "")
      .replace(/^["'\s]+|["'\s]+$/g, "")
      .split("\n")[0]
      .slice(0, 160);
    return { title };
  });
