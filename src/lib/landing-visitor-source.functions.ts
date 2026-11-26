import { parseJsonLenient } from "./json-repair";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LANDING_LIMIT_ERROR } from "./landing-rules";

const SOURCE_LIMITS = { perClientPerDay: 8, globalPerDay: 600, maxTextChars: 15_000 };
const MAX_IMAGE_B64 = 6_000_000;
const MAX_AUDIO_B64 = 8_400_000;

const SourceInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("image"),
    dataUrl: z.string().min(20).max(MAX_IMAGE_B64),
    lang: z.string().max(12).default("pt"),
  }),
  z.object({
    kind: z.literal("audio"),
    dataUrl: z.string().min(20).max(MAX_AUDIO_B64),
    mimeType: z.string().max(80),
    lang: z.string().max(12).default("pt"),
  }),
  z.object({
    kind: z.literal("youtube"),
    url: z.string().max(2048),
    lang: z.string().max(12).default("en"),
  }),
  z.object({ kind: z.literal("web"), url: z.string().max(2048) }),
]);

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"];
const AUDIO_MIMES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"];

async function reserveSource(): Promise<void> {
  const { reserveDevice } = await import("./landing-device.server");
  const ok = await reserveDevice(
    "landing-source",
    SOURCE_LIMITS.perClientPerDay,
    SOURCE_LIMITS.globalPerDay,
  );
  if (!ok) throw new Error(LANDING_LIMIT_ERROR);
}
function splitDataUrl(value: string, allowed: string[], fallbackMime?: string) {
  const match = value.match(/^data:([^;,]+)[^,]*;base64,(.+)$/s);
  const mime = (match?.[1] ?? fallbackMime ?? "").split(";")[0]!.toLowerCase();
  const b64 = match?.[2] ?? value;
  if (!allowed.includes(mime) || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) {
    throw new Error("Formato de arquivo não suportado.");
  }
  return { mime, b64: b64.replace(/\s/g, "") };
}

const READ_FAILED = "Não foi possível ler o material agora. Tente novamente em instantes.";

async function gatewayExtract(
  prompt: string,
  mime: string,
  b64: string,
  signal: AbortSignal,
): Promise<string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error(READ_FAILED);
  if (mime.startsWith("audio/")) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new File([bytes], "audio", { type: mime }));
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      signal,
      headers: { Authorization: `Bearer ${lovableKey}` },
      body: form,
    });
    if (!resp.ok) {
      console.error(
        "Landing gateway transcription failed",
        resp.status,
        (await resp.text().catch(() => "")).slice(0, 300),
      );
      throw new Error(READ_FAILED);
    }
    return (((await resp.json()) as { text?: string }).text ?? "").trim();
  }
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        },
      ],
    }),
  });
  if (!resp.ok) {
    console.error(
      "Landing gateway extraction failed",
      resp.status,
      (await resp.text().catch(() => "")).slice(0, 300),
    );
    throw new Error(READ_FAILED);
  }
  const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}

async function geminiExtract(
  prompt: string,
  mime: string,
  b64: string,
  opts: { model: string; speechOnly?: boolean } = { model: "gemini-3.1-flash-lite" },
): Promise<string> {
  const { geminiApiKey, geminiGenerateContentUrl } = await import("./gemini-api.server");
  const key = geminiApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    if (key) {
      try {
        const resp = await fetch(geminiGenerateContentUrl(opts.model), {
          method: "POST",
          signal: controller.signal,
          headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }],
              },
            ],
            ...(opts.speechOnly
              ? { generationConfig: { responseMimeType: "application/json", temperature: 0 } }
              : {}),
          }),
        });
        if (resp.ok) {
          const json = (await resp.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const raw = (json.candidates?.[0]?.content?.parts ?? [])
            .map((p) => p.text ?? "")
            .join("")
            .trim();
          if (!opts.speechOnly) return raw;
          const parsed = parseJsonLenient(raw) as { has_speech?: boolean; transcript?: unknown } | undefined;
          if (parsed && typeof parsed === "object" && "has_speech" in parsed) {
            return parsed.has_speech ? String(parsed.transcript ?? "").trim() : "";
          }
          return raw;
        }
        console.error(
          "Landing Gemini extraction failed",
          resp.status,
          (await resp.text().catch(() => "")).slice(0, 300),
        );
      } catch (error) {
        if (controller.signal.aborted) throw new Error(READ_FAILED);
        console.error("Landing Gemini extraction error", error);
      }
    }
    const { logAiFallback } = await import("./ai-fallback-log.server");
    await logAiFallback(
      "landing-source",
      opts.model,
      mime.startsWith("audio/") ? "openai/gpt-4o-mini-transcribe" : "google/gemini-3.1-flash-lite (gateway)",
      key ? "falha" : "GEMINI_API_KEY ausente",
    );
    return await gatewayExtract(prompt, mime, b64, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Public, throttled extraction of text from a photo, audio or YouTube video for the landing instant test. */
export const extractLandingVisitorSourceFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SourceInput.parse(input))
  .handler(async ({ data }) => {
    let text = "";
    if (data.kind === "youtube") {
      const { canonicalYoutubeUrl } = await import("./youtube-url");
      if (!canonicalYoutubeUrl(data.url)) throw new Error("Link do YouTube inválido");
      await reserveSource();
      const { readYoutubeTranscript } = await import("./youtube.server");
      text = (await readYoutubeTranscript(data.url, data.lang)).text;
    } else if (data.kind === "web") {
      const { validateWebPageUrl } = await import("./web-page-text");
      validateWebPageUrl(data.url);
      await reserveSource();
      const { readWebPage } = await import("./web-page.server");
      text = (await readWebPage(data.url)).text;
    } else if (data.kind === "image") {
      const { mime, b64 } = splitDataUrl(data.dataUrl, IMAGE_MIMES);
      await reserveSource();
      text = await geminiExtract(
        "Extract all the readable text and the key educational content from this image, in its original language. Describe diagrams or figures briefly when they carry study content. Return only the extracted content, with no comments.",
        mime,
        b64,
        { model: "gemini-3-flash-preview" },
      );
    } else {
      const { mime, b64 } = splitDataUrl(data.dataUrl, AUDIO_MIMES, data.mimeType);
      await reserveSource();
      text = await geminiExtract(
        "Listen to the audio. Decide whether it contains intelligible HUMAN SPEECH. Silence, background noise, hiss, music or clicks are NOT speech.\nTranscribe exactly what is said, in the language it was spoken.\nReturn ONLY JSON: {\"has_speech\": true|false, \"transcript\": \"exact words spoken; empty string when has_speech is false\"}.\nNever invent or guess words. No comments, no quotes around the transcript, no formatting.",
        mime,
        b64,
        { model: "gemini-3.1-flash-lite", speechOnly: true },
      );
    }
    text = text.trim().slice(0, SOURCE_LIMITS.maxTextChars);
    if (!/[\p{L}\p{N}]{3,}/u.test(text)) {
      throw new Error("Não encontramos conteúdo suficiente neste material. Tente outro.");
    }
    return { text };
  });
