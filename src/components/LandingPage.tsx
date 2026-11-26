import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MoneyBackGuarantee, RefundLink } from "@/components/MoneyBackGuarantee";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Brain, MessageCircle, Network, ScanLine, Layers, Send } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { FlagIcon } from "./FlagIcon";
import { Button } from "./ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "./ui/accordion";
import { LandingCapture } from "./LandingCapture";
import { LandingResultsSection, type LandingResultsStatus } from "./LandingResultsSection";
import {
  generateLandingVisitorCardsFn,
  claimLandingVisitorCardsFn,
  type GeneratedVisitorCard,
} from "@/lib/landing-visitor.functions";
import {
  generateLandingVisitorMaterialFn,
  saveLandingGeneratedMaterialFn,
  type LandingVisitorMaterial,
} from "@/lib/landing-visitor-materials.functions";
import { useLang, useOverlayD } from "@/lib/i18n";
import { landingCopy } from "@/lib/landing-content";
import { landingLegacyCopy } from "@/lib/landing-copy";
import { LANDING_ECONOMY } from "@/lib/landing-rules";
import { landingLanguageTitle } from "@/lib/landing-language-title";
import {
  LANDING_COUNTRY_LANGS,
  landingCountryName,
  landingLanguageFlag,
} from "@/lib/landing-language-flags";
import { T } from "@/lib/i18n-ui";
import { supabase } from "@/integrations/supabase/client";
import { readLandingMaterialPreference } from "@/lib/landing-materials";
import {
  landingTestsExhausted,
  readLandingVisitorIdentity,
  recordLandingVisitorTest,
  type LandingVisitorIdentity,
} from "@/lib/landing-visitor-identity";
import { LANDING_TEST_LIMITS, UNLIMITED_TEST_EMAILS } from "@/lib/landing-visitor-rules";
import type { InstantTestInput } from "@/lib/landing-capture-routing";
import { LANDING_LIMIT_ERROR } from "@/lib/landing-rules";
import { authEmailRedirectUrl, welcomeLocale } from "@/lib/welcome-locale";

const icons = [Brain, MessageCircle, Network, ScanLine];

type GeneratedItem =
  | { kind: "note"; title: string; text: string }
  | { kind: "map"; tree: Record<string, unknown> }
  | { kind: "video"; scenes: Record<string, unknown>[] };

