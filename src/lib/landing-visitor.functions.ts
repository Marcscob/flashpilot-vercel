import { parseJsonLenient } from "./json-repair";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchLightChat } from "./gemini-api.server";
import { buildAnswerWithReference, formatCardPair } from "./card-format";
import { buildLandingCardsPrompt } from "./landing-cards-prompt";
import {
  UNLIMITED_TEST_EMAILS,
  reserveLandingTest,
  saveLandingVisitorCards,
} from "./landing-visitor.server";
import { LANDING_TEST_LIMITS, landingVisitorSchema } from "./landing-visitor-rules";

const GenerateInput = z.object({
  text: z.string().trim().min(5).max(15_000),
  lang: z.string().trim().min(2).max(12).default("pt"),
});

export type GeneratedVisitorCard = {
  question: string;
  answer: string;
};

export const generateLandingVisitorCardsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data }) => {
    const systemPrompt = buildLandingCardsPrompt(data.lang);

    const userPrompt = `Material de origem:
${data.text}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("Timeout")), 45_000);

    let response: Response;
    try {
      response = await fetchLightChat(
        {
          model: "google/gemini-3.1-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 3_000,
        },
        controller.signal,
        "landing-cards",
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("AI visitor cards error:", response.status, errText);
      throw new Error("Falha ao gerar flashcards. Tente novamente em instantes.");
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    try {
      type Parsed = {
        subject?: unknown;
        topic?: unknown;
        cards?: Array<GeneratedVisitorCard & { reference?: string; source_text?: string }>;
      };
      const parsed = (parseJsonLenient(content) ?? null) as Parsed | null;

      const rawCards = Array.isArray(parsed?.cards) ? parsed.cards : [];
      const cards: GeneratedVisitorCard[] = rawCards
        .filter((c) => c && typeof c.question === "string" && typeof c.answer === "string")
        .map((c) => {
          const formatted = formatCardPair(c.question, c.answer);
          return {
            question: formatted.question.trim(),
            answer: buildAnswerWithReference(
              formatted.answer.trim(),
              typeof c.reference === "string" ? c.reference : "",
              typeof c.source_text === "string" ? c.source_text.slice(0, 1000) : "",
              data.lang,
            ).slice(0, 4000),
          };
        })
        .filter((c) => c.question && c.answer)
        .slice(0, 10);

      if (!cards.length) {
        throw new Error("Nenhum flashcard pôde ser gerado a partir do texto fornecido.");
      }

      const clean = (value: unknown) =>
        typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 100) : "";
      return { cards, subject: clean(parsed?.subject), topic: clean(parsed?.topic) };
    } catch (parseError) {
      console.error("Failed to parse visitor cards JSON:", content, parseError);
      throw new Error("Falha ao processar os flashcards gerados.");
    }
  });

const ClaimInput = landingVisitorSchema.extend({
  cards: z
    .array(
      z.object({
        question: z.string().min(1).max(2000),
        answer: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(10),
  subject: z.string().trim().max(120).optional(),
  topic: z.string().trim().max(120).optional(),
  sourceText: z.string().max(15_000).optional(),
  note: z.boolean().optional(),
  map: z.boolean().optional(),
  video: z.boolean().optional(),
});

export const claimLandingVisitorCardsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ClaimInput.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (
      !UNLIMITED_TEST_EMAILS.has(email) &&
      !(await (
        await import("./landing-device.server")
      ).reserveDevice("landing-claim", LANDING_TEST_LIMITS.perEmailPerDay, 1_000_000))
    ) {
      return { ok: false as const, reason: "device_limit" as const };
    }
    const reservation = await reserveLandingTest({
      name: data.name,
      email: data.email,
      lang: data.lang,
    });

    if (!reservation.ok) {
      return {
        ok: false as const,
        reason: reservation.reason,
      };
    }

    const testId = crypto.randomUUID();
    await saveLandingVisitorCards(reservation.visitorId, testId, data.cards);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: handoffError } = await supabaseAdmin.from("landing_visitor_handoffs").insert({
      visitor_id: reservation.visitorId,
      test_id: testId,
      lang: data.lang,
      subject: data.subject || null,
      topic: data.topic || null,
      source_text: data.sourceText ?? "",
      want_note: data.note === true,
      want_map: data.map === true,
      want_video: data.video === true,
    });
    if (handoffError) throw new Error("landing_handoff_save_failed");

    return {
      ok: true as const,
      visitorId: reservation.visitorId,
      testId,
    };
  });
