import { expect, test } from "bun:test";
import { googleSpeechPlan, escapeSsml } from "../src/lib/google-tts-plan";

const voices = ["pt-BR-Standard-A", "pt-BR-Neural2-B", "en-US-Standard-A", "en-US-Neural2-A", "pt-PT-Standard-E", "en-US-Polyglot-1"].map(name => ({ name, languageCodes: [name.slice(0, 5)] }));
test("monolingual Brazilian cards use economical Standard voices", () => {
  const plan = googleSpeechPlan("A Constituição protege os direitos fundamentais de todos os cidadãos.", "pt-BR", voices);
  expect(plan.bilingual).toBe(false);
  expect(plan.voice).toBe("pt-BR-Standard-A");
});
test("English monolingual cards use English Standard", () => {
  expect(googleSpeechPlan("The constitution protects the fundamental rights of all citizens.", "en", voices).voice).toBe("en-US-Standard-A");
});
test("bilingual cards split into native voices, Polyglot where available", () => {
  const plan = googleSpeechPlan('Em inglês, "good morning" significa bom dia.', "pt-BR", voices);
  expect(plan.bilingual).toBe(true);
  expect(plan.segments.map(s => s.voice)).toEqual(["pt-BR-Standard-A", "en-US-Polyglot-1", "pt-BR-Standard-A"]);
  expect(plan.segments[1].input).toEqual({ text: "good morning" });
});
test("explicit language tags cover short technical foreign terms", () => {
  const plan = googleSpeechPlan('O termo <span lang="en-US">estoppel</span> corresponde a uma regra jurídica.', "pt-BR", voices);
  expect(plan.segments.some(s => s.voice === "en-US-Polyglot-1" && "text" in s.input && s.input.text === "estoppel")).toBe(true);
});
test("base language with Polyglot uses one SSML request", () => {
  const plan = googleSpeechPlan('In Portuguese, "bom dia" means good morning.', "en-US", [...voices, { name: "x", languageCodes: [] }]);
  if (plan.bilingual) { expect(plan.segments.length).toBe(1); expect(plan.voice).toBe("en-US-Polyglot-1"); }
});
test("bilingual cards never use Neural2", () => {
  const plan = googleSpeechPlan("Em inglês good morning significa bom dia.", "pt-BR", voices);
  expect(plan.segments.every(s => !s.voice.includes("Neural2"))).toBe(true);
});
test("only female voices are chosen", () => {
  const vs = [{ name: "pt-BR-Standard-B", languageCodes: ["pt-BR"], ssmlGender: "MALE" }, { name: "pt-BR-Standard-C", languageCodes: ["pt-BR"], ssmlGender: "FEMALE" }, { name: "en-US-Polyglot-1", languageCodes: ["en-US"], ssmlGender: "MALE" }, { name: "en-US-Standard-C", languageCodes: ["en-US"], ssmlGender: "FEMALE" }];
  expect(googleSpeechPlan("A Constituição protege os direitos fundamentais de todos os cidadãos.", "pt-BR", vs).voice).toBe("pt-BR-Standard-C");
  expect(googleSpeechPlan('Em inglês, "good morning" significa bom dia.', "pt-BR", vs).segments.map(s => s.voice)).toEqual(["pt-BR-Standard-C", "en-US-Standard-C", "pt-BR-Standard-C"]);
});
test("SSML injection is escaped", () => {
  expect(escapeSsml('<break/> & "x"')).toBe("&lt;break/&gt; &amp; &quot;x&quot;");
});
test("Portuguese regional voice remains Portuguese Portugal", () => {
  expect(googleSpeechPlan("O aluno estuda a matéria.", "pt-PT", voices).voice).toBe("pt-PT-Standard-E");
});
test("missing economical voice fails rather than substituting an expensive one", () => {
  expect(() => googleSpeechPlan("Hello", "en-US", voices.filter(v => !v.name.includes("Standard")))).toThrow("Standard");
});