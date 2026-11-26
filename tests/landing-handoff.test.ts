import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("landing visitor handoff", () => {
  test("claim stores subject, topic, source and checked attachments on the server", () => {
    const source = read("src/lib/landing-visitor.functions.ts");
    expect(source).toContain('from("landing_visitor_handoffs")');
    expect(source).toContain("want_note");
    expect(source).toContain("want_video");
    expect(read("src/components/LandingPage.tsx")).toContain("returning?.materials ?? visitorMaterials");
  });

  test("first login finalizes the account from the server, not from browser storage", () => {
    const consumer = read("src/components/LandingHandoffConsumer.tsx");
    expect(consumer).toContain("finalizeLandingHandoffFn");
    expect(consumer).not.toContain("readLandingVisitorHandoff");
    const server = read("src/lib/landing-handoff.server.ts");
    expect(server).toContain("ensureDestinationForUser");
    expect(server).toContain("save_flashcards_atomically");
  });

  test("landing prepares checked attachments for every card, starting from the visible one", () => {
    const results = read("src/components/LandingResultsSection.tsx");
    expect(results).not.toContain("cards.slice(0, 3)");
    expect(results).toContain("currentIndexRef.current");
    expect(results).toContain('"failed"');
  });

  test("a reminder email with a magic link is sent after two days", () => {
    const hook = read("src/routes/api/public/hooks/landing-reminder.ts");
    expect(hook).toContain("2 * 24 * 3600 * 1000");
    expect(hook).toContain('type: "magiclink"');
    expect(read("src/lib/email-templates/registry.ts")).toContain('"landing-reminder"');
  });
});
