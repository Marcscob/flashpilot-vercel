import { findBlogLang, matchBlogTag } from "../blog-langs";
import { isLang } from "../lang-match";
import { lookupUi } from "../i18n-ui";
import { welcomeDirection } from "../welcome-locale";
import { BLOG_NEWSLETTER_COPY } from "./blog-newsletter-copy";
import extraTranslations from "./blog-newsletter-extra-translations.json";

type CopyKey = keyof typeof BLOG_NEWSLETTER_COPY;
type NewsletterCopy = Record<CopyKey, string>;
type ExtraTranslations = Record<string, Record<string, string>>;

const extraCopy = extraTranslations as ExtraTranslations;

export function blogNewsletterEmailCopy(rawLang: string): {
  lang: string;
  dir: "rtl" | "ltr";
  copy: NewsletterCopy;
} {
  const lang = matchBlogTag(rawLang) ?? "en";
  const locale = findBlogLang(lang)?.base ?? lang;
  const nativeLang = isLang(lang) ? lang : isLang(locale) ? locale : null;
  const extra = extraCopy[lang] ?? extraCopy[locale];
  const t = (source: string) =>
    (nativeLang ? lookupUi(source, nativeLang) : extra?.[source]) ??
    lookupUi(source, "en") ??
    source;

  return {
    lang,
    dir: welcomeDirection(lang),
    copy: {
      confirmationSubject: t(BLOG_NEWSLETTER_COPY.confirmationSubject),
      confirmationPreview: t(BLOG_NEWSLETTER_COPY.confirmationPreview),
      confirmationTitle: t(BLOG_NEWSLETTER_COPY.confirmationTitle),
      confirmationBody: t(BLOG_NEWSLETTER_COPY.confirmationBody),
      confirmationButton: t(BLOG_NEWSLETTER_COPY.confirmationButton),
      confirmationIgnore: t(BLOG_NEWSLETTER_COPY.confirmationIgnore),
      postSubject: t(BLOG_NEWSLETTER_COPY.postSubject),
      postPreview: t(BLOG_NEWSLETTER_COPY.postPreview),
      greeting: t(BLOG_NEWSLETTER_COPY.greeting),
      postIntro: t(BLOG_NEWSLETTER_COPY.postIntro),
      readButton: t(BLOG_NEWSLETTER_COPY.readButton),
      postFooter: t(BLOG_NEWSLETTER_COPY.postFooter),
      unsubscribe: t(BLOG_NEWSLETTER_COPY.unsubscribe),
      unsubscribePrompt: t(BLOG_NEWSLETTER_COPY.unsubscribePrompt),
      unsubscribeSuccess: t(BLOG_NEWSLETTER_COPY.unsubscribeSuccess),
      confirmationInvalid: t(BLOG_NEWSLETTER_COPY.confirmationInvalid),
      unsubscribeInvalid: t(BLOG_NEWSLETTER_COPY.unsubscribeInvalid),
      subscriptionConfirmed: t(BLOG_NEWSLETTER_COPY.subscriptionConfirmed),
      confirmedBody: t(BLOG_NEWSLETTER_COPY.confirmedBody),
      backToBlog: t(BLOG_NEWSLETTER_COPY.backToBlog),
      actionError: t(BLOG_NEWSLETTER_COPY.actionError),
    },
  };
}
