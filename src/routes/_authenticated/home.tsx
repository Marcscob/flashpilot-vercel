import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, BookOpen, Languages, ListFilter, Pencil, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => pageHead("Início — FlashPilot", "Crie e revise flashcards, pratique conversação e acesse a edição e os relatórios no FlashPilot."),
  component: HomePage,
});

const tileClass = "home-tile-in group h-auto min-h-28 w-full flex-col items-center justify-center gap-2.5 whitespace-normal rounded-2xl border border-border bg-card px-4 py-3 text-center text-card-foreground shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:bg-secondary hover:text-foreground hover:shadow-card focus-visible:ring-2 motion-safe:hover:scale-[1.015] motion-reduce:transition-none sm:min-h-40";
const circleClass = "grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 transition-all duration-300 group-hover:bg-primary/16 group-hover:shadow-card motion-safe:group-hover:scale-105 motion-reduce:transition-none sm:size-20";
const iconClass = "size-6! text-primary transition-transform duration-300 group-hover:text-accent motion-safe:group-hover:scale-110 motion-reduce:transition-none sm:size-10!";
const titleClass = "max-w-full break-words text-balance text-sm font-bold leading-tight sm:text-base";




function HomePage() {
  const t = useT();
  const text = t.homeHub;
  const destinations = [
    { to: "/bulk-v2", label: text.create, Icon: Layers },
    { to: "/review", label: text.review, Icon: BookOpen },
    { to: "/language-chat", label: text.conversation, Icon: Languages },
  ] as const;

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center py-1 sm:py-2" aria-labelledby="home-title">
      <h1 id="home-title" className="mb-3 text-center text-xl text-foreground sm:mb-4 sm:text-2xl">{t.nav.home}</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">


        {destinations.map(({ to, label, Icon }, i) => (
          <Button key={to} asChild variant="outline" className={tileClass} style={{ animationDelay: `${i * 90}ms` }}>
            <Link to={to}>
              <span className={circleClass} aria-hidden="true"><Icon className={iconClass} /></span>
              <span className={titleClass}>{label}</span>
            </Link>
          </Button>
        ))}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className={tileClass} style={{ animationDelay: "270ms" }}>
              <span className={circleClass} aria-hidden="true"><ListFilter className={iconClass} /></span>
              <span className={titleClass}>{text.management}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
            <DialogHeader><DialogTitle>{text.management}</DialogTitle></DialogHeader>
            <div className="grid gap-3 pt-2">
              <Button asChild variant="outline" className="h-auto min-h-14 justify-start whitespace-normal px-4 py-4">
                <Link to="/flashcards"><Pencil aria-hidden="true" />{text.edit}</Link>
              </Button>
              <Button asChild variant="outline" className="h-auto min-h-14 justify-start whitespace-normal px-4 py-4">
                <Link to="/reports"><BarChart3 aria-hidden="true" />{text.reports}</Link>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}