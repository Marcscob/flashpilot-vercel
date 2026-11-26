import { afterEach, describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { readYoutubeTranscript } from "../src/lib/youtube.server";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const VIDEO = "https://www.youtube.com/watch?v=wlTa_yTElGM&list=PLzjR7HXQnrcf84SMs9pE7XycU--cRAls4";
const player = (baseUrl = "https://www.youtube.com/api/timedtext?v=wlTa_yTElGM&lang=en") =>
  new Response(
    JSON.stringify({
      playabilityStatus: { status: "OK" },
      videoDetails: { title: "Aula de teste" },
      captions: {
        playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl, languageCode: "en" }] },
      },
    }),
    { status: 200 },
  );
const xml = `<?xml version="1.0"?><timedtext><body><p t="0">Hello everyone</p><p t="2000">welcome to the lesson</p></body></timedtext>`;

/** Imita o runtime de borda (Cloudflare Workers), que rejeita redirect: "error". */
function edgeFetch(handler: (url: string, init: RequestInit) => Response) {
  const seen: RequestInit[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (init.redirect === "error") {
      throw new TypeError(
        'Invalid redirect value, must be one of "follow" or "manual" ("error" won\'t be implemented since it does not make sense at the edge; use "manual" and check the response status code).',
      );
    }
    seen.push(init);
    return handler(String(input), init);
  }) as typeof fetch;
  return seen;
}

describe("transcrição do YouTube no runtime de borda", () => {
  it("lê a legenda sem usar redirect: error", async () => {
    edgeFetch((url) => (url.includes("youtubei") ? player() : new Response(xml, { status: 200 })));
    const result = await readYoutubeTranscript(VIDEO, "en");
    expect(result.text).toBe("Hello everyone\nwelcome to the lesson");
    expect(result.title).toBe("Aula de teste");
  });

  it("recusa legenda que redireciona (proteção contra SSRF)", async () => {
    edgeFetch((url) =>
      url.includes("youtubei")
        ? player()
        : new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }),
    );
    await expect(readYoutubeTranscript(VIDEO, "en")).rejects.toThrow("YOUTUBE_UNAVAILABLE");
  });

  it("recusa legenda fora do domínio e do caminho esperados", async () => {
    edgeFetch(() => player("https://evil.example.com/api/timedtext"));
    await expect(readYoutubeTranscript(VIDEO, "en")).rejects.toThrow("YOUTUBE_UNAVAILABLE");
  });

  it("nenhum arquivo do app usa redirect: error em fetch (quebra no runtime de borda)", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const code = readFileSync(path, "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");
          if (/redirect:\s*["']error["']/.test(code)) offenders.push(path);
        }
      }
    };
    walk("src/lib");
    walk("src/routes/api");
    expect(offenders).toEqual([]);
  }, 30_000);
});
