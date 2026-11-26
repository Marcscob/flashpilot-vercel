/**
 * Avaliações das demais funcionalidades de IA (texto): tradução de card, roteiro de microvídeo,
 * mapa mental, varredura de prazos e tutor de conversação. Usam os prompts do app quando eles
 * são exportados (prazos, tutor); roteiro, mapa e tradução são cópias — atualize se mudarem.
 * Fora de escopo aqui: visão (foto/PDF escaneado/ImagePilot) e imagem do blog, que exigem
 * arquivos reais; TTS é coberto pela ida e volta do STT.
 */
import { buildClassificationPrompt, PRAZOS_THEME } from "../../src/lib/prazos-scan.server";
import { splitCorrection, stripMarkup, systemPromptFor } from "../../src/lib/language-chat.server";
import { generate, judge, parseJson, type Judgement } from "./lib";

export type FeatureRow = {
  feature: string;
  model: string;
  caseId: string;
  checks: Record<string, boolean>;
  checkScore: number;
  judge?: Judgement | null;
  judgeScore?: number;
  errorRate?: number;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  sample?: string;
};

export type Spec = { model: string; thinkingLevel?: string; maxTokens: number };
export type Opts = { spec: Spec; label: string; useJudge: boolean; judgeModel: string };

export const score = (checks: Record<string, boolean>) => {
  const v = Object.values(checks);
  return v.filter(Boolean).length / v.length;
};
export const average = (j: Judgement | null | undefined) =>
  j ? (j.fidelity + j.coverage + j.clarity + j.no_hallucination) / 4 : undefined;
const MARKDOWN = /[*_`#]{1,}/;
export const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

export function row(o: Opts, feature: string, caseId: string, checks: Record<string, boolean>, g: { ms: number; usage: { inputTokens: number; outputTokens: number } }, judged: Judgement | null | undefined, sample: string, judgeScore?: number): FeatureRow {
  return {
    feature, model: o.label, caseId, checks, checkScore: score(checks), judge: judged,
    judgeScore: judgeScore ?? average(judged), ms: g.ms,
    inputTokens: g.usage.inputTokens, outputTokens: g.usage.outputTokens, sample: sample.slice(0, 600),
  };
}

// ---------- tradução de card ----------
export const TRANSLATE_CASES = [
  { id: "pt-en-mcq", from: "Portuguese", to: "English", language: "English", text: "Qual é o prazo para apresentar a contestação?\nA) 5 dias\nB) 15 dias úteis\nC) 30 dias corridos\nD) 60 dias" },
  { id: "en-es-cloze", from: "English", to: "Spanish", language: "Spanish", text: "The mitochondria is the organelle responsible for ______ and produces most of the cell's ATP.\n\nFull answer: cellular respiration" },
  { id: "es-pt-qa", from: "Spanish", to: "Brazilian Portuguese", language: "Brazilian Portuguese", text: "¿Cuándo se firmó la Declaración de Independencia argentina?\n\nRespuesta: El 9 de julio de 1816, en el Congreso de Tucumán." },
  { id: "pt-ja-qa", from: "Portuguese", to: "Japanese", language: "Japanese", text: "O que é inflação?\n\nResposta: Aumento sustentado do nível geral de preços de bens e serviços." },
];

export async function evalTranslate(o: Opts, c: (typeof TRANSLATE_CASES)[number]): Promise<FeatureRow> {
  const system = [
    `You translate flashcard text from ${c.from} into ${c.to}.`,
    "Keep the structure exactly: line breaks, blanks made of underscores, and option letters (A), B), C), D)) stay in place.",
    "Translate labels too (e.g. Full answer:, Option B)) into the target language.",
    "Plain text only: never use asterisks, underscores for emphasis, backticks or markdown.",
    "Return only the translated text: no quotes, no notes, no explanations.",
  ].join(" ");
  const g = await generate(o.spec.model, { system, parts: [{ text: c.text }], thinkingLevel: o.spec.thinkingLevel, maxOutputTokens: o.spec.maxTokens, temperature: 0.2 });
  const out = stripMarkup(g.text);
  const count = (t: string, re: RegExp) => (t.match(re) ?? []).length;
  const checks = {
    naoVazio: out.length > 0,
    semTruncamento: g.finishReason !== "MAX_TOKENS",
    linhasPreservadas: count(out, /\n/g) === count(c.text, /\n/g),
    opcoesPreservadas: count(out, /^[A-D]\)/gm) === count(c.text, /^[A-D]\)/gm),
    lacunasPreservadas: count(out, /_{3,}/g) === count(c.text, /_{3,}/g),
    semMarkdown: !/[*`#]/.test(g.text),
  };
  const j = o.useJudge && out ? await judge(o.judgeModel, `flashcard translation from ${c.from} to ${c.to} (must be faithful and keep structure)`, c.text, out, c.language) : undefined;
  return row(o, "translate", c.id, checks, g, j, out);
}

