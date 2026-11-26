import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  audioTimeForVideoPosition,
  canReuseVideoAudio,
  videoNarration,
  videoPositionForAudioTime,
} from "../src/lib/card-video-audio";

const PLAYER_SOURCE = readFileSync(
  new URL("../src/components/FlashPilotTv.tsx", import.meta.url),
  "utf8",
);

describe("persistent video narration", () => {
  it("retains one complete bilingual narration for every replay", () => {
    expect(
      videoNarration([
        { emoji: "", kicker: "", title: "", bullets: [], speech: "Predicado." },
        { emoji: "", kicker: "", title: "", bullets: [], speech: "Use the blank." },
      ]),
    ).toBe("Predicado. Use the blank.");
  });
  it("reuses stored audio only with the current voice rules", () => {
    expect(canReuseVideoAudio("videos/audio.wav", "Kore-v3", "Kore-v3")).toBe(true);
    expect(canReuseVideoAudio("videos/audio.wav", "old", "Kore-v3")).toBe(false);
    expect(canReuseVideoAudio(null, "Kore-v3", "Kore-v3")).toBe(false);
  });

  it("maps timeline seeking to the matching audio position and clamps its bounds", () => {
    expect(audioTimeForVideoPosition(8, 32, 120)).toBe(30);
    expect(audioTimeForVideoPosition(-5, 32, 120)).toBe(0);
    expect(audioTimeForVideoPosition(40, 32, 120)).toBe(120);
    expect(audioTimeForVideoPosition(8, 0, 120)).toBeNull();
  });

  it("maps audio playback time back to the video timeline", () => {
    expect(videoPositionForAudioTime(30, 120, 32)).toBe(8);
    expect(videoPositionForAudioTime(120, 120, 32)).toBe(32);
    expect(videoPositionForAudioTime(30, 0, 32)).toBeNull();
  });

  it("exposes separate accessible volume and video-position sliders", () => {
    expect(PLAYER_SOURCE.match(/type="range"/g)).toHaveLength(2);
    expect(PLAYER_SOURCE).toContain(
      "onChange={(event) => changeVolume(Number(event.currentTarget.value))}",
    );
    expect(PLAYER_SOURCE).toContain(
      "onChange={(event) => seekTo(Number(event.currentTarget.value))}",
    );
    expect(PLAYER_SOURCE).toContain('aria-label={T("Posição do vídeo")}');
  });
});
