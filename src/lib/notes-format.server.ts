import { sanitizeApostilaHtml } from "@/lib/note-format";
import { splitNoteHtml } from "@/lib/note-chunks";
import { GEMINI_CHAT_URL, geminiHeaders, geminiModel } from "./gemini-api.server";

const systemPrompt = `Você é um diagramador de apostilas de estudo. Recebe o HTML bruto de uma anotação e devolve o MESMO conteúdo reorganizado em padrão didático, pronto para impressão.

REGRAS DE CONTEÚDO
- Use SOMENTE informações presentes na anotação. Nunca invente fatos, leis, números, súmulas ou jurisprudência.
- Você pode reorganizar, agrupar por tema, dividir parágrafos longos, criar seções, corrigir ortografia e pontuação e tornar o texto mais didático.
- Não elimine informação relevante. Nada de resumos que percam conteúdo.
- Preserve integralmente as tags <img> (com seu src) e as tabelas existentes.

REGRAS DE FORMATAÇÃO (HTML restrito)
- Título principal da anotação: <p><span class="note-h1">Texto</span></p>
- Seções: <p><span class="note-h2">Texto</span></p>
- Subseções: <p><span class="note-h3">Texto</span></p>
- Parágrafos comuns: <p>Texto</p>
- Listas: <ul><li>...</li></ul> ou <ol><li>...</li></ol>
- Destaques (Atenção, Pegadinha de concurso, Referência (Lei Seca), Dica): <blockquote><p><span class="note-h3">Atenção</span></p><p>...</p></blockquote>
- Comparações: <table><tbody><tr><td>...</td></tr></tbody></table>
- Separador entre grandes blocos, quando útil: <hr>
- PERMITIDAS apenas estas tags: p, span, ul, ol, li, blockquote, table, thead, tbody, tr, th, td, img, hr, br, em, u.
- NUNCA use markdown (**, #, -), <h1>..<h6>, <strong>, <b>, <div>, <section>, atributos style, class fora de note-h1/note-h2/note-h3, ou blocos de código.

SAÍDA
- Devolva SOMENTE o HTML final, sem comentários, sem crases, sem explicação.`;

