import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { langFromConfirmationUrl, signupCopy } from "../src/lib/email-templates/signup-i18n";
import { authEmailRedirectUrl, welcomeLocale } from "../src/lib/welcome-locale";

const signupWebhook = readFileSync(
  new URL("../src/routes/lovable/email/auth/webhook.ts", import.meta.url),
  "utf8",
);

test("auth confirmation links preserve the detected Portuguese locale", () => {
  const locale = welcomeLocale("pt", ["pt-BR", "en-US"]);
  const redirectUrl = authEmailRedirectUrl("https://flashpilot.net", locale, true);
  const confirmationUrl = new URL("https://project.supabase.co/auth/v1/verify");
  confirmationUrl.searchParams.set("type", "signup");
  confirmationUrl.searchParams.set("redirect_to", redirectUrl);

  expect(new URL(redirectUrl).searchParams.get("resume")).toBe("1");
  expect(langFromConfirmationUrl(confirmationUrl.toString())).toBe("pt-BR");
});

test("an explicitly selected regional locale takes precedence over browser language", () => {
  expect(welcomeLocale("pt-PT", ["pt-BR", "en-US"])).toBe("pt-PT");
});

test("signup email uses the auth callback locale when the action link omits it", () => {
  const locale = langFromConfirmationUrl(
    "https://project.supabase.co/auth/v1/verify?type=signup&token=opaque",
    "https://flashpilot.net/?resume=1&lang=it-IT",
  );

  expect(locale).toBe("it-IT");
  expect(signupCopy(locale, "FlashPilot").subject).toContain("Benvenuto");
  expect(signupWebhook).toContain("langFromConfirmationUrl(data.url, data.callback_url)");
});
