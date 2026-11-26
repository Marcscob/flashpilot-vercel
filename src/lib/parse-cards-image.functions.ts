import { parseJsonLenient } from "./json-repair";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { sharedCardGuidelines } from "./card-guidelines";
import { buildAnswerWithReference, formatCardQuestion } from "./card-format";
import { runWithAiQuota } from "./ai-quota.server";
import { validateAiImages } from "./ai-input-limits.server";
import { fetchAiProvider } from "./ai-provider-fetch.server";
import { GEMINI_CHAT_URL, geminiHeaders, geminiModel } from "./gemini-api.server";
import {
  getRegisteredGeneratedFlashcards,
  registerGeneratedFlashcardOutputs,
  settleGeneratedFlashcardBilling,
  withGeneratedFlashcardBilling,
} from "./generated-flashcards.server";

const ImageInput = z.object({
  actionId: z.string().uuid(),
  jobId: z.string().uuid(),
  requestedCards: z.number().int().min(1).max(2500).default(10),
  images: z
    .array(
      z
        .string()
        .max(14_000_000)
        .refine((s) => /^data:image\/(png|jpeg|webp);base64,/i.test(s), {
          message: "Cada imagem deve ser um data URL (data:image/...;base64,...)",
        }),
    )
    .min(1)
    .max(20),
  hint: z.string().max(500).optional(),
});

type Card = { question: string; answer: string; reference?: string; source_text?: string };

const MAX_OUTPUT_TOKENS = 3_000;

// Recebe uma ou mais fotos (páginas de livro) e usa o Gemini direto (Google AI Studio)
// para extrair o conteúdo e gerar perguntas no estilo de concurso
// com as respectivas respostas.
export const parseFlashcardsFromImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ImageInput.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const systemPrompt = `Você gera flashcards no estilo de provas de concurso a partir de fotos ou prints de páginas de livro, apostila ou CADERNO.
LEITURA (OCR): leia todo o texto visível, inclusive letra manuscrita, folhas pautadas, grifos, anotações de margem, colunas, tabelas e notas de rodapé. Compense páginas tortas/inclinadas, sombras e iluminação irregular. Palavras ilegíveis: não invente, apenas ignore.
COBERTURA: transforme TODO o conteúdo legível em flashcards, sem pular definições, regras, exceções, prazos, artigos ou conceitos. Baseie-se ESTRITAMENTE nas imagens.
${sharedCardGuidelines({ requestedCards: data.requestedCards, destination: false })}
Formatos na proporção especificada. Linguagem simples, voltada à memorização. Preserve o idioma original. Sem Markdown. Imagens ilegíveis: {"cards":[]} .
Retorne SOMENTE JSON válido: {"cards":[{"format":"qa|cloze|mcq","question":"...","answer":"...","reference":"...","source_text":"..."}]}`;

    const userContent: Array<
      { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
    > = [];

    userContent.push({
      type: "text",
      text:
        (data.hint && data.hint.trim().length > 0
          ? `Contexto/matéria e instruções do usuário (obrigatórias): ${data.hint.trim()}\n\n`
          : "") +
        `Extraia o conteúdo das imagens abaixo e gere flashcards de concurso conforme instruído.`,
    });
    for (const img of data.images) {
      userContent.push({ type: "image_url", image_url: { url: img } });
    }

    const existing = await getRegisteredGeneratedFlashcards({
      userId: context.userId,
      actionId: data.actionId,
      jobId: data.jobId,
    });
    if (existing.length) {
      return {
        cards: existing.map((card) => ({
          question: card.question,
          answer: card.answer,
          generatedOutputId: card.outputId,
        })),
      };
    }

    return runWithAiQuota(
      {
        userId: context.userId,
        actionId: data.actionId,
        jobId: data.jobId,
        resource: "flashcards_job",
        units: 1,
      },
      async ({ isPro }, signal, leaseId) => {
        validateAiImages(data.images, isPro);
        return withGeneratedFlashcardBilling(
          {
            userId: context.userId,
            actionId: data.actionId,
            jobId: data.jobId,
            requestedCards: data.requestedCards,
          },
          async () => {
            const resp = await fetchAiProvider(
              GEMINI_CHAT_URL,
              {
                method: "POST",
                signal,
                headers: geminiHeaders(apiKey),
                body: JSON.stringify({
                  model: geminiModel("google/gemini-3.1-flash-lite"),
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent },
                  ],
                  response_format: { type: "json_object" },
                  max_tokens: MAX_OUTPUT_TOKENS,
                }),
              },
              signal,
            );

            if (!resp.ok) {
              const t = await resp.text().catch(() => "");
              if (resp.status === 402)
                throw new Error("Créditos do PilotAI esgotados. Adicione créditos para continuar.");
              if (resp.status === 429)
                throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
              throw new Error(`Falha no PilotAI (${resp.status}): ${t.slice(0, 200)}`);
            }

            const json = (await resp.json()) as {
              choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
            };
            const choice = json.choices?.[0];
            if (choice?.finish_reason === "length") {
              throw new Error(
                "A resposta do PilotAI excedeu o limite de saída. Envie menos imagens por vez.",
              );
            }
            const content = choice?.message?.content ?? "{}";
            const parsed = parseJsonLenient(content);
            if (parsed === undefined) throw new Error("Resposta do PilotAI em formato inválido.");
            const validated = z
              .object({
                cards: z.array(
                  z.object({
                    question: z.string(),
                    answer: z.string(),
                    reference: z.string().nullable().optional(),
                    source_text: z.string().nullable().optional(),
                  }),
                ),
              })
              .safeParse(parsed);
            if (!validated.success) {
              throw new Error("Resposta do PilotAI não contém uma lista válida de flashcards.");
            }
            const cards = validated.data.cards;
            const cleaned = cards
              .map((c) => {
                const { question, leakedAnswer } = formatCardQuestion(
                  String(c.question ?? "").trim(),
                );
                const rawAnswer = String(c.answer ?? "").trim();
                const answer = buildAnswerWithReference(
                  leakedAnswer && !rawAnswer ? leakedAnswer : rawAnswer,
                  String(c.reference ?? "").trim(),
                  String(c.source_text ?? "").trim(),
                );
                return { question, answer };
              })
              .filter((c) => c.question.length > 0 && c.answer.length > 0)
              .slice(0, data.requestedCards);

            if (cleaned.length === 0) {
              await settleGeneratedFlashcardBilling({
                userId: context.userId,
                actionId: data.actionId,
                uncertain: false,
              });
              return { cards: [] };
            }

            const outputIds = await registerGeneratedFlashcardOutputs({
              userId: context.userId,
              actionId: data.actionId,
              jobId: data.jobId,
              leaseId,
              requestedCards: data.requestedCards,
              cards: cleaned,
            });
            return {
              cards: cleaned.map((card, index) => ({
                ...card,
                generatedOutputId: outputIds[index],
              })),
            };
          },
        );
      },
    );
  });
