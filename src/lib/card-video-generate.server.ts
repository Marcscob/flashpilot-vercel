import { parseJsonLenient } from "./json-repair";
import {
  ensureFinalQuestionRecap,
  normalizeScenes,
  type TvScene,
  type TvStyle,
} from "./card-video";
import { fetchLightChat } from "./gemini-api.server";
import { findBlogLang } from "./blog-langs";
import { PROGRAMMING_EXAMPLE_RULES } from "./card-guidelines";

const LANG_NAMES: Record<string, string> = {
  pt: "Brazilian Portuguese",
  "pt-PT": "European Portuguese",
  en: "English",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  de: "German",
};

function languageName(lang: string): string {
  const normalized = lang.replace("_", "-");
  const primary = normalized.split("-")[0] ?? normalized;
  const knownName = LANG_NAMES[normalized] ?? LANG_NAMES[primary];
  if (knownName) return knownName;
  const blogLang = findBlogLang(normalized) ?? findBlogLang(primary);
  if (blogLang?.name) return blogLang.name;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(normalized) ?? normalized;
  } catch {
    return normalized;
  }
}

function prompt(lang: string, style: TvStyle) {
  const name = languageName(lang);
  return `You write a 20-35 second educational micro-video script for the FlashPilot-TV player, explaining ONE flashcard.
Narrator: a young female student, friendly and didactic. Visual style: ${style === "avatar" ? "avatar-led, few on-screen words" : style === "motion" ? "kinetic text and animated diagrams, no avatar" : "avatar plus kinetic text and diagrams"}.
ALL narration and on-screen text MUST be written in ${name}. Keep foreign technical terms (e.g. English words being studied) exactly as they appear in the card; never translate them.
Be faithful to the card; never invent facts. Write numbers/legal articles as they should be spoken. If the subject is a programming language or language learning (Portuguese, English, Spanish, etc.), add a practical example of what is explained (a short working code snippet or real usage sentences), preserving valid code exactly as written but correcting malformed syntax. Show it on screen in one scene's bullets (code lines verbatim, retaining indentation) and describe it briefly in the narration instead of reading symbols aloud.
${PROGRAMMING_EXAMPLE_RULES}
The FIRST scene's narration MUST open with only a one-word greeting natural in ${name} (e.g. "Olá" in Portuguese, "Hola" in Spanish, "Hello" in English, "Bonjour" in French; use the native equivalent for any other language), then go straight to the subject in the same sentence flow. Never say "today we will learn", "welcome", "in this video" or any announcement of what will be covered; never introduce yourself.
The LAST scene is the wrap-up (the answer/gabarito). Its narration MUST begin by restating the card's QUESTION as a concise, faithful question before any answer or explanation. Use the exact wording when it is already in ${name}; otherwise translate it faithfully into ${name}. Put the same recap in questionRecap so the player displays it on its own line. Never replace the question with a generic answer label or hide it only in the kicker/bullets. Only after the question recap may you give the answer and why.
Return JSON only: {"scenes":[{"emoji":"one emoji","kicker":"short label","title":"headline up to 6 words","bullets":["up to 3 short lines"],"questionRecap":"question recap on the last scene; empty otherwise","speech":"narration for this scene, 1-2 sentences"}]} with 3 or 4 scenes.`;
}

export async function generateCardVideoScenes(
  input: { question: string; answer: string; lang: string; style: TvStyle },
  signal?: AbortSignal,
): Promise<TvScene[]> {
  const response = await fetchLightChat(
    {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: prompt(input.lang, input.style) },
        { role: "user", content: `QUESTION:\n${input.question}\n\nANSWER:\n${input.answer}` },
      ],
      max_tokens: 1500,
    },
    signal,
    "card-video-script",
  );
  if (!response.ok)
    throw new Error("O PilotAI não conseguiu criar o roteiro agora. Tente novamente.");
  const json = await response.json();
  const content = String(json?.choices?.[0]?.message?.content ?? "");
  let parsed: TvScene[];
  try {
    parsed = normalizeScenes(parseJsonLenient(content) ?? null);
  } catch {
    parsed = [];
  }
  if (!parsed.length)
    throw new Error("O PilotAI não conseguiu criar o roteiro agora. Tente novamente.");
  return ensureFinalQuestionRecap(parsed, input.question);
}
