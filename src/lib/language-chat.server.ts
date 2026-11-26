/**
 * Fase 9 — conversação pelo PilotAI no idioma da matéria.
 *
 * Ponto único do modelo: nenhum outro arquivo escolhe modelo de conversação.
 * Verificado no gateway do projeto antes de fixar o identificador.
 */
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "./languages";
import {
  CORRECTION_DEPTH,
  CORRECTION_MARKER,
  findLevel,
  findMode,
  findTopic,
} from "./language-chat-config";

import { GEMINI_CHAT_URL, geminiHeaders } from "./gemini-api.server";

/** Fallback no Lovable AI Gateway. */
export const LANGUAGE_CHAT_MODEL = "openai/gpt-6-astra";
/** Principal: Google AI Studio direto (GEMINI_API_KEY). */
export const LANGUAGE_CHAT_GEMINI_MODEL = "gemini-3-flash-preview";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ChatRole = "user" | "assistant";
export type ChatTurn = { role: ChatRole; content: string };

export function languageNameFor(code?: string | null): string {
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === (code ?? DEFAULT_LANGUAGE));
  return found?.label ?? code ?? DEFAULT_LANGUAGE;
}

/** Fase 12 — nível e tema, ambos opcionais (sem eles, o texto é o da Fase 9). */
export type ChatConfig = { level?: string | null; topic?: string | null; mode?: string | null };

/**
 * Instrução base da conversa: idioma, nível, tema, modo (Fase 13) e formato
 * da correção pedagógica (Fase 14).
 */
export function systemPromptFor(lang: string, config?: ChatConfig): string {
  const name = languageNameFor(lang);
  const isPt = lang === DEFAULT_LANGUAGE || lang.startsWith("pt");
  const level = config?.level ? findLevel(config.level) : undefined;
  const topic = config?.topic ? findTopic(config.topic) : undefined;
  const mode = config?.mode ? findMode(config.mode) : undefined;
  // Fase 14 — o bloco separado só é pedido no modo professor.
  const wantsCorrection = mode?.id === "teacher";
  // Modo "repita depois de mim": só a frase, sem pergunta final.
  const isRepeat = mode?.id === "repeat";
  const depth = CORRECTION_DEPTH[findLevel(config?.level).id];

  if (isPt) {
    return [
      `Você é um parceiro de conversa em ${name}.`,
      "Responda sempre em português do Brasil, com frases curtas e naturais.",
      ...(level ? [level.guidancePt] : []),
      ...(topic && topic.id !== "free" ? [topic.guidancePt] : []),
      ...(mode ? [mode.guidancePt] : []),
      ...(wantsCorrection
        ? [
            depth.pt,
            `Quando houver algo a corrigir, escreva a correção somente na última linha, exatamente neste formato e sem nada depois: ${CORRECTION_MARKER} {"original":"trecho do aluno","corrected":"forma correta","explanation":"explicação de uma linha","better":"forma mais natural"}.`,
            "Se não houver erro relevante, não escreva essa linha. Nunca comente a correção dentro da resposta da conversa.",
          ]
        : []),
      ...(isRepeat ? [] : ["Faça uma pergunta ao final para manter a conversa viva."]),
      PLAIN_TEXT_RULE_PT,
    ].join(" ");
  }
  return [
    `You are a friendly conversation partner helping a Brazilian learner practise ${name}.`,
    `Always reply in ${name}, using short, natural sentences.`,
    ...(level ? [level.guidanceEn] : ["Keep the vocabulary simple unless the learner writes at a higher level."]),
    ...(topic && topic.id !== "free" ? [topic.guidanceEn] : []),
    ...(mode ? [mode.guidanceEn] : []),
    ...(wantsCorrection
      ? [
          depth.en,
          `When there is something to correct, put it only on the very last line, in exactly this format and with nothing after it: ${CORRECTION_MARKER} {"original":"learner's words","corrected":"correct form","explanation":"one-line explanation in Brazilian Portuguese","better":"more natural way to say it"}.`,
          "If there is no relevant mistake, do not write that line. Never discuss the correction inside the conversational reply.",
        ]
      : []),
    ...(isRepeat ? [] : ["End each reply with a short question so the conversation continues."]),
    `Never switch to Portuguese unless the learner explicitly asks for a translation: even when the learner writes in Portuguese, keep replying in ${name}.`,
    PLAIN_TEXT_RULE_EN,
  ].join(" ");
}

/**
 * A resposta é lida em voz alta, então não pode conter marcação: asteriscos,
 * cerquilhas, sublinhados de ênfase, crases ou marcadores de lista.
 */
const PLAIN_TEXT_RULE_PT =
  "Escreva em texto puro, sem nenhuma marcação: nunca use asteriscos, sublinhados, crases, cerquilhas, aspas de ênfase, tabelas nem marcadores de lista. Para destacar algo, apenas escreva a frase normalmente.";