// ---------- roteiro de microvídeo ----------
export const VIDEO_CASES = [
  { id: "pt-prazo", lang: "Brazilian Portuguese", question: "Qual o prazo para contestar no CPC?", answer: "15 dias úteis, contados da audiência de conciliação ou da juntada do mandado de citação, conforme o caso." },
  { id: "en-rubisco", lang: "English", question: "What does Rubisco do in photosynthesis?", answer: "It catalyses the first major step of carbon fixation in the Calvin cycle, attaching CO2 to RuBP." },
  { id: "es-san-martin", lang: "Spanish", question: "¿Qué batalla permitió liberar Chile en 1817?", answer: "La batalla de Chacabuco, tras el cruce de los Andes por el Ejército de los Andes." },
];

export async function evalVideo(o: Opts, c: (typeof VIDEO_CASES)[number]): Promise<FeatureRow> {
  const system = `You write a 20-35 second educational micro-video script for the FlashPilot-TV player, explaining ONE flashcard.
Narrator: a young female student, friendly and didactic. Visual style: avatar plus kinetic text and diagrams.
ALL narration and on-screen text MUST be written in ${c.lang}. Keep foreign technical terms (e.g. English words being studied) exactly as they appear in the card; never translate them.
Be faithful to the card; never invent facts. Write numbers/legal articles as they should be spoken.
The LAST scene is the wrap-up (the answer/gabarito). Its narration MUST begin by restating the card's QUESTION as a concise, faithful question before any answer or explanation. Use the exact wording when it is already in ${c.lang}; otherwise translate it faithfully into ${c.lang}. Put the same recap in questionRecap so the player displays it on its own line. Never replace the question with a generic answer label or hide it only in the kicker/bullets. Only after the question recap may you give the answer and why.
Return JSON only: {"scenes":[{"emoji":"one emoji","kicker":"short label","title":"headline up to 6 words","bullets":["up to 3 short lines"],"questionRecap":"question recap on the last scene; empty otherwise","speech":"narration for this scene, 1-2 sentences"}]} with 3 or 4 scenes.`;
  const g = await generate(o.spec.model, { system, parts: [{ text: `QUESTION:\n${c.question}\n\nANSWER:\n${c.answer}` }], thinkingLevel: o.spec.thinkingLevel, maxOutputTokens: o.spec.maxTokens, temperature: 0.2 });
  type Scene = { emoji?: string; title?: string; bullets?: string[]; questionRecap?: string; speech?: string };
  const parsed = parseJson<{ scenes?: Scene[] }>(g.text);
  const scenes = Array.isArray(parsed?.scenes) ? parsed!.scenes! : [];
  const last = scenes.at(-1);
  const spoken = scenes.reduce((n, s) => n + words(String(s.speech ?? "")), 0);
  const checks = {
    jsonValido: parsed !== null,
    tresOuQuatroCenas: scenes.length === 3 || scenes.length === 4,
    falasPreenchidas: scenes.length > 0 && scenes.every((s) => String(s.speech ?? "").trim() && String(s.title ?? "").trim()),
    titulosCurtos: scenes.every((s) => words(String(s.title ?? "")) <= 8),
    ate3Bullets: scenes.every((s) => (s.bullets ?? []).length <= 3),
    recapNaUltima: Boolean(last?.questionRecap?.trim()),
    duracaoPlausivel: spoken >= 35 && spoken <= 120,
    semTruncamento: g.finishReason !== "MAX_TOKENS",
  };
  const out = scenes.map((s, i) => `Scene ${i + 1}: ${s.title}\n${s.speech}\nrecap: ${s.questionRecap ?? ""}`).join("\n\n");
  const j = o.useJudge && scenes.length ? await judge(o.judgeModel, "20-35 s micro-video script for one flashcard; the last scene must restate the question then answer", `QUESTION: ${c.question}\nANSWER: ${c.answer}`, out, c.lang) : undefined;
  return row(o, "video", c.id, checks, g, j, out);
}

