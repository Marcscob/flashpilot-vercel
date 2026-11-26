export type LandingCaptureMode = "files" | "text" | "youtube" | "web";

export type LandingCaptureFileText = {
  name: string;
  extractedText?: string;
};

/** Instant test source: ready text, a lazy extractor (photo/audio/video), or cards built locally (spreadsheets). */
export type InstantTestInput =
  | string
  | (() => Promise<string>)
  | { cards: { question: string; answer: string }[]; source: string };

/** Every capture source shows its flashcards on the landing page before asking for an e-mail. */
export function canUseInstantLandingTest(
  mode: LandingCaptureMode,
  files: readonly LandingCaptureFileText[],
): boolean {
  if (mode === "text" || mode === "youtube" || mode === "web") return true;
  return files.length === 1;
}
