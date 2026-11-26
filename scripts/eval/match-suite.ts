/**
 * Avalia o FlashMatch pelo caminho real do app: gera flashcards como o app gera (Flash-Lite),
 * passa os cards para generateMatchGame (src/lib/match-game-ai.server.ts) e mede o jogo:
 * regras estruturais, escrita do idioma, julgamento por IA e um "jogador" que tenta resolver
 * cada rodada (pares ambíguos aparecem como erro do jogador).
 */
import { generateMatchGame } from "../../src/lib/match-game-ai.server";
import {
  MATCH_ROUND_MAX,
  MATCH_ROUND_MIN,
  shuffledOrder,
  type MatchRound,
} from "../../src/lib/match-game";
import { CARD_CASES } from "./dataset";
import { row, type FeatureRow } from "./features";
import { LANGS, scriptShare } from "./langs";
import { generate, judge, parseJson } from "./lib";
import { cardsSystem, languageName } from "./prompts";

type Ctx = { useJudge: boolean; judgeModel: string };
type Job = { label: string; run: () => Promise<FeatureRow> };

const CARD_MODEL = "gemini-3.1-flash-lite";
const SOLVER_MODEL = "gemini-3-flash-preview";

const GRAMMAR_EN = `Present perfect is formed with have or has plus the past participle: I have studied, she has finished. We use it for experiences without a specific time (I have visited Rome), for actions that started in the past and continue now (They have lived here since 2019) and for recent results (He has lost his keys). Past simple, in contrast, is used for finished actions at a specific time: I visited Rome in 2018. The words ever, never, already, yet, just, for and since are common with present perfect. Use for with a period of time (for three years) and since with a starting point (since Monday). Regular past participles end in -ed, while irregular verbs change form: go - gone, see - seen, write - written. Questions are formed by inverting the auxiliary: Have you ever been to London? Negatives use haven't or hasn't: She hasn't called yet.`;

type Source = { id: string; text: string; lang: string; language: string };

function sources(): Source[] {
  const base: Source[] = CARD_CASES.map((c) => ({
    id: c.id,
    text: c.text,
    lang: c.lang,
    language: c.language,
  }));
  const grammar: Source = {
    id: "gramatica-ingles-pt",
    text: GRAMMAR_EN,
    lang: "pt",
    language: "Brazilian Portuguese",
  };
  const english = CARD_CASES.find((c) => c.id === "en-photosynthesis")!.text;
  const extra = ["ar", "ru", "hi", "ko", "zh-CN", "tr", "de"].map((code) => ({
    id: `fotossintese-${code}`,
    text: english,
    lang: code,
    language: LANGS.find((l) => l.code === code)?.name ?? code,
  }));
  return [...base, grammar, ...extra];
}

async function solveRound(round: MatchRound, seed: number): Promise<number> {
  const order = shuffledOrder(round.pairs.length, seed);
  const letters = "ABCDE";
  const concepts = round.pairs.map((p, i) => `${i + 1}. ${p.left}`).join("\n");
  const explanations = order
    .map((pairIndex, k) => `${letters[k]}. ${round.pairs[pairIndex]!.right}`)
    .join("\n");
  const g = await generate(SOLVER_MODEL, {
    thinkingLevel: "low",
    json: true,
    temperature: 0,
    maxOutputTokens: 1500,
    parts: [
      {
        text: `Match each numbered concept with the single best explanation. Every explanation is used exactly once.\nCONCEPTS:\n${concepts}\nEXPLANATIONS:\n${explanations}\nReturn ONLY JSON: {"matches":[{"concept":1,"explanation":"A"}]}`,
      },
    ],
  });
  const parsed = parseJson<{ matches?: Array<{ concept?: number; explanation?: string }> }>(g.text);
  const matches = Array.isArray(parsed?.matches) ? parsed!.matches! : [];
  let correct = 0;
  round.pairs.forEach((_, i) => {
    const letter = letters[order.indexOf(i)];
    if (
      matches
        .find((m) => Number(m.concept) === i + 1)
        ?.explanation?.trim()
        .toUpperCase()
        .startsWith(letter!)
    )
      correct++;
  });
  return correct / round.pairs.length;
}