// ---------- mapa mental ----------
export const MINDMAP_CASES = [
  { id: "en-photosynthesis", lang: "English", title: "Photosynthesis", text: "Photosynthesis converts light energy into chemical energy stored in glucose. It occurs in chloroplasts. Light-dependent reactions occur in thylakoid membranes and produce ATP, NADPH and oxygen. The Calvin cycle occurs in the stroma and fixes CO2 using Rubisco. Limiting factors: light intensity, CO2 concentration, temperature. C4 plants reduce photorespiration." },
  { id: "pt-recursos", lang: "Brazilian Portuguese", title: "Recursos no CPC", text: "Apelação: 15 dias úteis, contra sentença. Agravo de instrumento: 15 dias úteis, hipóteses do art. 1.015. Embargos de declaração: 5 dias úteis, interrompem o prazo dos demais recursos. Recurso especial: 15 dias úteis, STJ, exige prequestionamento. Recurso extraordinário: 15 dias úteis, STF, exige repercussão geral." },
];

export async function evalMindmap(o: Opts, c: (typeof MINDMAP_CASES)[number]): Promise<FeatureRow> {
  const system = [
    `You turn study material into a mind map outline written entirely in ${c.lang}.`,
    "Structure: one short central title, then 4 to 7 main branches, each with 2 to 4 children.",
    "Labels are short: 2 to 7 words, no full sentences, no numbering, no trailing punctuation.",
    "Group related ideas under the same branch; keep the logical order of the source.",
    "Plain text only: never use asterisks, underscores, backticks or markdown.",
    'Answer with JSON only, exactly this shape: {"title":"...","nodes":[{"label":"...","children":[{"label":"..."}]}]}',
  ].join(" ");
  const g = await generate(o.spec.model, { system, parts: [{ text: `Suggested title: ${c.title}\nSource material:\n${c.text}` }], thinkingLevel: o.spec.thinkingLevel, maxOutputTokens: o.spec.maxTokens, temperature: 0.2 });
  type Node = { label?: string; children?: Node[] };
  const parsed = parseJson<{ title?: string; nodes?: Node[] }>(g.text);
  const nodes = Array.isArray(parsed?.nodes) ? parsed!.nodes! : [];
  const labels: string[] = [];
  const walk = (ns: Node[]) => ns.forEach((n) => { labels.push(String(n.label ?? "")); walk(n.children ?? []); });
  walk(nodes);
  const checks = {
    jsonValido: parsed !== null,
    titulo: Boolean(parsed?.title?.trim()),
    ramos: nodes.length >= 3 && nodes.length <= 8,
    comFilhos: nodes.filter((n) => (n.children ?? []).length > 0).length >= Math.ceil(nodes.length / 2),
    rotulosCurtos: labels.length > 0 && labels.every((l) => l.trim() && words(l) <= 8),
    semMarkdown: !labels.some((l) => MARKDOWN.test(l)),
    semTruncamento: g.finishReason !== "MAX_TOKENS",
  };
  const out = nodes.map((n) => `${n.label}\n${(n.children ?? []).map((k) => `  - ${k.label}`).join("\n")}`).join("\n");
  const j = o.useJudge && nodes.length ? await judge(o.judgeModel, "mind map outline of study material (short labels, faithful structure)", c.text, `${parsed?.title}\n${out}`, c.lang) : undefined;
  return row(o, "mindmap", c.id, checks, g, j, out);
}

// ---------- varredura de prazos (gabarito conhecido) ----------
const PRAZOS_ITEMS: Array<{ id: string; q: string; a: string; match: boolean }> = [
  { id: "1", q: "Qual o prazo para apelar?", a: "15 dias úteis.", match: true },
  { id: "2", q: "O que ocorre com o direito de recorrer após o prazo?", a: "Ocorre preclusão temporal.", match: true },
  { id: "3", q: "Quanto tempo tem a Fazenda para se manifestar?", a: "Prazo em dobro para todas as manifestações.", match: true },
  { id: "4", q: "Como se conta o prazo processual?", a: "Exclui-se o dia do começo e inclui-se o dia do vencimento, em dias úteis.", match: true },
  { id: "5", q: "Qual o prazo prescricional da pretensão de reparação civil?", a: "Três anos.", match: true },
  { id: "6", q: "Qual a natureza da ação popular?", a: "Instrumento de controle da administração pública pelo cidadão.", match: false },
  { id: "7", q: "Quem julga mandado de segurança contra ato do Presidente da República?", a: "O STF.", match: false },
  { id: "8", q: "Em que ano foi promulgada a Constituição Federal vigente?", a: "Em 1988.", match: false },
  { id: "9", q: "Qual princípio rege a Administração Pública no art. 37?", a: "Legalidade, impessoalidade, moralidade, publicidade e eficiência.", match: false },
  { id: "10", q: "Quando se dá a decadência do direito de anular o ato administrativo?", a: "Em cinco anos, contados da data em que foram praticados.", match: true },
  { id: "11", q: "Pode o juiz conhecer de matéria de ordem pública a qualquer tempo?", a: "Sim, a qualquer tempo e grau de jurisdição.", match: false },
  { id: "12", q: "O que é o dies a quo?", a: "O termo inicial da contagem de um prazo.", match: true },
];
export const PRAZOS_CASES = [{ id: "lote-12" }];

