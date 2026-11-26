import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  GameAuditSchema,
  GameCurationReviewSchema,
  candidateTaxonomy,
  canIncorporateGame,
} from "../src/lib/game-curation";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const pair = (n: number) => ({ left: `Conceito ${n}`, right: `Explicação ${n}` });
const review = (patch: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  version: 1,
  decision: "approve",
  title: "Present Perfect",
  subject: "Inglês",
  chapter: "Tempos verbais",
  topic: "Present Perfect",
  language: "pt",
  rounds: [{ pairs: [pair(1), pair(2), pair(3)] }],
  reviewNotes: "Conferido",
  rightsNotes: "Autoria própria do aluno",
  rightsConfirmed: true,
  ...patch,
});

describe("curadoria de FlashMatch", () => {
  it("só aprova com direitos comerciais confirmados", () => {
    expect(GameCurationReviewSchema.safeParse(review()).success).toBe(true);
    expect(GameCurationReviewSchema.safeParse(review({ rightsConfirmed: false })).success).toBe(
      false,
    );
    expect(
      GameCurationReviewSchema.safeParse(review({ rightsConfirmed: false, decision: "save" }))
        .success,
    ).toBe(true);
  });

  it("exige parecer, origem e rodadas de 3 a 5 pares", () => {
    expect(GameCurationReviewSchema.safeParse(review({ reviewNotes: "  " })).success).toBe(false);
    expect(GameCurationReviewSchema.safeParse(review({ rightsNotes: "" })).success).toBe(false);
    expect(GameCurationReviewSchema.safeParse(review({ rounds: [] })).success).toBe(false);
    expect(
      GameCurationReviewSchema.safeParse(review({ rounds: [{ pairs: [pair(1), pair(2)] }] }))
        .success,
    ).toBe(false);
  });

  it("só incorpora candidato pendente, elegível e com direitos confirmados", () => {
    expect(canIncorporateGame("pending", true, true)).toBe(true);
    expect(canIncorporateGame("pending", false, true)).toBe(false);
    expect(canIncorporateGame("pending", true, false)).toBe(false);
    expect(canIncorporateGame("approved", true, true)).toBe(false);
    expect(canIncorporateGame("rejected", true, true)).toBe(false);
  });

  it("sugere matéria > capítulo > assunto a partir do assunto do aluno", () => {
    expect(
      candidateTaxonomy({
        subject: " Inglês ",
        topic: "Present Perfect",
        parent: "Tempos verbais",
      }),
    ).toEqual({
      subject: "Inglês",
      chapter: "Tempos verbais",
      topic: "Present Perfect",
    });
    expect(candidateTaxonomy({ subject: "Biologia", topic: "Mitocôndria" })).toEqual({
      subject: "Biologia",
      chapter: "Mitocôndria",
      topic: "Mitocôndria",
    });
  });

  it("valida a resposta da auditoria e aceita taxonomia ausente", () => {
    expect(
      GameAuditSchema.safeParse({ eligible: true, risk: "public_fact", reason: "Fatos públicos." })
        .success,
    ).toBe(true);
    expect(
      GameAuditSchema.safeParse({ eligible: true, risk: "inventado", reason: "x" }).success,
    ).toBe(false);
  });
});

describe("FlashMatch: ligações com curadoria e entrega", () => {
  it("todo game criado é enviado para a curadoria", () => {
    const fn = read("src/lib/match-game.functions.ts");
    expect(fn).toContain("submitGameForCuration");
    expect(read("src/lib/game-curation.server.ts")).toContain('onConflict: "source_deck_id"');
  });

  it("auditoria: só o risco public_fact pode ser elegível", () => {
    expect(read("src/lib/game-curation.server.ts")).toContain(
      'verdict.eligible && verdict.risk === "public_fact"',
    );
  });

  it("a revisão passa pela função atômica do banco e só pelo AppManager", () => {
    const fns = read("src/lib/game-curation.functions.ts");
    expect(fns.match(/assertManager\(context\.claims\)/g)?.length).toBe(3);
    expect(fns).toContain('rpc("review_game_curation"');
  });

  it("a entrega de matérias copia os games oficiais de forma idempotente", () => {
    const sync = read("src/lib/official-content.functions.ts");
    expect(sync).toContain("syncOfficialGames(admin, userId, src.games, topicIdMap, copyTopicIds)");
    expect(sync).toContain('onConflict: "user_id,source_id", ignoreDuplicates: true');
    expect(sync).toContain('onConflict: "deck_id,position", ignoreDuplicates: true');
    expect(sync).toContain('.eq("is_official", true)');
  });

  it("migrações do banco são idênticas nas duas pastas e protegem a curadoria", () => {
    const supabase = read("supabase/migrations/20261108120000_flashmatch_curation.sql");
    expect(read("drizzle/migrations/0024_flashmatch_curation.sql")).toBe(supabase);
    expect(supabase).toContain("is_app_manager_user(p_reviewer)");
    expect(supabase).toContain("REVOKE ALL ON FUNCTION public.review_game_curation");
    expect(supabase).toContain(
      "GRANT EXECUTE ON FUNCTION public.review_game_curation(uuid, integer, uuid, text, jsonb, text, text, boolean) TO service_role",
    );
    expect(supabase).toContain("game_decks_user_source_uidx");
    expect(read("drizzle/migrations/0023_flashmatch_games.sql")).toBe(
      read("supabase/migrations/20261108100000_flashmatch_games.sql"),
    );
  });
});
