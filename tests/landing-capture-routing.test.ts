import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { canUseInstantLandingTest } from "../src/lib/landing-capture-routing";

const captureSource = readFileSync(
  new URL("../src/components/LandingCapture.tsx", import.meta.url),
  "utf8",
);

describe("landing capture routing", () => {
  test("instant visitor tests accept typed and browser-extracted document text", () => {
    expect(canUseInstantLandingTest("text", [])).toBe(true);
    for (const name of ["notes.pdf", "notes.docx", "notes.txt"]) {
      expect(canUseInstantLandingTest("files", [{ name, extractedText: "source material" }])).toBe(
        true,
      );
    }
  });

  test("every capture source generates its carousel instantly", () => {
    expect(canUseInstantLandingTest("youtube", [])).toBe(true);
    for (const name of ["photo.png", "recording.webm", "deck.csv", "workbook.xlsx", "scanned.pdf"]) {
      expect(canUseInstantLandingTest("files", [{ name }])).toBe(true);
    }
    expect(canUseInstantLandingTest("files", [])).toBe(false);

    expect(captureSource).toContain("onStartInstantTest && canUseInstantLandingTest(mode, files)");
    expect(captureSource).toContain("extractSourceFn({");
    expect(captureSource).toContain("transcriptFn({ data: { url: draft.youtubeUrl");
    expect(captureSource).toContain("transcribeFn({");
    expect(captureSource).toContain("analyzeImagePilotFn({");
  });
});
