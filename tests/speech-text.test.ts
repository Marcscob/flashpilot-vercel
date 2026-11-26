import { expect, test } from "bun:test";
import { prepareForSpeech } from "../src/lib/speech-text";

test("cloze narration retains the opening command and says blank rather than completing the answer", () => {
  expect(prepareForSpeech("Complete a lacuna: Adjectives podem fazer parte do sujeito ou do _______."))
    .toBe("Complete a lacuna: Adjectives podem fazer parte do sujeito ou do blank.");
});

test("the answer Predicado is retained before the example with a line boundary", () => {
  expect(prepareForSpeech("<p><b>Predicado</b></p><p>The tall tree provides shade.</p>"))
    .toBe("Predicado\nThe tall tree provides shade.");
});