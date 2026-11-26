import { parseJsonLenient } from "./json-repair";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CARD_STYLE_RULES, formatCardPair } from "./card-format";
import { fetchAiProvider } from "./ai-provider-fetch.server";
import { GEMINI_CHAT_URL, geminiHeaders, geminiModel } from "./gemini-api.server";

const ParseInput = z.object({
  actionId: z.string().uuid(),
  jobId: z.string().uuid(),
  requestedCards: z.number().int().min(1).max(2500).default(10),
  text: z.string().min(1).max(150_000),
});

const MAX_PROVIDER_CALLS_PER_ACTION = 120;
const MAX_OUTPUT_TOKENS = 3_000;

type Card = { question: string; answer: string };

const systemPrompt = `Você extrai flashcards (pares de pergunta e resposta) do texto fornecido pelo usuário.

Regras de segmentação:
- Cada flashcard começa em um marcador de início ("Flashcard N", "Card N", "Pergunta:", "P:", "Q:", numeração como "1.", "1)", etc.) e vai até o próximo marcador de início (ou o fim do texto).
- Dentro de cada bloco, a pergunta é o texto sob "Pergunta"/"P:"/"Q:" (ou o texto imediatamente após o marcador "Flashcard N"/numeração, quando não há rótulo explícito).
- A resposta começa no marcador de resposta ("Resposta:", "R:", "A:") e SE ESTENDE ATÉ o próximo marcador de início. NÃO corte a resposta em quebras de linha, parágrafos em branco, títulos ou blocos citados.
- Seções complementares que aparecerem DEPOIS da resposta e ANTES do próximo flashcard — como "Pegadinha de concurso", "Pegadinha", "Referência", "Referência (Lei Seca)", "Observação", "Obs.", "Dica", "Fundamento", "Súmula", "Jurisprudência", "Exemplo" — fazem parte da MESMA resposta e devem ser anexadas ao campo "answer", mantendo seus títulos internos e preservando as quebras de linha com \\n (ex.: "\\n\\nPegadinha de concurso:\\n...\\n\\nReferência (Lei Seca):\\n...").
- A resposta pode conter vários parágrafos e incluir a íntegra de súmulas, enunciados, artigos de lei, jurisprudência, exemplos ou observações. TUDO isso faz parte da resposta.

Regras de formatação:
- Remova apenas os rótulos iniciais "Flashcard N", "Card N", "Pergunta:", "Resposta:", "P:", "R:", "Q:", "A:" (e a numeração inicial tipo "1." / "1)") do início dos respectivos campos. Não remova títulos internos (ex.: "Súmula nº 676:", "Art. 5º", "Pegadinha de concurso:", "Referência (Lei Seca):").
- NÃO use e NÃO insira marcadores de formatação Markdown, como asteriscos (**, *), hashtags (#), sublinhados (__, _) ou travessões usados como títulos. Retorne o texto puro, sem negrito, itálico, cabeçalhos ou listas Markdown.
- Preserve o idioma, a pontuação e a formatação original do conteúdo, exceto marcadores Markdown.
- Não invente, resuma nem reescreva conteúdo; apenas extraia o que está no texto.
- Se um bloco não tiver resposta identificável, ainda assim inclua o flashcard com "answer" vazio.

${CARD_STYLE_RULES}

Retorne SOMENTE JSON válido no formato: {"cards":[{"question":"...","answer":"..."}]}`;

