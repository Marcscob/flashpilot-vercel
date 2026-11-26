import { describe, expect, test } from "bun:test";
import {
  landingTestsExhausted,
  readLandingVisitorIdentity,
  recordLandingVisitorTest,
} from "../src/lib/landing-visitor-identity";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe("landing visitor identity", () => {
  const day1 = new Date("2026-11-09T10:00:00Z");
  const day2 = new Date("2026-11-10T10:00:00Z");

  test("is empty until a test is registered", () => {
    expect(readLandingVisitorIdentity(memoryStorage(), day1)).toBeNull();
  });

  test("counts tests for the same email and blocks the fourth", () => {
    const storage = memoryStorage();
    for (let i = 0; i < 3; i++) recordLandingVisitorTest("Ana", "Ana@Example.com", storage, day1);
    const identity = readLandingVisitorIdentity(storage, day1);
    expect(identity).toMatchObject({ name: "Ana", email: "ana@example.com", tests: 3 });
    expect(landingTestsExhausted(identity)).toBe(true);
  });

  test("restarts the count on a new UTC day but keeps the identity", () => {
    const storage = memoryStorage();
    recordLandingVisitorTest("Ana", "ana@example.com", storage, day1);
    const next = readLandingVisitorIdentity(storage, day2);
    expect(next).toMatchObject({ name: "Ana", tests: 0 });
    expect(landingTestsExhausted(next)).toBe(false);
  });

  test("a different email starts its own count", () => {
    const storage = memoryStorage();
    recordLandingVisitorTest("Ana", "ana@example.com", storage, day1);
    expect(recordLandingVisitorTest("Bia", "bia@example.com", storage, day1)?.tests).toBe(1);
  });

  test("owner test email is never exhausted", () => {
    const storage = memoryStorage();
    for (let i = 0; i < 5; i++) recordLandingVisitorTest("Owner", "marcscob@hotmail.com", storage, day1);
    expect(landingTestsExhausted(readLandingVisitorIdentity(storage, day1))).toBe(false);
  });
});
