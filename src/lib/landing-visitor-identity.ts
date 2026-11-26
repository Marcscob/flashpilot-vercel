import { LANDING_TEST_LIMITS, UNLIMITED_TEST_EMAILS } from "./landing-visitor-rules";

export const LANDING_VISITOR_IDENTITY_KEY = "flashpilot:landing-visitor-identity";

export type LandingVisitorIdentity = { name: string; email: string; day: string; tests: number };

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Matches the server window: limits reset on UTC days. */
export function landingUtcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Saved identity with today's test count; the count restarts on a new UTC day. */
export function readLandingVisitorIdentity(
  storage: StorageLike | null = browserStorage(),
  now = new Date(),
): LandingVisitorIdentity | null {
  if (!storage) return null;
  try {
    const raw = JSON.parse(storage.getItem(LANDING_VISITOR_IDENTITY_KEY) ?? "null") as Partial<LandingVisitorIdentity> | null;
    const name = typeof raw?.name === "string" ? raw.name.trim() : "";
    const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    const day = landingUtcDay(now);
    const tests = raw?.day === day && Number.isInteger(raw.tests) ? Math.max(0, raw.tests as number) : 0;
    return { name, email, day, tests };
  } catch {
    return null;
  }
}

/** Remembers the visitor after a registered test so the next ones skip the form. */
export function recordLandingVisitorTest(
  name: string,
  email: string,
  storage: StorageLike | null = browserStorage(),
  now = new Date(),
): LandingVisitorIdentity | null {
  if (!storage) return null;
  const previous = readLandingVisitorIdentity(storage, now);
  const normalized = email.trim().toLowerCase();
  const sameVisitor = previous?.email === normalized;
  const identity: LandingVisitorIdentity = {
    name: name.trim(),
    email: normalized,
    day: landingUtcDay(now),
    tests: (sameVisitor ? previous.tests : 0) + 1,
  };
  try {
    storage.setItem(LANDING_VISITOR_IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    return null;
  }
  return identity;
}

export function landingTestsExhausted(identity: LandingVisitorIdentity | null): boolean {
  if (!identity || UNLIMITED_TEST_EMAILS.has(identity.email)) return false;
  return identity.tests >= LANDING_TEST_LIMITS.perEmailPerDay;
}