async function evalMatch(src: Source, ctx: Ctx): Promise<FeatureRow> {
  const o = {
    spec: { model: CARD_MODEL, maxTokens: 3000 },
    label: "flashmatch (cards -> jogo)",
    useJudge: ctx.useJudge,
    judgeModel: ctx.judgeModel,
  };
  const cardGen = await generate(CARD_MODEL, {
    system: cardsSystem(src.lang),
    parts: [{ text: `Material de origem:\n${src.text}` }],
    json: true,
    maxOutputTokens: 3000,
    temperature: 0.2,
  });
  const cardsParsed = parseJson<{ cards?: Array<{ question?: string; answer?: string }> }>(
    cardGen.text,
  );
  const cards = (cardsParsed?.cards ?? [])
    .filter((c) => typeof c.question === "string" && typeof c.answer === "string")
    .map((c) => ({ question: c.question!, answer: c.answer! }));
  if (cards.length < 3) {
    return row(
      o,
      "match",
      src.id,
      { cardsGerados: false },
      { ms: cardGen.ms, usage: cardGen.usage },
      undefined,
      "cards insuficientes",
    );
  }

  const started = Date.now();
  let game: Awaited<ReturnType<typeof generateMatchGame>> | null = null;
  let failure = "";
  try {
    game = await generateMatchGame(cards, AbortSignal.timeout(60_000));
  } catch (error) {
    failure = String(error).slice(0, 160);
  }
  const ms = Date.now() - started;
  if (!game)
    return row(
      o,
      "match",
      src.id,
      { jogoGerado: false },
      { ms, usage: { inputTokens: 0, outputTokens: 0 } },
      undefined,
      failure,
    );

  const pairs = game.rounds.flatMap((r) => r.pairs);
  const text = pairs.map((p) => `${p.left} ${p.right}`).join(" ");
  const sizes = game.rounds.map((r) => r.pairs.length);
  const accuracies: number[] = [];
  for (const [i, round] of game.rounds.entries())
    accuracies.push(await solveRound(round, 1000 + i));
  const solver = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;

  const checks = {
    jogoGerado: true,
    titulo: game.title.length > 0 && game.title.length <= 60,
    rodadasEntre3e5: sizes.every((s) => s >= MATCH_ROUND_MIN && s <= MATCH_ROUND_MAX),
    cobreMetadeDosCards: pairs.length >= Math.ceil(cards.length / 2),
    escritaDoIdioma: scriptShare(src.lang, text) >= 0.8,
    jogadorResolve90: solver >= 0.9,
  };
  const listing = game.rounds
    .map(
      (r, i) => `Rodada ${i + 1}\n${r.pairs.map((p) => `  ${p.left}  <->  ${p.right}`).join("\n")}`,
    )
    .join("\n");
  const cardText = cards.map((c, i) => `${i + 1}. ${c.question} => ${c.answer}`).join("\n");
  const judged = o.useJudge
    ? await judge(
        o.judgeModel,
        "column-matching game built from flashcards (each concept must match exactly one explanation, unambiguously, using only the flashcards' content)",
        cardText,
        listing,
        languageName(src.lang),
      )
    : undefined;
  const result = row(
    o,
    "match",
    src.id,
    checks,
    { ms, usage: { inputTokens: 0, outputTokens: 0 } },
    judged,
    `${game.title}\n${listing}`,
  );
  return { ...result, errorRate: 1 - solver };
}

export function matchJobs(ctx: Ctx, only?: string[]): Job[] {
  return sources()
    .filter((s) => !only?.length || only.includes(s.id))
    .map((src) => ({
      label: `match/flashmatch (cards -> jogo)/${src.id}`,
      run: () => evalMatch(src, ctx),
    }));
}
