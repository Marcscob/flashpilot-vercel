import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("narração de microvídeos", () => {
  test("não depende da cota de voz avulsa, que o plano de teste não inclui", () => {
    const source = read("../src/lib/card-video-audio.functions.ts");
    expect(source).not.toContain("tts_standalone");
    expect(source).toContain("runWithAiGenerationLease");
  });
});

describe("materiais da landing entregues uma única vez", () => {
  const server = read("../src/lib/landing-handoff.server.ts");

  test("material já presente no app encerra o handoff sem recriar nem avisar", () => {
    expect(server).toContain("landingMaterialsAlreadyPresent");
    expect(server).toContain(".update({ materials_done_at: handoff.materials_done_at })");
  });

  test("a tentativa é contada antes de gerar e o resultado só grava a conclusão", () => {
    expect(server).toContain('phase === "start"');
    expect(read("../src/components/LandingHandoffConsumer.tsx")).toContain('phase: "start"');
  });
});
