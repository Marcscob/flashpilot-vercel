import { expect, test } from "bun:test";
import { repeatAudioCandidates, REPEAT_AUDIO_AHEAD } from "../src/lib/repeat-audio-window";
import { localSpeechKey } from "../src/lib/speech-local-cache";

const phrases = Array.from({ length: 6 }, (_, i) => ({ id: String(i), lang: "en", level: "beginner", topic: "travel", times_practiced: 0, created_at: String(i) }));
test("repeat practice keeps exactly three upcoming phrases, excluding the current one", () => {
  expect(REPEAT_AUDIO_AHEAD).toBe(3);
  expect(repeatAudioCandidates(phrases, "en", "beginner", "travel", new Set(["0"])).map(p => p.id)).toEqual(["1", "2", "3"]);
});
test("sliding window replenishes the next three without returning visited phrases", () => {
  expect(repeatAudioCandidates(phrases, "en", "beginner", "travel", new Set(["0", "1", "2"])).map(p => p.id)).toEqual(["3", "4", "5"]);
});
test("prefetch respects language, level, topic and practice status", () => {
  expect(repeatAudioCandidates([{ ...phrases[0], id: "p", lang: "fr", level: "beginner", topic: "travel", times_practiced: 0, created_at: "0" }], "en", "beginner", "travel", new Set())).toEqual([]);
  expect(repeatAudioCandidates(phrases, "en", "advanced", "travel", new Set())).toEqual([]);
  expect(repeatAudioCandidates(phrases, "en", "beginner", "work", new Set())).toEqual([]);
  expect(repeatAudioCandidates(phrases.map(p => ({ ...p, times_practiced: 1 })), "en", "beginner", "travel", new Set())).toEqual([]);
});
test("repeat audio persists under the same private identity for every playback, never another account", async () => {
  const key = await localSpeechKey("a", "Good morning", "en", "repeat-private");
  expect(await localSpeechKey("a", "Good morning", "en", "repeat-private")).toBe(key);
  expect(await localSpeechKey("b", "Good morning", "en", "repeat-private")).not.toBe(key);
  expect(await localSpeechKey("a", "Good morning", "en", "chat")).not.toBe(key);
});