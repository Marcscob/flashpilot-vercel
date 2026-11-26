import { createFileRoute } from "@tanstack/react-router";
import { T } from "@/lib/i18n-ui";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Printer, Loader2, Sparkles } from "lucide-react";
import { BulkFormatNotesDialog } from "@/components/BulkFormatNotesDialog";
import { BrandLogo } from "@/components/BrandLogo";
import { sanitizeNoteHtml } from "@/lib/sanitize-html";

export const Route = createFileRoute("/_authenticated/apostila")({
  component: ApostilaPage,
  head: () => ({
    meta: [
      { title: "Apostila para impressão | FlashPilot" },
      { name: "description", content: "Monte uma apostila em PDF a partir das suas anotações padronizadas, com capa, sumário e numeração de páginas." },
      { property: "og:title", content: "Apostila para impressão | FlashPilot" },
      { property: "og:description", content: "Compile suas anotações em uma apostila pronta para imprimir ou salvar em PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Note = { id: string; title: string; content_html: string; category_id: string | null };
type Cat = { id: string; name: string; parent_id: string | null };

const ALL = "__all__";
const UNCAT = "__uncat__";

function ApostilaPage() {
  const [cat, setCat] = useState<string>(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [coverTitle, setCoverTitle] = useState("Apostila de Estudos");
  const [aiOpen, setAiOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [preparingPrint, setPreparingPrint] = useState(false);

  useEffect(() => setMounted(true), []);

  const notes = useQuery({
    queryKey: ["apostila-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, content_html, category_id")
        .order("title");
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  const cats = useQuery({
    queryKey: ["note_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_categories")
        .select("id, name, parent_id")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Cat[];
    },
  });

  const filtered = useMemo(() => {
    const all = notes.data ?? [];
    if (cat === ALL) return all;
    if (cat === UNCAT) return all.filter((n) => !n.category_id);
    return all.filter((n) => n.category_id === cat);
  }, [notes.data, cat]);

  const chosen = useMemo(
    () => filtered.filter((n) => selected.has(n.id)),
    [filtered, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function printBooklet() {
    if (!chosen.length || preparingPrint) return;
    setPreparingPrint(true);
    try {
      await document.fonts?.ready;
      const printRoot = document.querySelector(".apostila-print-root");
      const images = Array.from(printRoot?.querySelectorAll("img") ?? []);
      await Promise.all(images.map(async (image) => {
        if (image.complete) return;
        try {
          await image.decode();
        } catch {
          // A impressão continua mesmo se uma imagem externa não puder ser decodificada.
        }
      }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      window.print();
    } finally {
      setPreparingPrint(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-4">
        <h1 className="text-2xl font-serif">{T("Gerar apostila")}</h1>

        <Card className="p-4 space-y-3">
          <Input
            value={coverTitle}
            onChange={(e) => setCoverTitle(e.target.value)}
            placeholder={T("Título da capa")}
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={cat} onValueChange={(v) => { setCat(v); setSelected(new Set()); }}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{T("Todas as categorias")}</SelectItem>
                <SelectItem value={UNCAT}>{T("Sem categoria")}</SelectItem>
                {(cats.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setSelected(new Set(filtered.map((n) => n.id)))}>
              {T("Selecionar todas")}
            </Button>
            <Button variant="outline" onClick={() => setSelected(new Set())}>{T("Limpar")}</Button>
            <Button variant="outline" onClick={() => setAiOpen(true)} title={T("Padronizar títulos e layout das anotações com o PilotAI")}>
              <Sparkles className="h-4 w-4 mr-1" /> {T("Formatar com o PilotAI")}
            </Button>
            <Button onClick={printBooklet} disabled={!chosen.length || preparingPrint}>
              {preparingPrint
                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                : <Printer className="h-4 w-4 mr-1" />}
              {preparingPrint ? T("Preparando…") : "Imprimir / PDF"}
            </Button>
          </div>

          {notes.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {T("Carregando anotações…")}
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto space-y-1 text-sm">
              {filtered.map((n) => (
                <li key={n.id}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(n.id)}
                      onChange={() => toggle(n.id)}
                    />
                    <span className="truncate">{n.title || T("Sem título")}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            {T("{n} anotação(ões) na apostila. Use “Imprimir / PDF” e escolha “Salvar como PDF”.", { n: chosen.length })}
          </p>
        </Card>
      </div>

      {chosen.length > 0 && (
        <div
          className="apostila select-none"
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          <section className="apostila-cover">
            <BrandLogo className="apostila-logo mx-auto mb-8 h-auto w-64 max-w-[70%]" />
            <h1>{coverTitle}</h1>
            <p>{new Date().toLocaleDateString("pt-BR")}</p>
          </section>

          <section className="apostila-toc">
            <h2>{T("Sumário")}</h2>
            <ol>
              {chosen.map((n) => (
                <li key={n.id}>{n.title || T("Sem título")}</li>
              ))}
            </ol>
          </section>

          {chosen.map((n) => (
            <article key={n.id} className="apostila-chapter">
              <h2>{n.title || T("Sem título")}</h2>
              <div className="note-body" dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(n.content_html) }} />
            </article>
          ))}
        </div>
      )}
      {mounted && chosen.length > 0 && createPortal(
        <div className="apostila-print-root" aria-hidden="true">
          <div className="apostila select-none">
            <section className="apostila-cover">
              <BrandLogo className="apostila-logo mx-auto mb-8 h-auto w-64 max-w-[70%]" />
              <h1>{coverTitle}</h1>
              <p>{new Date().toLocaleDateString("pt-BR")}</p>
            </section>

            <section className="apostila-toc">
              <h2>{T("Sumário")}</h2>
              <ol>
                {chosen.map((n) => (
                  <li key={n.id}>{n.title || T("Sem título")}</li>
                ))}
              </ol>
            </section>

            {chosen.map((n) => (
              <article key={n.id} className="apostila-chapter">
                <h2>{n.title || T("Sem título")}</h2>
                <div className="note-body" dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(n.content_html) }} />
              </article>
            ))}
          </div>
        </div>,
        document.body,
      )}
      <BulkFormatNotesDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        notes={notes.data ?? []}
        cats={cats.data ?? []}
        onDone={() => notes.refetch()}
      />
    </div>
  );
}
