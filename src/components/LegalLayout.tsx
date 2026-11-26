import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useT } from "@/lib/i18n";

export function LegalLayout({
  icon,
  title,
  updatedAt,
  footer,
  children,
}: {
  icon?: ReactNode;
  title: string;
  updatedAt?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/auth" className="shrink-0">
            <BrandLogo className="h-auto w-[140px]" />
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {t.legal.back}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-primary">
            {icon}
            <span className="text-xs font-medium uppercase tracking-wide">FlashPilot</span>
          </div>
          <h1 className="mt-2 font-serif text-3xl text-foreground">{title}</h1>
          {updatedAt && <p className="mt-1 text-xs text-muted-foreground">{updatedAt}</p>}
        </div>

        <article className="space-y-4 text-sm leading-relaxed text-foreground/85 [&_h2]:mt-8 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:text-foreground [&_li]:ml-1 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </article>

        {footer && (
          <div className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </main>
    </div>
  );
}
