import { XMLParser } from "fast-xml-parser";
import { canonicalYoutubeUrl, youtubeVideoId } from "./youtube-url";

type Track = { baseUrl: string; languageCode: string; kind?: string };
type Player = {
  playabilityStatus?: { status?: string };
  videoDetails?: {
    title?: string;
    isPrivate?: boolean;
    isLiveContent?: boolean;
    lengthSeconds?: string;
  };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Track[] } };
};

export type YoutubeTranscript = {
  url: string;
  title: string;
  text: string;
  language: string;
  source: "captions" | "video";
};

/** Legendas do YouTube; sem elas, o Gemini lê o vídeo pelo link (só conteúdo de estudo). */
export async function readYoutubeTranscript(
  value: string,
  lang: string,
): Promise<YoutubeTranscript> {
  const result = await readCaptionsOrFallback(value, lang);
  return result;
}

async function readCaptionsOrFallback(value: string, lang: string): Promise<YoutubeTranscript> {
  try {
    return await readYoutubeCaptions(value, lang);
  } catch (error) {
    if (!(error instanceof YoutubeNoCaptions)) throw error;
    const { transcribeYoutubeWithGemini } = await import("./youtube-video-fallback.server");
    const text = await transcribeYoutubeWithGemini(value, error.durationSeconds);
    if (text.length > 150_000) throw new Error("YOUTUBE_TOO_LONG");
    return { url: error.url, title: error.title, text, language: "", source: "video" };
  }
}

class YoutubeNoCaptions extends Error {
  constructor(
    readonly url: string,
    readonly title: string,
    readonly durationSeconds: number | null,
  ) {
    super("YOUTUBE_NO_CAPTIONS");
  }
}

async function readYoutubeCaptions(value: string, lang: string): Promise<YoutubeTranscript> {
  const id = youtubeVideoId(value);
  const url = canonicalYoutubeUrl(value);
  if (!id || !url) throw new Error("YOUTUBE_INVALID_URL");
  const signal = AbortSignal.timeout(25_000);
  const version = "20.10.38";
  const response = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `com.google.android.youtube/${version} (Linux; U; Android 11) gzip`,
      "X-Youtube-Client-Name": "3",
      "X-Youtube-Client-Version": version,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: version,
          androidSdkVersion: 30,
          hl: "en",
          gl: "US",
        },
      },
      videoId: id,
    }),
  });
  if (!response.ok) throw new Error("YOUTUBE_UNAVAILABLE");
  const player = (await response.json()) as Player;
  if (
    player.playabilityStatus?.status !== "OK" ||
    player.videoDetails?.isPrivate ||
    player.videoDetails?.isLiveContent
  ) {
    throw new Error("YOUTUBE_UNAVAILABLE");
  }
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const base = lang.split("-")[0];
  const ranked = [...tracks].sort((a, b) => {
    const score = (t: Track) =>
      (t.languageCode === lang ? 4 : t.languageCode.split("-")[0] === base ? 2 : 0) +
      (t.kind !== "asr" ? 1 : 0);
    return score(b) - score(a);
  });
  const track = ranked[0];
  const duration = Number(player.videoDetails?.lengthSeconds);
  const noCaptions = () =>
    new YoutubeNoCaptions(
      url,
      player.videoDetails?.title ?? "YouTube",
      Number.isFinite(duration) && duration > 0 ? duration : null,
    );
  if (!track) throw noCaptions();
  const captionsUrl = new URL(track.baseUrl);
  if (
    captionsUrl.protocol !== "https:" ||
    !["www.youtube.com", "youtube.com"].includes(captionsUrl.hostname) ||
    captionsUrl.pathname !== "/api/timedtext"
  ) {
    throw new Error("YOUTUBE_UNAVAILABLE");
  }
  // O runtime de borda não aceita redirect: "error"; "manual" devolve o redirecionamento sem segui-lo.
  const captions = await fetch(captionsUrl, { signal, redirect: "manual" });
  if (captions.status >= 300 && captions.status < 400) throw new Error("YOUTUBE_UNAVAILABLE");
  if (!captions.ok) throw new Error("YOUTUBE_UNAVAILABLE");
  const raw = await captions.text();
  if (!raw.trim()) throw noCaptions();
  if (raw.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(raw))
    throw new Error("YOUTUBE_TOO_LONG");
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    processEntities: true,
  });
  const parsed = parser.parse(raw);
  const paragraphs = parsed?.timedtext?.body?.p ?? parsed?.transcript?.text ?? [];
  const list = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
  const textOf = (node: unknown): string => {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(textOf).join(" ");
    if (node && typeof node === "object")
      return Object.entries(node)
        .filter(([key]) => !key.startsWith("@_"))
        .map(([, child]) => textOf(child))
        .join(" ");
    return "";
  };
  const text = list.map(textOf).join("\n").trim();
  if (!text) throw noCaptions();
  if (text.length > 150_000) throw new Error("YOUTUBE_TOO_LONG");
  return {
    url,
    title: player.videoDetails?.title ?? "YouTube",
    text,
    language: track.languageCode,
    source: "captions",
  };
}
