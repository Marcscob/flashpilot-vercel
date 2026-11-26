import { describe, expect, it } from "vitest";
import { acquireLeaseWithWait, isLeaseBusyError } from "../src/lib/ai-lease-wait";

function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
}

describe("acquireLeaseWithWait", () => {
  it("waits for the previous operation instead of failing immediately", async () => {
    const clock = fakeClock();
    let calls = 0;
    const ok = await acquireLeaseWithWait(async () => (++calls < 4 ? "busy" : "acquired"), clock);
    expect(ok).toBe(true);
    expect(calls).toBe(4);
  });

  it("gives up only after the 75 second wait budget", async () => {
    const clock = fakeClock();
    const ok = await acquireLeaseWithWait(async () => "busy", clock);
    expect(ok).toBe(false);
    expect(clock.now()).toBe(75_000);
  });
});

describe("isLeaseBusyError", () => {
  it("treats only the 'another operation active' conflict as waitable", () => {
    expect(isLeaseBusyError({ code: "55P03", message: "Another AI operation is already active for this account" })).toBe(true);
    expect(isLeaseBusyError({ code: "55P03", message: "Document job generation reservation is no longer active" })).toBe(false);
  });
});