export async function evalPrazos(o: Opts, c: (typeof PRAZOS_CASES)[number]): Promise<FeatureRow> {
  const g = await generate(o.spec.model, {
    system: buildClassificationPrompt(PRAZOS_THEME),
    parts: [{ text: JSON.stringify(PRAZOS_ITEMS.map(({ id, q, a }) => ({ id, q, a }))) }],
    json: true,
    thinkingLevel: o.spec.thinkingLevel,
    maxOutputTokens: o.spec.maxTokens,
    temperature: 0,
  });
  const parsed = parseJson<{ results?: Array<{ id?: string; match?: boolean }> }>(g.text);
  const results = Array.isArray(parsed?.results) ? parsed!.results! : [];
  const ids = results.map((r) => r.id);
  const truth = new Map(PRAZOS_ITEMS.map((i) => [i.id, i.match]));
  const correct = results.filter((r) => r.id && truth.get(r.id) === r.match).length;
  const accuracy = correct / PRAZOS_ITEMS.length;
  const checks = {
    jsonValido: parsed !== null,
    todosOsIds: new Set(ids).size === PRAZOS_ITEMS.length && ids.every((id) => truth.has(String(id))),
    booleanos: results.every((r) => typeof r.match === "boolean"),
    semTruncamento: g.finishReason !== "MAX_TOKENS",
    acuracia90: accuracy >= 0.9,
  };
  return row(o, "prazos", c.id, checks, g, undefined, `acurácia ${(accuracy * 100).toFixed(0)}% (${correct}/${PRAZOS_ITEMS.length})`, 5 * accuracy);
}

// ---------- tutor de conversação ----------
export const CHAT_CASES = [
  { id: "en-beginner-pt-input", lang: "en", language: "English", config: { level: "beginner" } as { level?: string; mode?: string }, user: "Oi! Eu quero praticar inglês para viajar. Como eu peço um café?" },
  { id: "en-teacher-error", lang: "en", language: "English", config: { mode: "teacher" } as { level?: string; mode?: string }, user: "Yesterday I go to the market and buyed three apple.", expectCorrection: true },
  { id: "es-intermediate", lang: "es", language: "Spanish", config: { level: "intermediate" } as { level?: string; mode?: string }, user: "Hola, ayer fui al cine con mis amigos y vimos una película muy divertida." },
  { id: "fr-free", lang: "fr", language: "French", config: {} as { level?: string; mode?: string }, user: "Bonjour, je voudrais apprendre à parler de mon travail." },
];

export async function evalChat(o: Opts, c: (typeof CHAT_CASES)[number]): Promise<FeatureRow> {
  const system = systemPromptFor(c.lang, c.config);
  const g = await generate(o.spec.model, { system, parts: [{ text: c.user }], thinkingLevel: o.spec.thinkingLevel ?? "low", maxOutputTokens: 1024, temperature: 0.7 });
  const { reply, correction } = splitCorrection(g.text);
  const plain = stripMarkup(reply);
  const expectCorrection = "expectCorrection" in c && c.expectCorrection;
  const checks = {
    naoVazio: plain.length > 0,
    semTruncamento: g.finishReason !== "MAX_TOKENS",
    semMarcacao: !/[*`#]/.test(reply),
    curto: words(plain) <= 90,
    terminaComPergunta: /[?？¿]\s*$/.test(plain),
    correcaoQuandoEsperada: !expectCorrection || Boolean(correction?.corrected),
    semCorrecaoNoTexto: !/CORRECTION|"original"/.test(plain),
  };
  const j = o.useJudge && plain ? await judge(o.judgeModel, `conversation tutor reply for a language learner (must reply in ${c.language}, short natural sentences, engage the learner)`, `LEARNER: ${c.user}`, plain, c.language) : undefined;
  return row(o, "chat", c.id, checks, g, j, `${plain}${correction ? `\n[correction] ${JSON.stringify(correction)}` : ""}`);
}
