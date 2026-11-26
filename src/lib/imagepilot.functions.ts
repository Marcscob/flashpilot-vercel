import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { IMAGEPILOT_MAX_PINS, imagePilotCardLimit } from "./imagepilot-rules";
import { runWithAiQuota } from "./ai-quota.server";
import { fetchAiProvider } from "./ai-provider-fetch.server";
import { GEMINI_CHAT_URL, geminiHeaders, geminiModel } from "./gemini-api.server";
import {
  registerGeneratedFlashcardOutputs,
  settleGeneratedFlashcardBilling,
  withGeneratedFlashcardBilling,
} from "./generated-flashcards.server";

export { IMAGEPILOT_MAX_PINS } from "./imagepilot-rules";

const ImagePilotInput = z.object({
  actionId: z.string().uuid(),
  jobId: z.string().uuid(),
  requestedCards: imagePilotCardLimit,
  image: z
    .string()
    .max(14_000_000)
    .refine((s) => /^data:image\/(png|jpeg|webp);base64,/i.test(s), {
      message: "A imagem deve ser um data URL (data:image/...;base64,...)",
    }),
  hint: z.string().max(500).optional(),
  lang: z.string().max(20).optional(),
});

export type ImagePilotPin = {
  n: number;
  label: string;
  x: number;
  y: number;
  confidence: number;
};

const PinSchema = z.object({
  n: z.number().int().min(1).max(IMAGEPILOT_MAX_PINS),
  label: z.string().trim().min(1).max(200),
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1000),
  confidence: z.number().min(0).max(1).optional(),
});

const ResponseSchema = z.object({
  subject: z.string().trim().max(120).nullable().optional(),
  topic: z.string().trim().max(120).nullable().optional(),
  pins: z.array(PinSchema).max(IMAGEPILOT_MAX_PINS),
});

const LANG_NAMES: Record<string, string> = {
  pt: "português",
  "pt-PT": "português europeu",
  en: "inglês",
  es: "espanhol",
  fr: "francês",
  it: "italiano",
  de: "alemão",
};

// ImagePilot: analisa UMA imagem (diagrama, foto de anatomia, mapa, esquema)
// e devolve marcadores numerados com nome e posição de cada estrutura.
// A cobrança de FlashCoins acontece por card salvo, no fluxo habitual.
export const analyzeImagePilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ImagePilotInput.parse(data))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const langName = LANG_NAMES[data.lang ?? "pt"] ?? "português";

    const systemPrompt = `Você é o ImagePilot, um analisador de imagens didáticas de altíssima precisão (diagramas, anatomia, células, mapas, esquemas técnicos).
TAREFA: identificar as estruturas/componentes nomeáveis da imagem e marcar a posição de cada uma com um marcador numerado.
REGRAS:
1. Se a imagem JÁ tiver números, letras ou setas impressos identificando estruturas, use esses números e posicione o marcador exatamente sobre cada marcação existente; o "label" é o nome da estrutura indicada.
2. Identifique no máximo ${data.requestedCards} estruturas. Se NÃO houver numeração, identifique as estruturas principais e numere de 1 em diante, na posição visual de cada uma.
3. Posições: "x" e "y" são inteiros de 0 a 1000, relativos à largura e à altura da imagem (0,0 = canto superior esquerdo; 1000,1000 = canto inferior direito). Aponte para o CENTRO da estrutura, não para o rótulo de texto.
4. "confidence": de 0 a 1, sua certeza sobre o nome da estrutura. Use menos de 0.6 quando houver dúvida real.
5. Não invente estruturas que não estejam visíveis. Prefira menos marcadores corretos a muitos incertos.
6. "subject" = matéria curta (ex.: "Biologia", "Anatomia") e "topic" = assunto curto (ex.: "Célula animal", "Sistema digestivo"), ambos em ${langName}.
7. Todos os "label" em ${langName}, curtos (1 a 4 palavras).
Retorne SOMENTE JSON válido: {"subject":"...","topic":"...","pins":[{"n":1,"label":"...","x":500,"y":300,"confidence":0.9}]}
Se a imagem não contiver nada nomeável (foto de texto corrido, imagem ilegível), retorne {"subject":null,"topic":null,"pins":[]}.`;

    return runWithAiQuota(
      {
        userId: context.userId,
        actionId: data.actionId,
        jobId: data.jobId,
        resource: "flashcards_job",
        units: 1,
      },
      async (_reservation, signal, leaseId) => {
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
                  model: geminiModel("google/gemini-3.1-pro-preview"),
                  reasoning_effort: "medium",
                  messages: [
                    { role: "system", content: systemPrompt },
                    {
                      role: "user",
                      content: [
                        {
                          type: "text",
                          text:
                            (data.hint && data.hint.trim().length > 0
                              ? `Contexto/matéria: ${data.hint.trim()}\n\n`
                              : "") +
                            "Analise esta imagem e marque as estruturas nomeáveis conforme instruído.",
                        },
                        { type: "image_url", image_url: { url: data.image } },
                      ],
                    },
                  ],
                  response_format: { type: "json_object" },
                  max_tokens: 32_000,
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
              throw new Error("A resposta do PilotAI excedeu o limite de saída. Tente uma imagem mais simples.");
            }
            const content = choice?.message?.content ?? "{}";
            let parsed: unknown;
            try {
              parsed = JSON.parse(content);
            } catch {
              throw new Error("Resposta do PilotAI em formato inválido.");
            }
            const validated = ResponseSchema.safeParse(parsed);
            if (!validated.success) {
              throw new Error("Resposta do PilotAI não contém marcadores válidos.");
            }

            // Renumera sequencialmente e normaliza posições/confiança.
            const pins: ImagePilotPin[] = validated.data.pins.slice(0, data.requestedCards).map((p, i) => ({
              n: i + 1,
              label: p.label,
              x: Math.round(Math.min(1000, Math.max(0, p.x))),
              y: Math.round(Math.min(1000, Math.max(0, p.y))),
              confidence: p.confidence ?? 1,
            }));

            if (pins.length === 0) {
              await settleGeneratedFlashcardBilling({
                userId: context.userId,
                actionId: data.actionId,
                uncertain: false,
              });
              return { subject: null, topic: null, pins: [] as ImagePilotPin[], outputIds: [] as string[] };
            }

            // Registra um output por estrutura: a cobrança final é pelos cards
            // efetivamente salvos (card único = 1; um por estrutura = nº de estruturas).
            const outputIds = await registerGeneratedFlashcardOutputs({
              userId: context.userId,
              actionId: data.actionId,
              jobId: data.jobId,
              leaseId,
              requestedCards: data.requestedCards,
              cards: pins.map((p) => ({
                question: `Item nº ${p.n} na imagem`,
                answer: p.label,
              })),
            });

            return {
              subject: validated.data.subject?.trim() || null,
              topic: validated.data.topic?.trim() || null,
              pins,
              outputIds,
            };
          },
        );
      },
    );
  });
