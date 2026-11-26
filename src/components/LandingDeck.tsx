import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang, useOverlayD } from "@/lib/i18n";
import { landingCopy } from "@/lib/landing-content";
export function LandingDeck({
  title,
  question,
  answer,
}: {
  title: string;
  question: string;
  answer: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const { lang, extLang } = useLang();
  const overlay = useOverlayD();
  const c = landingCopy(extLang ?? lang, overlay ?? undefined);
  return (
    <Button
      variant="outline"
      aria-label={`${title}: ${c.flip}`}
      aria-pressed={flipped}
      onClick={() => setFlipped((v) => !v)}
      className="landing-deck group h-auto min-h-60 w-full flex-col items-start justify-between gap-6 whitespace-normal rounded-lg p-6 text-start motion-safe:hover:-translate-y-1 hover:bg-secondary"
    >
      <span className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
        <span>{title}</span>
        <RotateCcw />
      </span>
      <span className="w-full text-xl font-semibold leading-relaxed text-foreground">
        {flipped ? answer : question}
      </span>
      <span className="text-xs text-muted-foreground">
        {flipped ? c.answer : c.question} · {c.flip}
      </span>
    </Button>
  );
}
