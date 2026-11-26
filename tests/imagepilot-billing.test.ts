import { describe, expect, test } from "bun:test";
import { imagePilotCardLimit } from "../src/lib/imagepilot-rules";
import { LANDING_LIMITS } from "../src/lib/landing-rules";
import { getErrorMessage } from "../src/lib/error-message";
import { friendlyAiError } from "../src/lib/ai-error-toast";

describe("ImagePilot billing limits", () => {
  test("landing requests ten rather than thirty output units", () => {
    expect(imagePilotCardLimit.parse(LANDING_LIMITS.cards)).toBe(10);
  });
  test("existing callers retain their thirty-unit maximum", () => {
    expect(imagePilotCardLimit.parse(undefined)).toBe(30);
    expect(imagePilotCardLimit.safeParse(31).success).toBe(false);
    expect(imagePilotCardLimit.safeParse(0).success).toBe(false);
  });
  test("plain database errors preserve reservation failure details", () => {
    expect(getErrorMessage({ message: "Requested flashcard count exceeds the document job reservation", code: "22023" })).toBe("Requested flashcard count exceeds the document job reservation");
  });
  test("an unverified reservation does not direct a funded user to buy coins", () => {
    expect(friendlyAiError(new Error("Unable to reserve FlashCoins for flashcards.")).store).toBe(false);
  });
  test("real insufficient balance offers the store", () => {
    expect(friendlyAiError(new Error("FlashCoin balance is insufficient for saved flashcards")).store).toBe(true);
  });
});