import { franc } from "franc-min";

const LANGUAGES: Record<string, string> = { por: "pt-BR", eng: "en-US", spa: "es-ES", fra: "fr-FR", ita: "it-IT", deu: "de-DE" };

/** Subject language is a hint, not the language of every word in a mixed card. */
export function spokenTextLanguage(text: string, hint?: string): string | undefined {
  const plain = text.replace(/<[^>]*>/g, " ");
  if (plain.length < 40) return hint;
  const detected = LANGUAGES[franc(plain, { only: Object.keys(LANGUAGES), minLength: 40 })];
  if (!detected) return hint;
  if (detected.startsWith("pt") && hint?.replace("_", "-").toLowerCase() === "pt-pt") return "pt-PT";
  return detected;
}