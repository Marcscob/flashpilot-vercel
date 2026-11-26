import type { TvScene } from "./card-video";

/** One stable narration identity regardless of the scene where playback resumes. */
export function videoNarration(scenes: TvScene[]): string {
  return scenes.map((scene) => scene.speech).join(" ");
}

export function audioTimeForVideoPosition(
  position: number,
  videoDuration: number,
  audioDuration: number,
): number | null {
  if (
    !Number.isFinite(position) ||
    !Number.isFinite(videoDuration) ||
    !Number.isFinite(audioDuration) ||
    videoDuration <= 0 ||
    audioDuration <= 0
  ) {
    return null;
  }

  const progress = Math.min(1, Math.max(0, position / videoDuration));
  return progress * audioDuration;
}

export function videoPositionForAudioTime(
  audioTime: number,
  audioDuration: number,
  videoDuration: number,
): number | null {
  if (
    !Number.isFinite(audioTime) ||
    !Number.isFinite(audioDuration) ||
    !Number.isFinite(videoDuration) ||
    audioDuration <= 0 ||
    videoDuration <= 0
  ) {
    return null;
  }

  const progress = Math.min(1, Math.max(0, audioTime / audioDuration));
  return progress * videoDuration;
}

export function canReuseVideoAudio(
  path: string | null,
  voice: string | null,
  currentVoice: string,
): boolean {
  return Boolean(path && voice === currentVoice);
}
