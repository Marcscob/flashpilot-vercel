// Rotina reutilizável de varredura temática de flashcards.
// Hoje usada para "prazos", mas o formato (keywords + prompt) permite
// criar novas varreduras temáticas no futuro.

export type ScanTheme = {
  id: string;
  label: string;
  /** Regex (case-insensitive) usado como pré-filtro barato antes do PilotAI. */
  keywords: RegExp;
  /** Instrução dada à PilotAI para confirmar cada candidato. */
  criteria: string;
};

export const PRAZOS_THEME: ScanTheme = {
  id: "prazos",
  label: "Prazos e lapsos temporais",
  keywords:
    /(prazo|prazos|dia[s]?\b|dias úteis|hora[s]?\b|m[eê]s|meses|ano[s]?\b|quinzen|tempestiv|intempestiv|preclus|decad[êe]nc|prescri|termo inicial|termo final|dila[tç]|perempt|suspens\w* do prazo|interrup|contagem|feriad|f[ée]rias forenses|antecedência|imediatamente|in[ií]cio da contagem|d[ií]es a quo|d[ií]es ad quem|quinquídio|tríduo|decêndio|quindênio)/i,
  criteria: `Considere APROVADO (true) o card que trate de:
- prazo processual ou material (contagem, início, término, prorrogação, suspensão, interrupção);
- lapso temporal com efeito jurídico (preclusão, prescrição, decadência, tempestividade);
- obrigação, faculdade ou perda de direito condicionada a tempo determinado;
- regras de contagem (dias úteis/corridos, feriados, férias forenses, dies a quo/ad quem).

Considere REPROVADO (false) quando o tempo aparece de forma acidental ou irrelevante
(ex.: menção genérica a "ano" de uma lei, "a qualquer tempo" sem regra de prazo,
datas históricas, ou o card não versa sobre tempo).`,
};

export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildClassificationPrompt(theme: ScanTheme) {
  return `Você é um revisor jurídico que classifica flashcards de concurso público.

Tema da varredura: ${theme.label}.

${theme.criteria}

Você receberá uma lista JSON de cards com "id", "q" (pergunta) e "a" (resposta).
Responda SOMENTE JSON válido no formato:
{"results":[{"id":"<id>","match":true|false}, ...]}
Inclua TODOS os ids recebidos, sem texto extra.`;
}

import { GEMINI_CHAT_URL, geminiHeaders, geminiModel } from "./gemini-api.server";

export const AI_MODEL = geminiModel("google/gemini-3.1-flash-lite");

export async function classifyWithGateway(
  systemPrompt: string,
  items: Array<{ id: string; q: string; a: string }>,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  for (let attempt = 0; ; attempt += 1) {
    const resp = await fetch(GEMINI_CHAT_URL, {
      method: "POST",
      signal,
      headers: geminiHeaders(apiKey),
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(items) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2048,
      }),
    });

    if (resp.ok) {
      const json = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      };
      const choice = json.choices?.[0];
      if (choice?.finish_reason === "length") {
        throw new Error("A varredura recebeu uma resposta incompleta. Reduza o lote e tente novamente.");
      }
      const content = choice?.message?.content ?? "{}";
      let parsed: { results?: Array<{ id?: string; match?: boolean }> };
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("Resposta do PilotAI em formato inválido.");
      }
      const results = parsed.results;
      if (!Array.isArray(results)) {
        throw new Error("Resposta do PilotAI sem a lista de resultados esperada.");
      }
      const expectedIds = new Set(items.map((item) => item.id));
      const seenIds = new Set<string>();
      const ok = new Set<string>();
      for (const result of results) {
        if (
          !result
          || typeof result.id !== "string"
          || typeof result.match !== "boolean"
          || !expectedIds.has(result.id)
          || seenIds.has(result.id)
        ) {
          throw new Error("Resposta do PilotAI contém resultados inválidos ou duplicados.");
        }
        seenIds.add(result.id);
        if (result.match) ok.add(result.id);
      }
      if (seenIds.size !== expectedIds.size) {
        throw new Error("Resposta do PilotAI não classificou todos os cards do lote.");
      }
      return ok;
    }

    const body = await resp.text().catch(() => "");
    if (resp.status === 402) {
      throw new Error("Créditos do PilotAI esgotados. Adicione créditos para continuar a varredura.");
    }
    if (resp.status === 403) {
      throw new Error("O uso do PilotAI está bloqueado nas configurações do workspace.");
    }
    if ((resp.status === 429 || resp.status >= 500) && attempt < 2) {
      const retryAfter = Number(resp.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 10_000)
        : 1500 * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    if (resp.status === 429) {
      throw new Error("Muitas requisições do PilotAI. Aguarde alguns instantes e continue a varredura.");
    }
    throw new Error(`Falha no PilotAI (${resp.status}): ${body.slice(0, 180)}`);
  }
}
