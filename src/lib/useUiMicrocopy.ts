import { useEffect } from "react";
import { useLang } from "./i18n";
import { translateMicrocopy } from "./i18n-microcopy";
import type { Lang } from "./lang-match";

/** Guarda o texto original em pt-BR para poder retraduzir quando o idioma muda. */
const SRC = {
  placeholder: "data-src-placeholder",
  label: "data-src-label",
  title: "data-src-title",
} as const;

/** Keep source copy and last translation so React updates can replace the source safely. */
const TEXT_SOURCES = new WeakMap<Text, { source: string; translated: string }>();
const ATTRIBUTE_TRANSLATIONS = new WeakMap<HTMLElement, Map<keyof typeof SRC, string>>();

function original(el: HTMLElement, attr: keyof typeof SRC, current: string | null): string | null {
  if (current === null || current === "") return null;
  const stored = el.getAttribute(SRC[attr]);
  const lastTranslated = ATTRIBUTE_TRANSLATIONS.get(el)?.get(attr);
  if (stored !== null && (current === stored || current === lastTranslated)) return stored;
  el.setAttribute(SRC[attr], current);
  return current;
}

function rememberTranslation(el: HTMLElement, attr: keyof typeof SRC, value: string) {
  let translations = ATTRIBUTE_TRANSLATIONS.get(el);
  if (!translations) {
    translations = new Map();
    ATTRIBUTE_TRANSLATIONS.set(el, translations);
  }
  translations.set(attr, value);
}

function setTranslatedAttribute(el: HTMLElement, attr: keyof typeof SRC, value: string) {
  rememberTranslation(el, attr, value);
  if (el.getAttribute(attr) !== value) el.setAttribute(attr, value);
}

function apply(el: HTMLElement, lang: Lang) {
  // Placeholders de inputs/textareas
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const src = original(el, "placeholder", el.getAttribute("placeholder"));
    if (src) {
      const next = translateMicrocopy(src, lang);
      setTranslatedAttribute(el, "placeholder", next);
    }
  }

  // Rótulo de acessibilidade
  const labelSrc = original(el, "label", el.getAttribute("aria-label"));
  if (labelSrc) {
    const next = translateMicrocopy(labelSrc, lang);
    setTranslatedAttribute(el, "label", next);
  }

  // Tooltip: traduz o title existente ou cria um a partir do rótulo/texto do botão
  const titleSrc = original(el, "title", el.getAttribute("title"));
  if (titleSrc) {
    const next = translateMicrocopy(titleSrc, lang);
    setTranslatedAttribute(el, "title", next);
    return;
  }

  const isControl =
    el instanceof HTMLButtonElement ||
    el instanceof HTMLAnchorElement ||
    el.getAttribute("role") === "button" ||
    el.getAttribute("role") === "link" ||
    el.getAttribute("role") === "tab";
  if (!isControl) return;

  const tip = labelSrc ? translateMicrocopy(labelSrc, lang) : (el.textContent ?? "").trim();
  if (tip && tip.length <= 120) {
    if (!el.hasAttribute(SRC.title)) el.setAttribute(SRC.title, labelSrc ?? tip);
    setTranslatedAttribute(el, "title", tip);
  }
}

function isNumericValue(value: string): boolean {
  return /^[\s+\-−]?[$€£¥]?\s*\d[\d\s.,:/%+\-−]*[$€£¥]?\s*$/.test(value);
}

function applyText(node: Text, lang: Lang) {
  const parent = node.parentElement;
  if (!parent || parent.closest("[contenteditable=true], .ProseMirror, script, style")) return;
  const current = node.data;
  const trimmed = current.trim();
  if (!trimmed || isNumericValue(trimmed)) return;
  const previous = TEXT_SOURCES.get(node);
  const source = previous && current.trim() === previous.translated ? previous.source : trimmed;
  const translated = translateMicrocopy(source, lang);
  TEXT_SOURCES.set(node, { source, translated });
  if (translated === source && lang !== "pt") return;
  const start = current.match(/^\s*/)?.[0] ?? "";
  const end = current.match(/\s*$/)?.[0] ?? "";
  const next = `${start}${translated}${end}`;
  if (node.data !== next) node.data = next;
}

function sweep(root: ParentNode, lang: Lang) {
  const selector =
    "input, textarea, button, a, [role=button], [role=link], [role=tab], [aria-label], [title], [data-slot=select-value]";
  if (root instanceof HTMLElement && root.matches(selector)) apply(root, lang);
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => apply(el, lang));

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();
  while (textNode) {
    applyText(textNode as Text, lang);
    textNode = walker.nextNode();
  }

  // Placeholder do Select (Radix renderiza como texto, não como atributo)
  root.querySelectorAll<HTMLElement>("[data-placeholder] [data-slot=select-value]").forEach((span) => {
    const src = original(span, "label", span.textContent?.trim() ?? null);
    if (!src) return;
    const next = translateMicrocopy(src, lang);
    rememberTranslation(span, "label", next);
    if (span.textContent !== next) span.textContent = next;
  });
}

/**
 * Traduz textos visíveis, placeholders, rótulos de acessibilidade e tooltips
 * e garante tooltip (`title`) em todo botão/link, no idioma da interface.
 */
export function useUiMicrocopy() {
  const { lang } = useLang();

  useEffect(() => {
    if (typeof document === "undefined") return;
    let frame = 0;
    const run = () => {
      frame = 0;
      sweep(document.body, lang);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(run);
    };

    run();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label", "title", "data-placeholder"],
    });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [lang]);
}
