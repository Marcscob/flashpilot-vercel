import { describe, expect, it } from "vitest";
import { ttsStoragePath } from "../src/lib/tts-storage-path";

describe("TTS storage path", () => {
  it("stores audio by hash without any subject-language label", () => {
    const hash = "e3d94229ad2f6dc7bfb7b19c0ac21f7edd23402b19132f44c3fa0f2fe13d3636";
    expect(ttsStoragePath(hash)).toBe(`e3/${hash}.wav`);
  });
  it("rejects a malformed hash rather than uploading an invalid object key", () => {
    expect(() => ttsStoragePath("[object Object]")).toThrow("Invalid audio cache hash");
  });
});