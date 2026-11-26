import { afterEach, expect, test } from "bun:test";
import {
  DEFAULT_VOICE,
  TTS_CACHE_VOICE,
  readingText,
  synthesizeAudioBytes,
} from "../src/lib/tts-cloud.server";

const originalFetch = globalThis.fetch;
const originalKey = process.env.GEMINI_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

test("complete bilingual card uses one Gemini request with the approved female Kore voice", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  const text = "O due process of law protege direitos. ".repeat(40);
  const requests: Array<{ url: string; body: any }> = [];
  globalThis.fetch = (async (url: any, init: any) => {
    requests.push({ url: String(url), body: JSON.parse(init.body) });
    return Response.json({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: btoa("\0\0\0\0") } }],
          },
        },
      ],
    });
  }) as typeof fetch;
  const result = await synthesizeAudioBytes(text, "pt-BR", "male-voice");
  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent",
  );
  expect(requests[0]?.body.contents[0].parts[0].text).toBe(readingText(text, "pt-BR"));
  expect(
    requests[0]?.body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
  ).toBe("Kore");
  expect(DEFAULT_VOICE).toBe("Kore");
  expect(result.mime).toBe("audio/wav");
  expect(new TextDecoder().decode(result.bytes.slice(0, 4))).toBe("RIFF");
  expect(TTS_CACHE_VOICE).toBe("gemini-2.5-flash-preview-tts-kore-single-v4-text-only");
});

test("provider denial is terminal without another synthesis or provider fallback", async () => {
  process.env.GEMINI_API_KEY = "test-only";
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response("denied", { status: 403 });
  }) as typeof fetch;
  await expect(synthesizeAudioBytes("Due process of law", "pt-BR", undefined)).rejects.toThrow(
    "Google bloqueou",
  );
  expect(calls).toBe(1);
});

test("missing Gemini configuration never silently uses Google Cloud", async () => {
  delete process.env.GEMINI_API_KEY;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response();
  }) as typeof fetch;
  await expect(synthesizeAudioBytes("Olá", "pt", undefined)).rejects.toThrow("GEMINI_API_KEY");
  expect(calls).toBe(0);
});

test("narration request carries only the content, never reading instructions", () => {
  for (const [language, text] of [["pt", "Capítulo 1 - Introdução ao Python."], ["ja", "こんにちは。"], ["ar", "مرحبا."]] as const) {
    expect(readingText(text, language)).toBe(text);
  }
});