function blockCopy(e: SyntheticEvent) {
  if ((e.target as HTMLElement).closest('input,textarea,[contenteditable="true"]')) return;
  e.preventDefault();
}
export function LandingPage() {
  const { lang, extLang } = useLang();
  const emailLang = welcomeLocale(
    extLang ?? lang,
    typeof navigator === "undefined" ? [] : navigator.languages,
  );
  const overlay = useOverlayD();
  const copyLang = extLang ?? lang;
  const c = landingCopy(copyLang, overlay ?? undefined);
  const old = landingLegacyCopy(copyLang, overlay ?? undefined);

  const [resultsStatus, setResultsStatus] = useState<LandingResultsStatus>("idle");
  const [generatedCards, setGeneratedCards] = useState<GeneratedVisitorCard[]>([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [savedVisitorEmail, setSavedVisitorEmail] = useState<string | null>(null);
  const [visitorIdentity, setVisitorIdentity] = useState<LandingVisitorIdentity | null>(null);
  useEffect(() => {
    setVisitorIdentity(readLandingVisitorIdentity());
  }, []);
  const [visitorTestSource, setVisitorTestSource] = useState("");
  const [visitorNames, setVisitorNames] = useState({ subject: "", topic: "" });
  const [visitorMaterials, setVisitorMaterials] = useState({
    note: false,
    map: false,
    video: false,
  });

  const generateCardsFn = useServerFn(generateLandingVisitorCardsFn);
  const claimCardsFn = useServerFn(claimLandingVisitorCardsFn);
  const generateMaterialFn = useServerFn(generateLandingVisitorMaterialFn);
  const saveGeneratedMaterialFn = useServerFn(saveLandingGeneratedMaterialFn);
  const generatedCardsRef = useRef<GeneratedVisitorCard[]>([]);
  const claimedTestRef = useRef<{ email: string; testId: string } | null>(null);
  const pendingGeneratedRef = useRef<
    { ordinal: number; card: GeneratedVisitorCard; item: GeneratedItem }[]
  >([]);

  function sendGeneratedMaterial(
    email: string,
    testId: string,
    ordinal: number,
    item: GeneratedItem,
  ) {
    void saveGeneratedMaterialFn({ data: { email, testId, ordinal, item } }).catch((error) =>
      console.error("Landing material not kept for the account", error),
    );
  }

  async function handleGenerateMaterial(
    kind: LandingVisitorMaterial["kind"],
    card: GeneratedVisitorCard,
  ) {
    const material = await generateMaterialFn({
      data: {
        kind,
        question: card.question,
        answer: card.answer,
        sourceText: visitorTestSource,
        lang: copyLang,
      },
    });
    const ordinal = generatedCardsRef.current.indexOf(card);
    if (ordinal >= 0 && ordinal < 10) {
      const item: GeneratedItem =
        material.kind === "note"
          ? { kind: "note", title: material.title, text: material.text }
          : material.kind === "map"
            ? { kind: "map", tree: material.tree as unknown as Record<string, unknown> }
            : { kind: "video", scenes: material.scenes as unknown as Record<string, unknown>[] };
      const claimed = claimedTestRef.current;
      // Results ready before the test is registered are sent right after the registration.
      if (claimed) sendGeneratedMaterial(claimed.email, claimed.testId, ordinal, item);
      else pendingGeneratedRef.current.push({ ordinal, card, item });
    }
    return material;
  }

  async function handleStartInstantTest(input: InstantTestInput) {
    const known = readLandingVisitorIdentity();
    if (landingTestsExhausted(known)) {
      setVisitorIdentity(known);
      setResultsStatus("limit");
      setTimeout(() => {
        document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return;
    }
    setVisitorIdentity(known);
    setResultsStatus("generating");
    setGeneratedCards([]);
    generatedCardsRef.current = [];
    claimedTestRef.current = null;
    pendingGeneratedRef.current = [];
    setClaimError(null);
    setSavedVisitorEmail(null);
    setVisitorTestSource(typeof input === "string" ? input : "");
    const materials = readLandingMaterialPreference();
    setVisitorMaterials(materials);
    setTimeout(() => {
      document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    try {
      let res: { cards: GeneratedVisitorCard[]; subject?: string; topic?: string };
      let sourceText = typeof input === "string" ? input : "";
      if (typeof input === "object" && "cards" in input) {
        const source =
          input.source.trim().length >= 5
            ? input.source
            : input.cards.map((card) => `${card.question}\n${card.answer}`).join("\n\n");
        sourceText = source.slice(0, 15_000);
        setVisitorTestSource(sourceText);
        res = { cards: input.cards };
      } else {
        const content = typeof input === "string" ? input : await input();
        sourceText = content;
        setVisitorTestSource(content);
        res = await generateCardsFn({ data: { text: content, lang: copyLang } });
      }
      if (res.cards && res.cards.length > 0) {
        const names = { subject: res.subject ?? "", topic: res.topic ?? "" };
        setVisitorNames(names);
        generatedCardsRef.current = res.cards;
        setGeneratedCards(res.cards);
        if (known) {
          // Returning visitor: register the test with the saved identity, no form.
          await handleClaimCards(known.name, known.email, {
            sendLink: false,
            cards: res.cards,
            names,
            sourceText,
            materials,
          });
          return;
        }
        setResultsStatus("identifying");
        setTimeout(() => {
          document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      } else {
        setClaimError(T("Não foi possível gerar flashcards com o material fornecido."));
        setResultsStatus("error");
        setTimeout(() => {
          document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      }
    } catch (err) {
      console.error("Instant test generation failed", err);
      if (err instanceof Error && err.message === LANDING_LIMIT_ERROR) {
        setResultsStatus("limit");
        setTimeout(() => {
          document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
        }, 50);
        return;
      }
      setClaimError(
        err instanceof Error ? err.message : T("Falha ao gerar flashcards. Tente novamente."),
      );
      setResultsStatus("error");
      setTimeout(() => {
        document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }

  async function handleClaimCards(
    name: string,
    email: string,
    returning?: {
      sendLink: false;
      cards: GeneratedVisitorCard[];
      names: { subject: string; topic: string };
      sourceText: string;
      materials: { note: boolean; map: boolean; video: boolean };
    },
  ): Promise<boolean> {
    setIsClaiming(true);
    setClaimError(null);
    try {
      if (savedVisitorEmail !== email) {
        const res = await claimCardsFn({
          data: {
            name,
            email,
            lang: copyLang,
            cards: returning?.cards ?? generatedCards,
            subject: (returning?.names ?? visitorNames).subject || undefined,
            topic: (returning?.names ?? visitorNames).topic || undefined,
            sourceText: (returning?.sourceText ?? visitorTestSource).slice(0, 15_000),
            ...(returning?.materials ?? visitorMaterials),
          },
        });

        if (!res.ok) {
          if (res.reason === "device_limit") {
            setResultsStatus("limit");
          } else if (res.reason === "email_limit" || res.reason === "global_limit") {
            setResultsStatus("limit");
          } else {
            setClaimError(T("Não foi possível registrar seu teste gratuito."));
            if (returning) setResultsStatus("error");
          }
          return false;
        }
        setSavedVisitorEmail(email);
        claimedTestRef.current = { email, testId: res.testId };
        for (const pending of pendingGeneratedRef.current.splice(0)) {
          if (generatedCardsRef.current[pending.ordinal] === pending.card) {
            sendGeneratedMaterial(email, res.testId, pending.ordinal, pending.item);
          }
        }
      }

      if (!returning) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: authEmailRedirectUrl(window.location.origin, emailLang, true),
            data: { full_name: name, ui_lang: emailLang },
          },
        });
        if (error) {
          // O teste já foi registrado: o visitante vê os cards mesmo sem o e-mail.
          console.error("Magic link failed", error);
          toast.error(
            T("Não foi possível enviar o e-mail agora. Seus flashcards estão salvos; use Entrar para receber o link depois."),
          );
        }
      }

      setVisitorIdentity(recordLandingVisitorTest(name, email));
      setResultsStatus("ready");
      setTimeout(() => {
        document.getElementById("results-section")?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return true;
    } catch (err) {
      console.error("Claim cards failed", err);
      setClaimError(
        err instanceof Error ? err.message : T("Falha ao registrar seus dados. Tente novamente."),
      );
      if (returning) setResultsStatus("error");
      return false;
    } finally {
      setIsClaiming(false);
    }
  }

  function handleReset() {
    setResultsStatus("idle");
    setGeneratedCards([]);
    setClaimError(null);
    setSavedVisitorEmail(null);
    claimedTestRef.current = null;
    pendingGeneratedRef.current = [];
    setVisitorTestSource("");
    setVisitorMaterials({ note: false, map: false, video: false });
    document.getElementById("capture")?.scrollIntoView({ behavior: "smooth" });
  }

  const money = (amount: number) =>
    new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang, {
      style: "currency",
      currency: "USD",
    }).format(amount);
  return (
    <main
      className="landing-page min-h-screen select-none bg-background text-foreground"
      onCopy={blockCopy}
      onCut={blockCopy}
      onContextMenu={blockCopy}
      onDragStart={blockCopy}
    >
      <header className="landing-header relative z-20 border-b border-border bg-background">
        <div className="mx-auto flex min-h-[88px] max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <Link to="/" aria-label="FlashPilot">
            <BrandLogo priority size="homepage" />
          </Link>
          <nav className="flex items-center gap-3" aria-label="FlashPilot">
            <Link to="/blog" className="hidden text-sm font-medium hover:text-accent sm:inline">
              Blog
            </Link>
            <Button asChild variant="ghost">
              <Link to="/auth">{old.login}</Link>
            </Button>
          </nav>
        </div>
      </header>
      <section className="landing-hero relative isolate overflow-hidden bg-background">
        <div className="mx-auto max-w-6xl px-5 pt-8 pb-10 sm:px-8 sm:pt-12">
          <div className="mb-8">
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl text-foreground">
              FlashPilot
            </h1>
            <p className="mt-2 text-xl font-medium text-muted-foreground sm:text-2xl">
              {T("Crie flashcards inteligentes")}
            </p>
          </div>
          <LandingCapture
            onStartInstantTest={handleStartInstantTest}
            isGenerating={resultsStatus === "generating"}
          />
        </div>
      </section>
      <LandingResultsSection
        status={resultsStatus}
        cards={generatedCards}
        autoMaterials={visitorMaterials}
        onClaim={handleClaimCards}
        isClaiming={isClaiming}
        claimError={claimError}
        emailLocked={savedVisitorEmail !== null}
        knownVisitor={visitorIdentity !== null}
        testCounter={
          visitorIdentity &&
          visitorIdentity.tests > 0 &&
          !UNLIMITED_TEST_EMAILS.has(visitorIdentity.email)
            ? `${Math.min(visitorIdentity.tests, LANDING_TEST_LIMITS.perEmailPerDay)}/${LANDING_TEST_LIMITS.perEmailPerDay}`
            : null
        }
        onReset={handleReset}
        onGenerateMaterial={handleGenerateMaterial}
      />
      <section className="w-full border-y border-border bg-secondary/40 py-10">
        <div className="w-full px-5 sm:px-8">
          <div className="flex flex-col">
            <div className="mb-[30px]">
              <div className="min-w-0">
                <h3 className="mb-6 text-center text-sm font-semibold text-foreground">
                  {landingLanguageTitle(copyLang)}
                </h3>
                <div
                  className="landing-language-marquee"
                  aria-label={landingLanguageTitle(copyLang)}
                >
                  <div className="landing-language-marquee__track">
                    {[0, 1].map((copy) => (
                      <div
                        key={copy}
                        className="landing-language-marquee__group"
                        aria-hidden={copy === 1}
                      >
                        {LANDING_COUNTRY_LANGS.map((item) => (
                          <Link
                            key={`${copy}-${item.code}`}
                            to="/"
                            search={{ lang: item.code }}
                            aria-label={item.name}
                            title={item.name}
                            tabIndex={copy === 1 ? -1 : undefined}
                            className="landing-language-marquee__item"
                          >
                            <FlagIcon flag={landingLanguageFlag(item.code)} className="h-5 w-7" />
                            <span className="landing-language-marquee__country">
                              {landingCountryName(item.code, copyLang)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Send className="h-5 w-5 text-accent" />
                Telegram
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="h-5 w-5 text-accent" />
                SM-2
              </div>
              <p className="text-sm text-muted-foreground">{old.telegram}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-semibold text-accent">FlashPilot</p>
          <h2 className="text-4xl leading-tight sm:text-5xl">{c.ecosystem}</h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">{c.ecosystemIntro}</p>
        </div>
        <div className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {c.features.map(([title, body], i) => {
            const Icon = icons[i];
            return (
              <div key={title} className="border-t border-border pt-6">
                <Icon className="mb-4 h-7 w-7 text-accent" />
                <h3 className="text-2xl">{title}</h3>
                <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">{body}</p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <h2 className="text-4xl">{c.useTitle}</h2>
          <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {c.uses.map((use, i) => (
              <p key={use} className="border-t border-border pt-4 text-base font-semibold">
                <span className="mb-3 block text-sm text-accent">0{i + 1}</span>
                {use}
              </p>
            ))}
          </div>
        </div>
      </section>
      <section className="w-full border-b border-border bg-secondary/40 py-10">
        <div className="w-full px-5 sm:px-8">
          <div className="flex flex-col">
            <div className="mb-[30px]">
              <div className="min-w-0">
                <h3 className="mb-6 text-center text-sm font-semibold text-foreground">
                  {landingLanguageTitle(copyLang)}
                </h3>
                <div
                  className="landing-language-marquee"
                  aria-label={landingLanguageTitle(copyLang)}
                >
                  <div className="landing-language-marquee__track">
                    {[0, 1].map((copy) => (
                      <div
                        key={copy}
                        className="landing-language-marquee__group"
                        aria-hidden={copy === 1}
                      >
                        {LANDING_COUNTRY_LANGS.map((item) => (
                          <Link
                            key={`${copy}-${item.code}`}
                            to="/"
                            search={{ lang: item.code }}
                            aria-label={item.name}
                            title={item.name}
                            tabIndex={copy === 1 ? -1 : undefined}
                            className="landing-language-marquee__item"
                          >
                            <FlagIcon flag={landingLanguageFlag(item.code)} className="h-5 w-7" />
                            <span className="landing-language-marquee__country">
                              {landingCountryName(item.code, copyLang)}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Send className="h-5 w-5 text-accent" />
                Telegram
              </div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="h-5 w-5 text-accent" />
                SM-2
              </div>
              <p className="text-sm text-muted-foreground">{old.telegram}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <h2 className="text-4xl">{c.prices}</h2>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {[
            [c.trial, "US$ 0", `${LANDING_ECONOMY.welcome} FlashCoins`],
            [
              c.monthly,
              money(LANDING_ECONOMY.monthlyUsd),
              `+${LANDING_ECONOMY.monthly} FlashCoins`,
            ],
            [c.yearly, money(LANDING_ECONOMY.yearlyUsd), `+${LANDING_ECONOMY.yearly} FlashCoins`],
          ].map(([label, price, coins]) => (
            <div
              key={label}
              className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6"
            >
              <h3 className="text-2xl">{label}</h3>
              <p className="text-3xl font-semibold">{price}</p>
              <p className="text-sm font-medium text-accent">{coins}</p>
              <Button asChild variant="outline" className="mt-auto">
                <Link to="/auth">
                  {c.trial}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-4xl text-sm leading-7 text-muted-foreground">{c.economy}</p>
        <p className="mt-3 text-sm font-semibold">{c.packs}</p>
        <MoneyBackGuarantee className="mx-auto mt-8 max-w-3xl" />
      </section>
      <section className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-[1fr_1.6fr]">
          <h2 className="text-4xl leading-tight">{c.faqTitle}</h2>
          <Accordion type="single" collapsible>
            {c.faq.map(([q, a], i) => (
              <AccordionItem key={q} value={`faq-${i}`}>
                <AccordionTrigger className="text-base">{q}</AccordionTrigger>
                <AccordionContent className="leading-7 text-muted-foreground">{a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
      <footer className="border-t border-border bg-secondary/50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-8 sm:px-8">
          <div>
            <p className="text-xl font-semibold">FlashPilot</p>
            <p className="mt-2 text-xs text-muted-foreground">{old.footer}</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <Link to="/blog">Blog</Link>
            <Link to="/termos">{c.terms}</Link>
            <Link to="/privacidade">{c.privacy}</Link>
            <RefundLink />
            <Link to="/auth">{old.login}</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
