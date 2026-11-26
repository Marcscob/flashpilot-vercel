import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { blogNewsletterEmailCopy } from "../src/lib/email-templates/blog-newsletter-i18n";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("blog newsletter", () => {
  it("uses the subscriber's native language for email and action-page copy", () => {
    const portuguese = blogNewsletterEmailCopy("pt");
    const spanish = blogNewsletterEmailCopy("es-ES");
    const english = blogNewsletterEmailCopy("en-GB");

    expect(portuguese.copy.confirmationButton).toBe("Confirmar inscrição");
    expect(spanish.lang).toBe("es-ES");
    expect(spanish.copy.confirmationButton).toBe("Confirmar suscripción");
    expect(english.copy.confirmationButton).toBe("Confirm subscription");
    expect(portuguese.copy.confirmedBody).toContain("idioma selecionado");
  });

  it("requires an explicit user action before confirming or unsubscribing", () => {
    const confirmationPage = source("../src/routes/blog/confirm-subscription.tsx");
    const unsubscribePage = source("../src/routes/blog/unsubscribe.tsx");

    expect(confirmationPage).toContain('createFileRoute("/blog/confirm-subscription")');
    expect(confirmationPage).toContain("onClick={() => void confirm()}");
    expect(unsubscribePage).toContain('createFileRoute("/blog/unsubscribe")');
    expect(unsubscribePage).toContain("onClick={() => void confirmUnsubscribe()}");
    expect(confirmationPage).toContain('state === "loading"');
    expect(unsubscribePage).toContain('state === "loading"');
  });
});
