import { expect, test } from "bun:test";
import { createSpeechDispatch } from "../src/lib/speech-dispatch";
import { spokenTextLanguage } from "../src/lib/speech-language";

test("two simultaneous readers share one active synthesis", async () => {
  const dispatch = createSpeechDispatch<number>();
  let calls = 0;
  const work = async () => { calls++; return 1; };
  const results = await Promise.all([dispatch("card", () => true, work), dispatch("card", () => true, work)]);
  expect(results).toEqual([1, 1]);
  expect(calls).toBe(1);
});

test("new card waits for active synthesis and skips superseded queued cards", async () => {
  const dispatch = createSpeechDispatch<number>();
  let active = 0;
  let maximum = 0;
  let calls = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = dispatch("first", () => true, async () => { active++; maximum = Math.max(maximum, active); calls++; await gate; active--; return 1; });
  await Promise.resolve();
  const stale = dispatch("stale", () => false, async () => { calls++; return 2; });
  const latest = dispatch("latest", () => true, async () => { active++; maximum = Math.max(maximum, active); calls++; active--; return 3; });
  release?.();
  expect(await Promise.all([first, stale, latest])).toEqual([1, undefined, 3]);
  expect(maximum).toBe(1);
  expect(calls).toBe(2);
});

test("Portuguese grammar question in an English subject is read with Portuguese as base language", () => {
  const text = 'As Prepositions e seus objetos formam prepositional phrases. Como essas unidades funcionam? A) Como sujeitos ou verbos. B) Como adjetivos ou advérbios. C) Como conjunções ou artigos.';
  expect(spokenTextLanguage(text, "en-US")).toBe("pt-BR");
});