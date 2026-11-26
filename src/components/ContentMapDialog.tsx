import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { buildTopicMicrocontexts } from "@/lib/microcontexts.functions";
import { BookOpen, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type SavedContentTopic = { id: string; cardCount: number };

const copy = {
  pt: { organize: "Organizar em blocos", organizeError: "Não foi possível organizar.", title: "Mapa do Conteúdo", cards: "cards", blocks: "microcontextos", start: "Estudar na sequência", topic: "Assunto", error: "Não foi possível carregar os títulos dos assuntos." },
  "pt-PT": { organize: "Organizar em blocos", organizeError: "Não foi possível organizar.", title: "Mapa do Conteúdo", cards: "cartões", blocks: "microcontextos", start: "Estudar por ordem", topic: "Tema", error: "Não foi possível carregar os títulos dos temas." },
  en: { organize: "Organize into blocks", organizeError: "Could not organize.", title: "Content Map", cards: "cards", blocks: "microcontexts", start: "Study in order", topic: "Topic", error: "Could not load topic titles." },
  es: { organize: "Organizar en bloques", organizeError: "No se pudo organizar.", title: "Mapa del Contenido", cards: "tarjetas", blocks: "microcontextos", start: "Estudiar en orden", topic: "Tema", error: "No se pudieron cargar los títulos." },
  fr: { organize: "Organiser en blocs", organizeError: "Impossible d’organiser.", title: "Plan du contenu", cards: "cartes", blocks: "microcontextes", start: "Étudier dans l’ordre", topic: "Sujet", error: "Impossible de charger les titres." },
  it: { organize: "Organizza in blocchi", organizeError: "Impossibile organizzare.", title: "Mappa dei contenuti", cards: "schede", blocks: "microcontesti", start: "Studia in ordine", topic: "Argomento", error: "Impossibile caricare i titoli." },
  de: { organize: "In Blöcke gliedern", organizeError: "Gliederung fehlgeschlagen.", title: "Inhaltsübersicht", cards: "Karten", blocks: "Mikrokontexte", start: "Der Reihe nach lernen", topic: "Thema", error: "Die Titel konnten nicht geladen werden." },
};

/** Read-only summary of the successful save; opening it never generates media or content. */
export function ContentMapDialog({ topics, onClose }: { topics: SavedContentTopic[]; onClose: () => void }) {
  const { lang, extLang } = useLang();
  const t = extLang ? copy.en : copy[lang] ?? copy.en;
  const build = useServerFn(buildTopicMicrocontexts);
  const [busy, setBusy] = useState<string | null>(null);
  const ids = topics.map((topic) => topic.id);
  // Microcontexts are always built automatically after saving; no user action needed.
  const started = useRef(new Set<string>());
  useEffect(() => {
    const pending = ids.filter((id) => !started.current.has(id));
    if (!pending.length) return;
    pending.forEach((id) => started.current.add(id));
    void (async () => {
      for (const topicId of pending) {
        setBusy(topicId);
        try {
          for (let i = 0; i < 20; i++) {
            const r = await build({ data: { topicId, language: lang } });
            if (!r.created) break;
          }
        } catch { toast.error(t.organizeError); }
      }
      setBusy(null);
      await details.refetch();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);
  const details = useQuery({
    queryKey: ["saved-content-map", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const [names, blocks] = await Promise.all([
        supabase.from("topics").select("id, name").in("id", ids),
        supabase.from("microcontexts").select("id, topic_id, title, order_index").in("topic_id", ids).order("order_index"),
      ]);
      if (names.error) throw names.error;
      if (blocks.error) throw blocks.error;
      return { names: names.data ?? [], blocks: blocks.data ?? [] };
    },
  });

  return (
    <Dialog open={topics.length > 0} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />{t.title}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{topics.reduce((sum, topic) => sum + topic.cardCount, 0)} {t.cards}</p>
        {details.isPending && <Loader2 aria-label={t.title} className="h-5 w-5 animate-spin text-muted-foreground" />}
        {details.isError && <p role="alert" className="text-sm text-destructive">{t.error}</p>}
        <ol className="divide-y divide-border">
          {topics.map((topic, index) => {
            const blocks = details.data?.blocks.filter((block) => block.topic_id === topic.id) ?? [];
            return (
              <li key={topic.id} className="space-y-3 py-4">
                <div className="flex items-start gap-3">
                  <span className="text-sm font-medium text-muted-foreground">{index + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-semibold">{details.data?.names.find((name) => name.id === topic.id)?.name ?? t.topic}</h3>
                    <p className="text-xs text-muted-foreground">{topic.cardCount} {t.cards}{blocks.length > 0 ? ` · ${blocks.length} ${t.blocks}` : ""}</p>
                  </div>
                </div>
                {blocks.length > 0 && <ol className="space-y-2 pl-7 text-sm text-muted-foreground">{blocks.map((block) => <li key={block.id} className="break-words">{block.order_index + 1}. {block.title}</li>)}</ol>}
                {busy === topic.id && <p className="flex items-center gap-2 pl-7 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t.organize}…</p>}
              </li>
            );
          })}
        </ol>
      </DialogContent>
    </Dialog>
  );
}