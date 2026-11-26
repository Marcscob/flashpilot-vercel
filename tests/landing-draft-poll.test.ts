import { expect, test } from "bun:test";
import { landingDraftPollOutcome } from "../src/lib/landing-draft-poll";

test("retry and reload keep polling the previous failure while generation starts", () => {
  expect(landingDraftPollOutcome("failed", true, false)).toBe("wait");
  expect(landingDraftPollOutcome("processing", true, false)).toBe("wait");
  expect(landingDraftPollOutcome("done", true, true)).toBe("done");
});

test("a new generation failure stops polling even before the request returns", () => {
  expect(landingDraftPollOutcome("failed", true, true)).toBe("failed");
});

test("a rejected or completed request does not hide a persisted failure", () => {
  expect(landingDraftPollOutcome("failed", false, false)).toBe("failed");
});

test("a missing draft is terminal even while the request is pending", () => {
  expect(landingDraftPollOutcome("missing", true, false)).toBe("failed");
});

test("an already running generation is still polled after the request returns", () => {
  expect(landingDraftPollOutcome("processing", false, false)).toBe("wait");
});