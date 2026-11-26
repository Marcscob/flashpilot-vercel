import { afterEach, describe, expect, test } from "bun:test";
import { needsTranslationChoice } from "../src/lib/youtube-limits";
import { transcribeYoutubeWithGemini } from "../src/lib/youtube-video-fallback.server";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env["GEMINI_API_KEY"];
});

function mockGemini(text: string) {
  let body: {
    contents: Array<{ parts: Array<{ file_data?: { file_uri: string }; text?: string }> }>;
  };
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
      status: 200,
    });
  }) as typeof fetch;
  return () => body;
}

describe("YouTube sem legendas", () => {
  const url = "https://www.youtube.com/watch?v=wlTa_yTElGM";

  test("o Gemini lê o link do vídeo e devolve só o texto de estudo", async () => {
    process.env["GEMINI_API_KEY"] = "test";
    const sent = mockGemini("Velocidade média é a variação do espaço dividida pelo tempo.");
    const text = await transcribeYoutubeWithGemini(url, 600);
    expect(text).toContain("Velocidade média");
    expect(sent().contents[0].parts[0].file_data?.file_uri).toBe(url);
    expect(sent().contents[0].parts[1].text).toContain("propaganda");
  });

  test("vídeo sem conteúdo de estudo é recusado", async () => {
    process.env["GEMINI_API_KEY"] = "test";
    mockGemini("NO_STUDY_CONTENT");
    await expect(transcribeYoutubeWithGemini(url, 200)).rejects.toThrow("YOUTUBE_NO_STUDY_CONTENT");
  });

  test("vídeo longo demais sem legenda não é lido", async () => {
    process.env["GEMINI_API_KEY"] = "test";
    await expect(transcribeYoutubeWithGemini(url, 4000)).rejects.toThrow(
      "YOUTUBE_NO_CAPTIONS_TOO_LONG",
    );
  });

  test("sem chave do Gemini cai no aviso de falta de legendas", async () => {
    await expect(transcribeYoutubeWithGemini(url, 100)).rejects.toThrow("YOUTUBE_NO_CAPTIONS");
  });
});

describe("pergunta de tradução", () => {
  test("só pergunta quando o idioma do vídeo difere do idioma de saída", () => {
    expect(needsTranslationChoice("en", "pt-BR")).toBe(true);
    expect(needsTranslationChoice("pt", "pt-BR")).toBe(false);
    expect(needsTranslationChoice("", "pt-BR")).toBe(false);
    expect(needsTranslationChoice(undefined, "en")).toBe(false);
  });
});
