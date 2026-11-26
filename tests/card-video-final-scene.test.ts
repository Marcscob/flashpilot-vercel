import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ensureFinalQuestionRecap, normalizeScenes } from "../src/lib/card-video";

const SOURCE = readFileSync(
  new URL("../src/lib/card-video-generate.server.ts", import.meta.url),
  "utf8",
);

describe("FlashPilot-TV wrap-up scene", () => {
  test("the prompt requires the final narration and on-screen recap before the answer", () => {
    expect(SOURCE).toContain("The LAST scene is the wrap-up");
    expect(SOURCE).toContain("narration MUST begin by restating the card's QUESTION");
    expect(SOURCE).toContain("Put the same recap in questionRecap");
    expect(SOURCE).toContain("Only after the question recap may you give the answer");
  });

  test("a missing question recap is added to the final scene's speech and display text", () => {
    const question = "What distinguishes a crime from a misdemeanor?";
    const scenes = normalizeScenes({
      scenes: [{ speech: "First scene." }, { speech: "The answer is a crime." }],
    });

    const result = ensureFinalQuestionRecap(scenes, question);
    const finalScene = result[result.length - 1]!;

    expect(finalScene.questionRecap).toBe(question);
    expect(finalScene.speech.startsWith(question)).toBe(true);
  });

  test("a model-provided recap is spoken first and not duplicated", () => {
    const recap = "Which category does this offense belong to?";
    const scenes = normalizeScenes({
      scenes: [
        {
          speech: `The answer is a crime. ${recap}`,
          questionRecap: recap,
        },
      ],
    });

    const result = ensureFinalQuestionRecap(scenes, "Quel type d'infraction est-ce ?");
    const finalScene = result[0]!;

    expect(finalScene.speech.startsWith(recap)).toBe(true);
    expect(finalScene.speech.split(recap)).toHaveLength(2);
  });

  test("the prompt still asks for the same JSON scene format", () => {
    expect(SOURCE).toContain('Return JSON only: {"scenes":[{"emoji":"one emoji"');
    expect(SOURCE).toContain('"questionRecap":"question recap on the last scene; empty otherwise"');
    expect(SOURCE).toContain("with 3 or 4 scenes.");
  });
});
