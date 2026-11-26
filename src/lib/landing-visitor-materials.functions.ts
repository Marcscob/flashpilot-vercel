import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateMindMapTree } from "./mindmap-generate.server";
import { generateStudyNoteDraft } from "./study-note-generate.server";
import { generateCardVideoScenes } from "./card-video-generate.server";
import { synthesizeAudioBytes, bytesToBase64 } from "./tts-cloud.server";

const Input = z.object({
  kind: z.enum(["note", "map", "video"]),
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(4000),
  sourceText: z.string().trim().min(5).max(15_000),
  lang: z.string().trim().min(2).max(40),
});

export type LandingVisitorMaterial =
  | { kind: "note"; title: string; text: string }
  | {
      kind: "map";
      tree: Awaited<ReturnType<typeof generateMindMapTree>>;
    }
  | {
      kind: "video";
      scenes: Awaited<ReturnType<typeof generateCardVideoScenes>>;
      lang: string;
      style: "both";
      audio: string;
      mime: string;
    };

export const generateLandingVisitorMaterialFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<LandingVisitorMaterial> => {
    // Public action: throttle per device and globally so anonymous callers cannot drain paid AI/TTS.
    const { reserveDevice } = await import("./landing-device.server");
    if (!(await reserveDevice("landing-material", 9, 900))) {
      throw new Error("Limite diário de materiais de teste atingido. Crie sua conta para continuar.");
    }
    return generateMaterial(data);
  });

const SaveInput = z.object({
  email: z.string().trim().email().max(254),
  testId: z.string().uuid(),
  ordinal: z.number().int().min(0).max(9),
  item: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("note"),
      title: z.string().max(300),
      text: z.string().max(30_000),
    }),
    z.object({ kind: z.literal("map"), tree: z.record(z.string(), z.unknown()) }),
    z.object({
      kind: z.literal("video"),
      scenes: z.array(z.record(z.string(), z.unknown())).min(1).max(40),
    }),
  ]),
});

/** Keeps what the visitor already saw (audio excluded) so the account can import it without AI. */
export const saveLandingGeneratedMaterialFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data }) => {
    const { kind, ...value } = data.item;
    if (JSON.stringify(value).length > 400_000) return { ok: false as const };
    const { saveLandingGeneratedMaterial } = await import("./landing-visitor.server");
    await saveLandingGeneratedMaterial({
      email: data.email,
      testId: data.testId,
      ordinal: data.ordinal,
      kind,
      value,
    });
    return { ok: true as const };
  });

async function generateMaterial(data: z.infer<typeof Input>): Promise<LandingVisitorMaterial> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Timeout")), 90_000);
  const source = `${data.sourceText}\n\nFlashcard:\n${data.question}\n${data.answer}`;
  const cache = await import("./ai-result-cache.server");
  try {
    if (data.kind === "note") {
      const key = await cache.aiCacheKey("landing-note", data.lang, source);
      const hit = await cache.readAiCache<{ title: string; text: string }>(key);
      if (hit) return { kind: "note", ...hit };
      const note = await generateStudyNoteDraft(source, data.lang, controller.signal);
      await cache.writeAiCache("landing-note", key, note);
      return { kind: "note", ...note };
    }

    if (data.kind === "map") {
      const key = await cache.aiCacheKey("landing-map", data.lang, data.question, source);
      const hit = await cache.readAiCache<Awaited<ReturnType<typeof generateMindMapTree>>>(key);
      if (hit) return { kind: "map", tree: hit };
      const tree = await generateMindMapTree(
        { source, title: data.question, lang: data.lang, detail: "deep" },
        controller.signal,
      );
      await cache.writeAiCache("landing-map", key, tree);
      return { kind: "map", tree };
    }

    const style = "both" as const;
    const scriptKey = await cache.aiCacheKey(
      "video-script",
      data.lang,
      style,
      data.question,
      data.answer,
    );
    const cachedScenes =
      await cache.readAiCache<Awaited<ReturnType<typeof generateCardVideoScenes>>>(scriptKey);
    const scenes =
      cachedScenes && cachedScenes.length
        ? cachedScenes
        : await generateCardVideoScenes(
            {
              question: data.question,
              answer: data.answer,
              lang: data.lang,
              style,
            },
            controller.signal,
          );
    if (!cachedScenes) await cache.writeAiCache("video-script", scriptKey, scenes);
    const narration = scenes.map((scene) => scene.speech).join(" ");
    let audio: { bytes: Uint8Array; mime: string } | null = null;
    for (let attempt = 0; attempt < 2 && !audio; attempt++) {
      try {
        audio = await synthesizeAudioBytes(narration, data.lang, "Kore", controller.signal);
      } catch (error) {
        console.error(`Landing video narration failed (attempt ${attempt + 1})`, error);
        if (controller.signal.aborted) break;
      }
    }
    return {
      kind: "video",
      scenes,
      lang: data.lang,
      style,
      audio: audio ? bytesToBase64(audio.bytes) : "",
      mime: audio?.mime ?? "",
    };
  } finally {
    clearTimeout(timeout);
  }
}