const PLAIN_TEXT_RULE_EN =
  "Write plain text only, with no markup at all: never use asterisks, underscores, backticks, hash signs, tables or list bullets. If you want to highlight something, simply write it as a normal sentence.";

/** Remove marcação que o leitor de voz pronunciaria como símbolos. */
export function stripMarkup(text: string): string {
  return text
    .replace(/```+/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?;:])/g, "$1$2")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s{0,3}[*+-]\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[*_`#]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Fase 14 — correção mostrada à parte, nunca dentro da conversa. */
export type ChatCorrection = {
  original?: string;
  corrected: string;
  explanation?: string;
  better?: string;
};

/** Separa a conversa do bloco de correção; texto malformado é descartado. */
export function splitCorrection(raw: string): { reply: string; correction: ChatCorrection | null } {
  const at = raw.indexOf(CORRECTION_MARKER);
  if (at === -1) return { reply: raw.trim(), correction: null };
  const reply = raw.slice(0, at).trim();
  const tail = raw.slice(at + CORRECTION_MARKER.length).trim();
  const start = tail.indexOf("{");
  const end = tail.lastIndexOf("}");
  if (start === -1 || end <= start) return { reply, correction: null };
  try {
    const parsed = JSON.parse(tail.slice(start, end + 1)) as Record<string, unknown>;
    const corrected = typeof parsed["corrected"] === "string" ? (parsed["corrected"] as string).trim() : "";
    if (!corrected) return { reply, correction: null };
    const str = (k: string) => (typeof parsed[k] === "string" ? (parsed[k] as string).trim() || undefined : undefined);
    return {
      reply,
      correction: {
        corrected,
        ...(str("original") ? { original: str("original") } : {}),
        ...(str("explanation") ? { explanation: str("explanation") } : {}),
        ...(str("better") ? { better: str("better") } : {}),
      },
    };
  } catch {
    return { reply, correction: null };
  }
}

export type ChatResult = { reply: string; chars: number; correction: ChatCorrection | null };

async function logChatFallback(reason: string) {
  const { logAiFallback } = await import("./ai-fallback-log.server");
  await logAiFallback("language-chat", LANGUAGE_CHAT_GEMINI_MODEL, LANGUAGE_CHAT_MODEL, reason);
}

export async function languageChatCompletion(
  lang: string,
  turns: ChatTurn[],
  config?: ChatConfig,
  signal?: AbortSignal,
): Promise<ChatResult> {
  const messages = [{ role: "system", content: systemPromptFor(lang, config) }, ...turns];
  const apiKey = process.env["LOVABLE_API_KEY"];
  const gKey = process.env["GEMINI_API_KEY"];

  let response: Response | null = null;
  if (gKey) {
    try {
      const g = await fetch(GEMINI_CHAT_URL, {
        method: "POST",
        signal,
        headers: geminiHeaders(gKey),
        body: JSON.stringify({
          model: LANGUAGE_CHAT_GEMINI_MODEL,
          messages,
          max_tokens: 1024,
          // Raciocínio interno consome max_tokens; "low" preserva espaço para a resposta.
          reasoning_effort: "low",
        }),
      });
      if (g.ok || !apiKey) response = g;
      else {
        console.warn(`[language-chat] Gemini falhou (${g.status}); usando gateway.`);
        await logChatFallback(`HTTP ${g.status}`);
      }
    } catch (error) {
      if (signal?.aborted || !apiKey) throw error;
      console.warn("[language-chat] Gemini indisponível; usando gateway.");
      await logChatFallback("indisponível");
    }
  }

  if (!response) {
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    response = await fetch(GATEWAY_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LANGUAGE_CHAT_MODEL,
        messages,
        max_tokens: 1024,
      }),
    });
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    if (response.status === 429) throw new Error("Muitas mensagens em sequência. Tente novamente em instantes.");
    if (response.status === 402 || response.status === 403)
      throw new Error("NO_FLASHCOINS: Créditos do PilotAI esgotados.");
    throw new Error(`Falha na conversa com o PilotAI (${response.status}). ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  };
  const choice = json.choices?.[0];
  const raw = choice?.message?.content?.trim();
  if (!raw) throw new Error("O PilotAI não respondeu. Tente enviar a mensagem novamente.");
  if (choice?.finish_reason === "length") {
    throw new Error("A resposta atingiu o limite de tamanho. Peça uma resposta mais curta.");
  }
  const { reply: rawReply, correction } = splitCorrection(raw);
  const reply = stripMarkup(rawReply);
  if (!reply) throw new Error("O PilotAI não respondeu. Tente enviar a mensagem novamente.");
  const cleanCorrection: ChatCorrection | null = correction
    ? {
        corrected: stripMarkup(correction.corrected),
        ...(correction.original ? { original: stripMarkup(correction.original) } : {}),
        ...(correction.explanation ? { explanation: stripMarkup(correction.explanation) } : {}),
        ...(correction.better ? { better: stripMarkup(correction.better) } : {}),
      }
    : null;
  return { reply, chars: raw.length, correction: cleanCorrection };
}
