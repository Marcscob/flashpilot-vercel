import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PROGRAMMING_EXAMPLE_RULES, sharedCardGuidelines } from "../src/lib/card-guidelines";

describe("programming example regression", () => {
  test("the Python reference in the shared rule executes and prints 8", () => {
    const code = PROGRAMMING_EXAMPLE_RULES.split("Python 3 example:\n")[1]?.split("\nEnd Python 3 example.")[0];
    if (!code) throw new Error("Missing Python reference");
    const result = spawnSync("python3", ["-c", code], { encoding: "utf8" });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("8");
  });

  test("the reported hybrid example is rejected by Python", () => {
    const code = "x = 5 + 3; if (x > 0) { print(x); }";
    const result = spawnSync("python3", ["-c", code], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SyntaxError");
  });

  test("all generation paths consume the same syntax policy", () => {
    expect(sharedCardGuidelines({ requestedCards: 3, destination: true })).toContain(PROGRAMMING_EXAMPLE_RULES);
    for (const name of ["microcontexts.functions.ts", "study-note-generate.server.ts", "card-note.functions.ts", "card-video-generate.server.ts"]) {
      const source = readFileSync(new URL(`../src/lib/${name}`, import.meta.url), "utf8");
      expect(source).toContain('import { PROGRAMMING_EXAMPLE_RULES } from "./card-guidelines"');
      expect(source).toContain("${PROGRAMMING_EXAMPLE_RULES}");
    }
  });
});