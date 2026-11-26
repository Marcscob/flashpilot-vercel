import { fetchLightChat } from "./gemini-api.server";
import { DESTINATION_NAMING_RULES } from "./card-guidelines";
import {
  cleanName,
  fallbackNamesFromCards,
  isGenericName,
  pickUsableNames,
  type DestinationNames,
} from "./destination-names";
import { parseJsonLenient } from "./json-repair";

type CardHint = { question: string; answer: string };

function languageName(code: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "language" }).of(code === "pt" ? "pt-BR" : code) ?? code
    );
  } catch {
    return code;
  }
}

async function nameFromCards(cards: CardHint[], lang: string): Promise<Partial<DestinationNames>> {
  const sample = cards.slice(0, 12).map((card) => ({
    q: card.question.replace(/\s+/g, " ").slice(0, 200),
    a: card.answer.replace(/\s+/g, " ").slice(0, 200),
  }));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Timeout")), 15_000);
  try {
    const response = await fetchLightChat(
      {
        model: "google/gemini-3.1-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você nomeia a matéria e o assunto de um conjunto de flashcards.\n${DESTINATION_NAMING_RULES}\nEscreva os nomes em ${languageName(lang)} (${lang}). "subject": até 5 palavras. "topic": até 8 palavras.\nDevolva APENAS JSON: {"subject":"...","topic":"..."}`,
          },
          { role: "user", content: JSON.stringify(sample) },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 200,
      },
      controller.signal,
      "destination-names",
    );
    if (!response.ok) return {};
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = parseJsonLenient(json.choices?.[0]?.message?.content ?? "") as
      { subject?: unknown; topic?: unknown } | undefined;
    return {
      subject: isGenericName(parsed?.subject) ? undefined : cleanName(parsed?.subject),
      topic: isGenericName(parsed?.topic) ? undefined : cleanName(parsed?.topic),
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Garante nomes específicos de matéria e assunto. Usa os informados quando prestam; senão pede à
 * IA que os descubra a partir dos próprios cards; só em último caso deriva da primeira pergunta.
 * Nunca devolve "Flashcards inteligentes…", "Matéria Demo" ou similares.
 */
export async function resolveDestinationNames(input: {
  subject?: unknown;
  topic?: unknown;
  cards?: CardHint[];
  lang: string;
}): Promise<DestinationNames & { source: "given" | "ai" | "fallback" }> {
  const given = pickUsableNames(input.subject, input.topic);
  if (given.complete) return { subject: given.subject, topic: given.topic, source: "given" };

  const cards = input.cards ?? [];
  if (cards.length) {
    const ai = await nameFromCards(cards, input.lang);
    const subject = given.subject || ai.subject || "";
    const topic = given.topic || ai.topic || "";
    if (subject && topic)
      return { subject, topic, source: given.subject && given.topic ? "given" : "ai" };
    const fallback = fallbackNamesFromCards(cards, input.lang);
    return {
      subject: subject || fallback.subject,
      topic: topic || fallback.topic,
      source: "fallback",
    };
  }
  const fallback = fallbackNamesFromCards([], input.lang);
  return {
    subject: given.subject || fallback.subject,
    topic: given.topic || fallback.topic,
    source: "fallback",
  };
}
