import { describe, expect, test } from "bun:test";
import { landingMaterialsAttemptDone, shouldOpenReview } from "../src/lib/landing-handoff-rules";

const base = { savedCards: 0, recentlySaved: false, alreadyOpened: false, pathname: "/home" };

describe("landing material completion", () => {
  test("one failed attachment keeps a partially successful delivery retryable", () => {
    expect(landingMaterialsAttemptDone(1)).toBe(false);
  });

  test("all three failed attachments keep delivery retryable", () => {
    expect(landingMaterialsAttemptDone(3)).toBe(false);
  });

  test("only a delivery without failures is complete", () => {
    expect(landingMaterialsAttemptDone(0)).toBe(true);
  });
});

describe("shouldOpenReview", () => {
  test("opens review right after cards are saved", () => {
    expect(shouldOpenReview({ ...base, savedCards: 5, recentlySaved: true })).toBe(true);
  });

  test("recovers when an earlier call saved cards but the browser never navigated", () => {
    expect(shouldOpenReview({ ...base, recentlySaved: true })).toBe(true);
  });

  test("does not hijack later visits once review was opened", () => {
    expect(shouldOpenReview({ ...base, recentlySaved: true, alreadyOpened: true })).toBe(false);
  });

  test("does nothing without a landing handoff", () => {
    expect(shouldOpenReview(base)).toBe(false);
  });

  test("does not navigate when already on review", () => {
    expect(shouldOpenReview({ ...base, savedCards: 3, pathname: "/review" })).toBe(false);
  });
});
