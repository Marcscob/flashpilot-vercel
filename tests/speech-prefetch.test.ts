import { expect, test } from "bun:test";
import { createSpeechDispatch } from "../src/lib/speech-dispatch";
import { speechPrefetchWindow } from "../src/lib/speech-prefetch-window";
import { localSpeechKey } from "../src/lib/speech-local-cache";

test("prefetch includes current card and exactly two ahead, never the entire deck", () => {
  expect(speechPrefetchWindow([0, 1, 2, 3, 4, 5], 2)).toEqual([2, 3, 4]);
  expect(speechPrefetchWindow([0, 1, 2], 2)).toEqual([2]);
});

test("manual audio overtakes pending background work without overlapping active synthesis", async () => {
  const dispatch = createSpeechDispatch<number>();
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const order: string[] = [];
  let running = 0;
  let maximum = 0;
  const work = (name: string, wait = false) => async () => {
    running++; maximum = Math.max(maximum, running); order.push(name);
    if (wait) await gate;
    running--; return 1;
  };
  const first = dispatch("active", () => true, work("active", true), 0);
  const background = dispatch("background", () => true, work("background"), 0);
  const manual = dispatch("manual", () => true, work("manual"), 1);
  release?.();
  await Promise.all([first, background, manual]);
  expect(order).toEqual(["active", "manual", "background"]);
  expect(maximum).toBe(1);
});

test("clicking a prefetched pending card promotes and shares the request", async () => {
  const dispatch = createSpeechDispatch<number>();
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = dispatch("active", () => true, async () => { await gate; return 0; }, 0);
  const order: string[] = [];
  const other = dispatch("other", () => true, async () => { order.push("other"); return 1; }, 0);
  const background = dispatch("target", () => true, async () => { order.push("target"); return 2; }, 0);
  const manual = dispatch("target", () => true, async () => { throw new Error("Must share"); }, 1);
  release?.();
  expect(await Promise.all([first, other, background, manual])).toEqual([0, 1, 2, 2]);
  expect(order).toEqual(["target", "other"]);
});

test("discarded prefetch window starts no synthesis", async () => {
  const dispatch = createSpeechDispatch<number>();
  let calls = 0;
  expect(await dispatch("old", () => false, async () => ++calls, 0)).toBeUndefined();
  expect(calls).toBe(0);
});

test("persistent identity isolates account, text, language and narration voice version", async () => {
  const base = await localSpeechKey("user-a", "Predicado", "pt-BR", "student", "Kore-v3");
  expect(await localSpeechKey("user-a", "Predicado", "pt-BR", "student", "Kore-v3")).toBe(base);
  for (const args of [
    ["user-b", "Predicado", "pt-BR", "student", "Kore-v3"],
    ["user-a", "Sujeito", "pt-BR", "student", "Kore-v3"],
    ["user-a", "Predicado", "en-US", "student", "Kore-v3"],
    ["user-a", "Predicado", "pt-BR", "student", "Kore-v4"],
  ]) {
    expect(await localSpeechKey(args[0] ?? "", args[1] ?? "", args[2] ?? "", args[3] ?? "", args[4])).not.toBe(base);
  }
});