// Remove marcadores Markdown comuns (**, *, __, _, #, -, >, `) que ao PilotAI possa inserir.
function stripMarkdownMarkers(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/(?<!\*)\*(?!\*)/g, "")
    .replace(/__/g, "")
    .replace(/(?<!_)_(?!_)/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/`{1,3}/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
}

// Divide o texto em blocos usando "Pergunta:" / "P:" / "Q:" / "1." como delimitadores
// e agrupa em chunks pequenos para evitar truncamento da resposta do PilotAI.
function splitIntoChunks(text: string, blocksPerChunk = 4): string[] {
  const marker = /(^|\n)\s*(?:Flashcard\s+\d+|Card\s+\d+|Pergunta:|P:|Q:|\d+[.)])\s*/gi;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = marker.exec(text)) !== null) {
    const start = m.index + (m[1] ? m[1].length : 0);
    indices.push(start);
  }
  if (indices.length === 0) return [text];

  const blocks: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : text.length;
    const block = text.slice(start, end).trim();
    if (block) blocks.push(block);
  }

  const chunks: string[] = [];
  for (let i = 0; i < blocks.length; i += blocksPerChunk) {
    chunks.push(blocks.slice(i, i + blocksPerChunk).join("\n\n"));
  }
  return chunks;
}

class InvalidCardsResponseError extends Error {}

function parseGatewayResponse(content: string): Card[] {
  const lenient = parseJsonLenient(content);
  if (lenient === undefined) throw new InvalidCardsResponseError("Resposta do PilotAI em formato inválido ou incompleto.");
  // O modelo às vezes devolve a lista de cards sem o objeto envolvente.
  const parsed = Array.isArray(lenient) ? { cards: lenient } : lenient;
  const validated = z
    .object({
      cards: z.array(
        z.object({
          question: z.string(),
          answer: z.string(),
        }),
      ),
    })
    .safeParse(parsed);
  if (!validated.success) {
    throw new InvalidCardsResponseError("Resposta do PilotAI não contém uma lista válida de flashcards.");
  }
  const cards = validated.data.cards;
  return cards.map((c) =>
    formatCardPair(
      stripMarkdownMarkers(String(c.question ?? "").trim()),
      stripMarkdownMarkers(String(c.answer ?? "").trim()),
    ),
  );
}

// Motor principal: Gemini direto na API do Google AI Studio (GEMINI_API_KEY).
// Resposta vazia ou fora do formato é intermitente: uma segunda tentativa resolve sem expor erro.
async function callGeminiDirect(
  geminiKey: string,
  userText: string,
  maxCards: number,
  signal: AbortSignal,
  beforeAttempt: () => void,
): Promise<Card[]> {
  try {
    return await callGeminiDirectOnce(geminiKey, userText, maxCards, signal, beforeAttempt);
  } catch (err) {
    if (err instanceof InvalidCardsResponseError) {
      return callGeminiDirectOnce(geminiKey, userText, maxCards, signal, beforeAttempt);
    }
    throw err;
  }
}

async function callGeminiDirectOnce(
  geminiKey: string,
  userText: string,
  maxCards: number,
  signal: AbortSignal,
  beforeAttempt: () => void,
): Promise<Card[]> {
  const resp = await fetchAiProvider(
    GEMINI_CHAT_URL,
    {
      method: "POST",
      signal,
      headers: geminiHeaders(geminiKey),
      body: JSON.stringify({
        model: geminiModel("google/gemini-3.1-flash-lite"),
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `${userText}\n\nGere no máximo ${maxCards} flashcards neste bloco.`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.1,
      }),
    },
    signal,
    beforeAttempt,
  );

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    if (resp.status === 401 || resp.status === 403) {
      throw new ProviderAuthError(
        `Gemini rejeitou a chave de API (${resp.status}). Verifique sua GEMINI_API_KEY.`,
      );
    }
    if (resp.status === 402) {
      throw new ProviderQuotaError("Créditos do Gemini esgotados.");
    }
    if (resp.status === 413) {
      throw new ProviderTooLargeError("Pedido maior que o limite por minuto do Gemini.");
    }
    if (resp.status === 429) {
      throw new ProviderRateLimitError("Limite de requisições do Gemini atingido.");
    }
    throw new Error(`Falha no PilotAI (${resp.status}): ${t.slice(0, 200)}`);
  }

  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  };
  const choice = json.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new Error(
      "A resposta do PilotAI excedeu o limite de saída deste bloco. Divida o texto em partes menores.",
    );
  }
  const content = choice?.message?.content ?? "{}";
  return parseGatewayResponse(content);
}

async function callLovableGateway(
  lovableKey: string,
  userText: string,
  maxCards: number,
  signal: AbortSignal,
  beforeAttempt: () => void,
): Promise<Card[]> {
  const resp = await fetchAiProvider(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `${userText}\n\nGere no máximo ${maxCards} flashcards neste bloco.`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
    },
    signal,
    beforeAttempt,
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
      "A resposta do PilotAI excedeu o limite de saída deste bloco. Divida o texto em partes menores.",
    );
  }
  const content = choice?.message?.content ?? "{}";
  return parseGatewayResponse(content);
}

class ProviderAuthError extends Error {}
class ProviderQuotaError extends Error {}
class ProviderRateLimitError extends Error {}
class ProviderTooLargeError extends ProviderRateLimitError {}

// Tenta extrair com o Gemini direto (Google AI Studio) e, se a chave for
// rejeitada ou o provider falhar, faz fallback para o Lovable AI Gateway.
export const parseFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ParseInput.parse(data))
  .handler(async ({ data, context }) => {
    const { AiQuotaPreflightError, runWithAiQuota } = await import("./ai-quota.server");
    const {
      getRegisteredGeneratedFlashcards,
      registerGeneratedFlashcardOutputs,
      settleGeneratedFlashcardBilling,
      withGeneratedFlashcardBilling,
    } = await import("./generated-flashcards.server");
    const geminiKey = process.env.GEMINI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!geminiKey && !lovableKey) {
      throw new AiQuotaPreflightError("Nenhum provedor do PilotAI está configurado.");
    }

    const existing = await getRegisteredGeneratedFlashcards({
      userId: context.userId,
      actionId: data.actionId,
      jobId: data.jobId,
    });
    if (existing.length) {
      return {
        cards: existing.map(({ question, answer, outputId }) => ({
          question,
          answer,
          generatedOutputId: outputId,
        })),
        usedFallback: false,
        fallbackReason: null,
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
        const maxChars = isPro ? 150_000 : 30_000;
        if (data.text.length > maxChars) {
          throw new AiQuotaPreflightError(
            `O texto excede o limite de ${maxChars.toLocaleString()} caracteres do seu plano.`,
          );
        }
        return withGeneratedFlashcardBilling(
          {
            userId: context.userId,
            actionId: data.actionId,
            jobId: data.jobId,
            requestedCards: data.requestedCards,
          },
          async () => {
            const chunks = splitIntoChunks(data.text, 2);
            const all: Card[] = [];
            let usedFallback = false;
            let providerCalls = 0;

            let fallbackReason: "auth" | "quota" | "limit" | null = null;

            const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

            function countProviderAttempt(): void {
              if (providerCalls >= MAX_PROVIDER_CALLS_PER_ACTION) {
                throw new Error(
                  "Esta geração atingiu o limite de chamadas do PilotAI. Divida o conteúdo em partes menores.",
                );
              }
              providerCalls += 1;
            }

            async function runChunk(chunk: string, maxCards: number, depth = 0): Promise<Card[]> {
              try {
                if (!geminiKey) throw new ProviderAuthError("GEMINI_API_KEY não configurada");
                return await callGeminiDirect(geminiKey, chunk, maxCards, signal, countProviderAttempt);
              } catch (err) {
                // Pedido grande demais: tenta dividir em blocos menores antes de desistir do Gemini.
                if (err instanceof ProviderTooLargeError && depth < 2) {
                  const parts = splitIntoChunks(chunk, 1);
                  if (parts.length > 1) {
                    const out: Card[] = [];
                    const baseCount = Math.floor(maxCards / parts.length);
                    const extraCount = maxCards % parts.length;
                    for (const [index, part] of parts.entries()) {
                      out.push(
                        ...(await runChunk(
                          part,
                          Math.max(1, baseCount + (index < extraCount ? 1 : 0)),
                          depth + 1,
                        )),
                      );
                      await sleep(400);
                    }
                    return out;
                  }
                }
                if (
                  err instanceof ProviderAuthError ||
                  err instanceof ProviderQuotaError ||
                  err instanceof ProviderRateLimitError
                ) {
                  if (!lovableKey) {
                    throw new Error(
                      err instanceof ProviderQuotaError
                        ? "Créditos do Gemini esgotados e LOVABLE_API_KEY não configurada."
                        : err instanceof ProviderRateLimitError
                          ? "O limite gratuito do PilotAI foi atingido. Tente novamente em um minuto ou envie o texto em partes menores."
                          : "GEMINI_API_KEY inválida e LOVABLE_API_KEY não configurada.",
                    );
                  }
                  usedFallback = true;
                  const { logAiFallback } = await import("./ai-fallback-log.server");
                  await logAiFallback(
                    "parse-cards",
                    "gemini-3.1-flash-lite",
                    "google/gemini-3-flash-preview (gateway)",
                    err.message,
                  );
                  if (!fallbackReason) {
                    fallbackReason =
                      err instanceof ProviderQuotaError
                        ? "quota"
                        : err instanceof ProviderRateLimitError
                          ? "limit"
                          : "auth";
                  }
                  return await callLovableGateway(
                    lovableKey,
                    chunk,
                    maxCards,
                    signal,
                    countProviderAttempt,
                  );
                }
                throw err;
              }
            }

            const baseCount = Math.floor(data.requestedCards / chunks.length);
            const extraCount = data.requestedCards % chunks.length;
            for (const [index, chunk] of chunks.entries()) {
              all.push(
                ...(await runChunk(chunk, Math.max(1, baseCount + (index < extraCount ? 1 : 0)))),
              );
              await sleep(350);
            }

            const cleaned = all
              .filter((c) => c.question.length > 0 && c.answer.length > 0)
              .slice(0, data.requestedCards);
            if (cleaned.length === 0) {
              await settleGeneratedFlashcardBilling({
                userId: context.userId,
                actionId: data.actionId,
                uncertain: false,
              });
              return { cards: [], usedFallback, fallbackReason };
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
              usedFallback,
              fallbackReason,
            };
          },
        );
      },
    );
  });
