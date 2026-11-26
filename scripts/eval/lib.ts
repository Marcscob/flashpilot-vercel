import { base64ToBytes, geminiGenerateContentUrl, pcmToWav, requireGeminiKey } from "../../src/lib/gemini-api.server";

export type Usage = { inputTokens: number; outputTokens: number };
export type Generation = { text: string; ms: number; usage: Usage; finishReason: string };

let calls = 0;
export const callCount = () => calls;
let callLimit = Infinity;
export const setCallLimit = (n: number) => {
  callLimit = n;
};

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

const queues = new Map<string, Promise<void>>();
/** Modelos de cota baixa por minuto (Pro e TTS): serializa e espaça as chamadas. */
async function throttle(model: string) {
  const gap = model.includes("tts") ? Number(process.env["EVAL_TTS_GAP_MS"] ?? 7000) : model.includes("-pro") ? 3500 : 0;
  if (!gap) return;
  const key = model.includes("tts") ? "tts" : "pro";
  const turn = (queues.get(key) ?? Promise.resolve()).then(() => new Promise<void>((r) => setTimeout(r, gap)));
  queues.set(key, turn);
  await turn;
}

async function request(model: string, body: unknown): Promise<{ json: any; ms: number }> {
  for (let attempt = 0; ; attempt++) {
    if (calls >= callLimit) throw new Error(`Limite de chamadas (${callLimit}) atingido.`);
    await throttle(model);
    calls++;
    const started = Date.now();
    const res = await fetch(geminiGenerateContentUrl(model), {
      method: "POST",
      headers: { "x-goog-api-key": requireGeminiKey(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { json: await res.json(), ms: Date.now() - started };
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const wait = res.status === 429 ? Math.min(60_000, 6000 * 2 ** attempt) : 2000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`${model} ${res.status}: ${(await res.text()).replace(/\s+/g, " ").slice(0, 600)}`);
  }
}

export async function generate(
  model: string,
  opts: {
    system?: string;
    parts: Part[];
    json?: boolean;
    maxOutputTokens?: number;
    temperature?: number;
    thinkingLevel?: string;
    history?: Array<{ role: "user" | "model"; text: string }>;
  },
): Promise<Generation> {
  const { json, ms } = await request(model, {
    ...(opts.system ? { system_instruction: { parts: [{ text: opts.system }] } } : {}),
    contents: [
      ...(opts.history ?? []).map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: "user", parts: opts.parts },
    ],
    generationConfig: {
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
      ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      temperature: opts.temperature ?? 0.2,
      ...(opts.thinkingLevel ? { thinkingConfig: { thinkingLevel: opts.thinkingLevel } } : {}),
    },
  });
  const candidate = json.candidates?.[0];
  return {
    text: (candidate?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim(),
    ms,
    usage: {
      inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
      outputTokens:
        (json.usageMetadata?.candidatesTokenCount ?? 0) + (json.usageMetadata?.thoughtsTokenCount ?? 0),
    },
    finishReason: candidate?.finishReason ?? "UNKNOWN",
  };
}

export async function synthesize(model: string, text: string): Promise<Uint8Array> {
  const { json } = await request(model, {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    },
  });
  const data = json.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error("TTS sem áudio na resposta.");
  return pcmToWav(base64ToBytes(data));
}

export function parseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** WER por palavras, ou CER por caracteres para idiomas sem espaços. */
export function errorRate(reference: string, hypothesis: string, unit: "word" | "char"): number {
  const split = (t: string) => (unit === "word" ? normalize(t).split(" ").filter(Boolean) : [...normalize(t).replace(/ /g, "")]);
  const a = split(reference);
  const b = split(hypothesis);
  if (!a.length) return b.length ? 1 : 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length]! / a.length;
}

export type Judgement = {
  fidelity: number;
  coverage: number;
  clarity: number;
  no_hallucination: number;
  output_language_correct: boolean;
  comment: string;
};

export async function judge(
  judgeModel: string,
  task: string,
  source: string,
  output: string,
  outputLanguage: string,
): Promise<Judgement | null> {
  const result = await generate(judgeModel, {
    json: true,
    temperature: 0,
    maxOutputTokens: 4000,
    thinkingLevel: judgeModel.includes("-pro") ? undefined : "low",
    system: `You are a strict evaluator of AI-generated study material. Task evaluated: ${task}.
Score each criterion from 1 (very poor) to 5 (excellent):
- fidelity: every statement is supported by the source and correct.
- coverage: the output covers the key content of the source.
- clarity: wording is clear, atomic, natural and useful for studying.
- no_hallucination: 5 means nothing invented; 1 means many invented or wrong facts.
Also set output_language_correct=true only if the output is entirely in ${outputLanguage} (proper names and literal quotes excepted).
Return ONLY JSON: {"fidelity":n,"coverage":n,"clarity":n,"no_hallucination":n,"output_language_correct":bool,"comment":"one short sentence"}`,
    parts: [{ text: `SOURCE:\n${source}\n\nOUTPUT:\n${output}` }],
  });
  return parseJson<Judgement>(result.text);
}

import { readFileSync } from "node:fs";

export function filePart(path: string, mime: string): Part {
  return { inline_data: { mime_type: mime, data: readFileSync(path).toString("base64") } };
}

/** WAV 24 kHz/16-bit/mono (formato do TTS) -> amostras. */
export function wavSamples(wav: Uint8Array): Int16Array {
  return new Int16Array(wav.buffer.slice(wav.byteOffset + 44, wav.byteOffset + wav.byteLength));
}

export function samplesToWav(samples: Int16Array): Uint8Array {
  return pcmToWav(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
}

/** Ruído gaussiano para uma relação sinal-ruído aproximada em dB. */
export function addNoise(wav: Uint8Array, snrDb: number): Uint8Array {
  const s = wavSamples(wav);
  let power = 0;
  for (const v of s) power += v * v;
  const sigma = Math.sqrt(power / s.length / 10 ** (snrDb / 10));
  const out = new Int16Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const g = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
    out[i] = Math.max(-32768, Math.min(32767, Math.round(s[i]! + g * sigma)));
  }
  return samplesToWav(out);
}

export const silentWav = (seconds: number) => samplesToWav(new Int16Array(24_000 * seconds));