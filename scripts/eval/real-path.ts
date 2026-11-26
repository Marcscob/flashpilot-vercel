/**
 * Mede o caminho real de geração de cards a partir de texto/documento
 * (parse-cards-file.functions.ts): endpoint compatível com OpenAI, mesmo corpo,
 * response_format json_object e max_tokens 3000. Compara variantes de raciocínio.
 *   bun scripts/eval/real-path.ts [requestedCards]
 */
import { GEMINI_CHAT_URL, geminiHeaders, requireGeminiKey } from "../../src/lib/gemini-api.server";
import {
  CARD_GENERATION_FORMAT_RULES,
  SOURCE_TEXT_RULES,
  cardQuantityAndAtomicRules,
} from "../../src/lib/card-format";
import { CARD_CASES } from "./dataset";

const requested = Number(process.argv[2] ?? 10);
const VARIANTS: Array<{ label: string; model: string; extra: Record<string, unknown> }> = [
  { label: "flash (como o app)", model: "gemini-3-flash-preview", extra: {} },
  { label: "flash reasoning_effort=low", model: "gemini-3-flash-preview", extra: { reasoning_effort: "low" } },
  { label: "flash reasoning_effort=minimal", model: "gemini-3-flash-preview", extra: { reasoning_effort: "minimal" } },
  { label: "flash-lite (como o app)", model: "gemini-3.1-flash-lite", extra: {} },
];

const system = (lang: string) => `Você gera flashcards no estilo de provas de concurso a partir do material enviado, baseando-se ESTRITAMENTE no material. Não invente.
COBERTURA TOTAL: distribua os flashcards por todo o conteúdo, priorizando todos os enunciados, artigos, parágrafos, incisos, súmulas, definições, regras, exceções, prazos e conceitos.
${cardQuantityAndAtomicRules(requested)}
${SOURCE_TEXT_RULES}
${CARD_GENERATION_FORMAT_RULES}
IDIOMA DE SAÍDA (obrigatório): escreva TUDO em ${lang}; traduza fielmente. Mantenha nomes próprios e citações literais de "source_text" no original. Não use Markdown.
Antes dos cards, identifique a matéria geral e o assunto principal de todo o material. Use nomes curtos e claros.
Retorne SOMENTE JSON válido: {"destination":{"subject":"...","topic":"..."},"cards":[{"format":"qa|cloze|mcq","question":"...","answer":"...","reference":"...","source_text":"...","image_index":null}]}`;

type Result = { variant: string; case: string; finish: string; valid: boolean; cards: number; tokens: number; ms: number; error?: string };
const results: Result[] = [];
const jobs = VARIANTS.flatMap((v) => CARD_CASES.map((c) => ({ v, c })));
let next = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < jobs.length) {
      const { v, c } = jobs[next++]!;
      const started = Date.now();
      try {
        const res = await fetch(GEMINI_CHAT_URL, {
          method: "POST",
          headers: geminiHeaders(requireGeminiKey()),
          body: JSON.stringify({
            model: v.model,
            messages: [
              { role: "system", content: system(c.language) },
              { role: "user", content: `Material:\n${c.text}` },
            ],
            response_format: { type: "json_object" },
            max_tokens: 3000,
            ...v.extra,
          }),
        });
        if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }>; usage?: { completion_tokens?: number } };
        const choice = json.choices?.[0];
        let cards = 0;
        let valid = false;
        try {
          const parsed = JSON.parse(choice?.message?.content ?? "") as { cards?: unknown[] };
          cards = Array.isArray(parsed.cards) ? parsed.cards.length : 0;
          valid = cards > 0;
        } catch {
          valid = false;
        }
        results.push({ variant: v.label, case: c.id, finish: choice?.finish_reason ?? "?", valid, cards, tokens: json.usage?.completion_tokens ?? 0, ms: Date.now() - started });
      } catch (error) {
        results.push({ variant: v.label, case: c.id, finish: "erro", valid: false, cards: 0, tokens: 0, ms: Date.now() - started, error: String(error).slice(0, 200) });
      }
      console.log(`${v.label} / ${c.id}`);
    }
  }),
);

const table = VARIANTS.map((v) => {
  const rs = results.filter((r) => r.variant === v.label);
  return {
    variante: v.label,
    ok: `${rs.filter((r) => r.valid && r.finish === "stop").length}/${rs.length}`,
    truncado: rs.filter((r) => r.finish === "length").length,
    jsonInvalido: rs.filter((r) => !r.valid && r.finish === "stop").length,
    erros: rs.filter((r) => r.finish === "erro").length,
    cardsMedios: +(rs.reduce((n, r) => n + r.cards, 0) / rs.length).toFixed(1),
    tokensMedios: Math.round(rs.reduce((n, r) => n + r.tokens, 0) / rs.length),
    msMedios: Math.round(rs.reduce((n, r) => n + r.ms, 0) / rs.length),
  };
});
console.log(`\nCaminho real (compat OpenAI, max_tokens 3000, requestedCards=${requested})`);
console.table(table);
import { writeFileSync } from "node:fs";
writeFileSync("scripts/eval/real-path-result.json", JSON.stringify({ requested, table, results }, null, 2));
