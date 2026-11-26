import { describe, expect, it } from "bun:test";
import { FACEBOOK_PAGES } from "@/lib/blog-facebook";
import {
  INSTAGRAM_ACCOUNTS,
  buildInstagramCaption,
} from "@/lib/blog-instagram";

describe("Distribuição nas Redes Sociais (Facebook e Instagram)", () => {
  it("deve conter exatamente as 8 páginas configuradas no Facebook", () => {
    expect(FACEBOOK_PAGES).toHaveLength(8);
    const keys = FACEBOOK_PAGES.map((p) => p.key);
    expect(keys).toEqual(["pt", "br", "en", "es", "latam", "fr", "de", "it"]);

    const itPage = FACEBOOK_PAGES.find((p) => p.key === "it");
    expect(itPage).toBeDefined();
    expect(itPage?.pageName).toBe("Flashpilot.it");
    expect(itPage?.langs).toEqual(["it"]);

    const enPage = FACEBOOK_PAGES.find((p) => p.key === "en");
    expect(enPage?.pageName).toBe("Flashpilot.en");
  });

  it("deve conter exatamente as 8 contas configuradas no Instagram", () => {
    expect(INSTAGRAM_ACCOUNTS).toHaveLength(8);
    const keys = INSTAGRAM_ACCOUNTS.map((a) => a.key);
    expect(keys).toEqual(["br", "pt", "en", "es", "latam", "fr", "de", "it"]);

    const accountNames = INSTAGRAM_ACCOUNTS.map((a) => a.accountName);
    expect(accountNames).toEqual([
      "flashpilot.br",
      "flashpilot.pt",
      "flashpilot.en",
      "flashpilot.es",
      "flashpilot.latam",
      "flashpilot.fr",
      "flashpilot.de",
      "flashpilot.it",
    ]);
  });

  it("cada conta do Instagram deve mapear para a página correta do Facebook e variáveis esperadas", () => {
    for (const acc of INSTAGRAM_ACCOUNTS) {
      expect(acc.facebookPageKey).toBe(acc.key);
      expect(acc.accountIdEnv).toBe(`IG_ACCOUNT_ID_${acc.key.toUpperCase()}`);
      expect(acc.tokenEnv).toBe(`FB_PAGE_TOKEN_${acc.key.toUpperCase()}`);
      expect(acc.langs.length).toBeGreaterThan(0);
    }
  });

  it("deve gerar a legenda do Instagram com título, resumo, chamada para o link e hashtags segmentadas", () => {
    const captionPtBr = buildInstagramCaption(
      "Dicas valiosas para memorizar fórmulas.",
      "Como memorizar rápido",
      "pt-BR",
      "como-memorizar-rapido",
    );
    expect(captionPtBr).toContain("Como memorizar rápido");
    expect(captionPtBr).toContain("Dicas valiosas para memorizar fórmulas.");
    expect(captionPtBr).toContain("https://flashpilot.net/pt-BR/blog/como-memorizar-rapido");
    expect(captionPtBr).toContain("#flashpilot");
    expect(captionPtBr).toContain("#concursos");
    expect(captionPtBr).toContain("#enem");

    const captionEn = buildInstagramCaption(
      "Master spaced repetition with FlashPilot.",
      "Spaced Repetition Guide",
      "en",
      "spaced-repetition-guide",
    );
    expect(captionEn).toContain("Spaced Repetition Guide");
    expect(captionEn).toContain("Master spaced repetition with FlashPilot.");
    expect(captionEn).toContain("https://flashpilot.net/en/blog/spaced-repetition-guide");
    expect(captionEn).toContain("#spacedrepetition");

    const captionIt = buildInstagramCaption(
      "Migliora il tuo studio universitario con le flashcard.",
      "Come studiare meglio",
      "it",
      "come-studiare-meglio",
    );
    expect(captionIt).toContain("Come studiare meglio");
    expect(captionIt).toContain("Migliora il tuo studio universitario con le flashcard.");
    expect(captionIt).toContain("https://flashpilot.net/it/blog/come-studiare-meglio");
    expect(captionIt).toContain("#memorizzazione");
  });

  it("deve usar o campo resumo como corpo principal do post do Facebook", () => {
    const { buildFacebookMessage } = require("@/lib/blog-facebook");
    const msg = buildFacebookMessage(
      "Termos-chave: repetição espaçada, curva de esquecimento, recuperação ativa.",
      "Título Qualquer",
    );
    expect(msg).toBe(
      "flashpilot.net — Termos-chave: repetição espaçada, curva de esquecimento, recuperação ativa.",
    );
  });
});