function stripCodeFence(text: string): string {
  return text
    .replace(/^\s*```(?:html)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function providerError(status: number, body: string): Error {
  if (status === 401 || status === 403) {
    return new Error("O Gemini rejeitou a chave de acesso. Atualize a GEMINI_API_KEY.");
  }
  if (status === 413) {
    return new Error("A anotação ultrapassa o limite do PilotAI. Divida o texto em partes menores.");
  }
  if (status === 429) {
    return new Error("O limite temporário do PilotAI foi atingido. Aguarde um minuto e tente novamente.");
  }
  if (status >= 500) {
    return new Error("O PilotAI está temporariamente indisponível. Tente novamente em instantes.");
  }
  const detail = body.slice(0, 180).replace(/\s+/g, " ").trim();
  return new Error(`Falha no PilotAI (${status})${detail ? `: ${detail}` : "."}`);
}

const GEMINI_MODELS = [geminiModel("google/gemini-3.1-flash-lite")];
const MIN_ADAPTIVE_CHARS = 280;
const MAX_TRANSIENT_RETRIES = 2;
const MAX_FORMAT_PROVIDER_CALLS = 120;

type ProviderRequestBudget = { used: number };

class ProviderSizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderSizeError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function formatChunk(
  chunk: string,
  title: string,
  geminiKey: string,
  isFirst: boolean,
  requestBudget: ProviderRequestBudget,
  signal?: AbortSignal,
): Promise<string> {
  const userContent = isFirst
    ? `Título da anotação: ${title || "(sem título)"}\n\nHTML da anotação:\n${chunk}`
    : `Continuação da anotação "${title || "(sem título)"}". Formate APENAS este trecho, sem repetir o título principal e sem introduções.\n\nHTML do trecho:\n${chunk}`;

  let lastError: Error | null = null;
  for (const model of GEMINI_MODELS) {
    let transientAttempt = 0;
    let response: Response;
    for (;;) {
      if (requestBudget.used >= MAX_FORMAT_PROVIDER_CALLS) {
        throw new Error(
          "A formatação atingiu o limite de chamadas ao provedor neste trabalho. Tente com uma anotação menor.",
        );
      }
      requestBudget.used += 1;
      response = await fetch(GEMINI_CHAT_URL, {
        method: "POST",
        signal,
        headers: geminiHeaders(geminiKey),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        }),
      });
      if (response.status !== 429 && response.status < 500) break;
      if (transientAttempt >= MAX_TRANSIENT_RETRIES) break;
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 10_000)
        : 1000 * 2 ** transientAttempt + Math.floor(Math.random() * 300);
      transientAttempt += 1;
      await sleep(delay);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      lastError = providerError(response.status, body);
      if (response.status === 413 && /rate_limit_exceeded|tokens per minute|TPM/i.test(body)) {
        throw new Error("O pedido ultrapassou o limite de tokens por minuto do PilotAI. Aguarde um minuto e tente novamente.");
      }
      if (response.status === 413 || (response.status === 400 && /token|context|length|large/i.test(body))) {
        throw new ProviderSizeError(lastError.message);
      }
      // Só troca de modelo quando o identificador está indisponível.
      if ((response.status === 404 || response.status === 400) && /model|decommission|exist/i.test(body)) continue;
      throw lastError;
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };
    const choice = json.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new ProviderSizeError("O PilotAI interrompeu a resposta antes de concluir este trecho.");
    }

    const html = sanitizeApostilaHtml(stripCodeFence(choice?.message?.content ?? ""));
    if (!html.trim()) throw new Error("O PilotAI não retornou conteúdo formatado.");
    return html;
  }

  throw lastError ?? new Error("Nenhum modelo do PilotAI disponível.");
}

async function formatChunkAdaptively(
  chunk: string,
  title: string,
  geminiKey: string,
  isFirst: boolean,
  requestBudget: ProviderRequestBudget,
  signal?: AbortSignal,
): Promise<string> {
  const queue = [chunk];
  const output: string[] = [];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    try {
      output.push(await formatChunk(
        current,
        title,
        geminiKey,
        isFirst && output.length === 0,
        requestBudget,
        signal,
      ));
    } catch (error) {
      if (!(error instanceof ProviderSizeError)) throw error;
      if (current.length <= MIN_ADAPTIVE_CHARS) {
        throw new Error(`${error.message} O trecho já está no tamanho mínimo seguro (${current.length} caracteres).`);
      }
      const parts = splitNoteHtml(current, Math.max(MIN_ADAPTIVE_CHARS, Math.floor(current.length / 2)));
      if (parts.length < 2) {
        throw new Error(`${error.message} Não foi possível subdividir a estrutura HTML sem corrompê-la.`);
      }
      queue.unshift(...parts);
    }
  }
  return output.join("\n");
}

export async function formatNoteWithGroq(data: { title: string; html: string }, signal?: AbortSignal) {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (!geminiKey) throw new Error("GEMINI_API_KEY não configurada.");

  const chunks = splitNoteHtml(data.html);
  const results: string[] = [];
  const requestBudget: ProviderRequestBudget = { used: 0 };

  for (let i = 0; i < chunks.length; i++) {
    const currentChunk = chunks[i];
    if (!currentChunk) continue;
    try {
      if (i > 0) await sleep(300);
      results.push(await formatChunkAdaptively(
        currentChunk,
        data.title,
        geminiKey,
        i === 0,
        requestBudget,
        signal,
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      if (results.length === 0) {
        throw new Error(`A formatação falhou na parte 1 de ${chunks.length}: ${message}`);
      }
      throw new Error(
        `A formatação parou na parte ${i + 1} de ${chunks.length}: ${message}`,
      );
    }
  }


  const html = results.join("\n");
  if (!html.trim()) throw new Error("O PilotAI não retornou conteúdo formatado.");
  return { html, parts: chunks.length };
}

export async function formatNotePartWithGroq(
  data: { title: string; chunk: string; isFirst: boolean },
  signal?: AbortSignal,
) {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (!geminiKey) throw new Error("GEMINI_API_KEY não configurada.");
  const html = await formatChunkAdaptively(
    data.chunk, data.title, geminiKey, data.isFirst, { used: 0 }, signal,
  );
  if (!html.trim()) throw new Error("O PilotAI não retornou conteúdo formatado.");
  return { html };
}
