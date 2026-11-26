import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Clapperboard, GripHorizontal, X, Network, PlayCircle, Square, Volume2 } from "lucide-react";
import { speak, stopSpeaking } from "@/lib/tts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { T } from "@/lib/i18n-ui";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { normalizeScenes, type TvStyle } from "@/lib/card-video";
import { FlashPilotTv, type TvSource } from "@/components/FlashPilotTv";
import { CreateCardVideoDialog } from "@/components/CreateCardVideoDialog";
import { MindMapViewerDialog } from "@/components/MindMapViewerDialog";
import { GenerateMindMapDialog } from "@/components/GenerateMindMapDialog";

type Micro = { id: string; title: string; content: string; order_index?: number; user_notes?: string | null } | null | undefined;

/** Card 0: recapitulação do microcontexto do card atual, aberta sob demanda. */
export function MicrocontextRecap({ micro, lang, total, position }: { micro: Micro; lang?: string; total?: number; position?: number }) {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videos, setVideos] = useState<Extract<TvSource, { kind: "generated" }>[]>([]);
  const [tv, setTv] = useState<TvSource | null>(null);
  useEffect(() => { setNotes(micro?.user_notes ?? ""); }, [micro?.id, micro?.user_notes]);
  const [mindmap, setMindmap] = useState<{ path: string; title: string } | null>(null);
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const loadMindmap = useCallback(async () => {
    if (!micro?.id) return;
    const { data } = await supabase.from("microcontexts").select("mindmap_data").eq("id", micro.id).maybeSingle();
    const m = data?.mindmap_data as { path?: string; title?: string } | null;
    setMindmap(m?.path ? { path: m.path, title: m.title ?? micro.title } : null);
  }, [micro?.id, micro?.title]);
  useEffect(() => { setMapUrl(null); if (open) void loadMindmap(); }, [open, loadMindmap]);
  const showMindmap = async () => {
    if (!mindmap) return;
    if (mapUrl) { setMapUrl(null); return; }
    const { getMindMapSignedUrl } = await import("@/lib/mindmap-image");
    try { setMapUrl(await getMindMapSignedUrl(mindmap.path)); } catch { toast.error(T("Não foi possível abrir o mapa mental")); }
  };
  const linkMindmap = async (path: string) => {
    if (!micro) return;
    let ebookPath: string | null = null;
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: png } = await supabase.storage.from("flashcard-mindmaps").download(path);
      if (u.user && png) {
        const { prepareEbookImage } = await import("@/lib/ebook-image");
        const jpg = await prepareEbookImage(new File([png], "map.png", { type: "image/png" }));
        const target = `${u.user.id}/mindmaps/${micro.id}-${Date.now()}.jpg`;
        const { error } = await supabase.storage.from("ebook-images").upload(target, jpg, { contentType: "image/jpeg" });
        if (!error) ebookPath = target;
      }
    } catch { /* e-book copy is best-effort */ }
    const { data: tree } = await supabase.from("note_media").select("title").eq("storage_path", path).maybeSingle();
    await supabase.from("microcontexts").update({ mindmap_data: { path, ebook_path: ebookPath, title: tree?.title ?? micro.title } }).eq("id", micro.id);
    void loadMindmap();
  };
  const loadVideos = useCallback(async (playId?: string) => {
    if (!micro?.id) return;
    const { data } = await supabase
      .from("card_videos")
      .select("id, scenes, lang, style, transcript, transcript_note")
      .eq("microcontext_id", micro.id)
      .order("created_at", { ascending: false });
    const list = (data ?? []).map((r) => ({
      kind: "generated" as const,
      id: r.id,
      scenes: normalizeScenes({ scenes: r.scenes }),
      lang: r.lang,
      style: r.style as TvStyle,
      transcript: r.transcript,
      transcriptNote: r.transcript_note,
    }));
    setVideos(list);
    if (playId) {
      const v = list.find((x) => x.id === playId);
      if (v) setTv(v);
    }
  }, [micro?.id]);
  useEffect(() => {
    setTv(null);
    if (open) void loadVideos();
  }, [open, loadVideos]);
  const saveNotes = async () => {
    if (!micro) return;
    setSaving(true);
    const { error } = await supabase.from("microcontexts").update({ user_notes: notes.slice(0, 5000) }).eq("id", micro.id);
    setSaving(false);
    if (error) toast.error(T("Não foi possível salvar")); else { micro.user_notes = notes; toast.success(T("Anotação salva")); }
  };
  const listen = async () => {
    if (!micro) return;
    if (playing) { stopSpeaking(); setPlaying(false); return; }
    setPlaying(true);
    try { await speak(`${micro.title}. ${micro.content}`, { lang }); } finally { setPlaying(false); }
  };
  const isMobile = useIsMobile();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const x = Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - 120);
    const y = Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 60);
    setPos({ x, y });
  };
  const close = () => { setOpen(false); if (playing) { stopSpeaking(); setPlaying(false); } };
  const lastId = useRef<string | null>(null);
  // Transição: avisa ao entrar em um novo bloco durante o estudo.
  useEffect(() => {
    if (!micro?.id) return;
    if (lastId.current && lastId.current !== micro.id) toast(micro.title);
    lastId.current = micro.id;
  }, [micro?.id, micro?.title]);
  if (!micro?.content) return null;
  const trigger = (
    <Button key={micro.id} variant="outline" size="sm" className="gap-2 badge-blink-red [animation-duration:0.5s]" onClick={isMobile ? undefined : () => setOpen((v) => !v)}>
      <BookOpen className="h-4 w-4" />
      <span className="truncate max-w-[14rem]">{typeof (position ?? micro.order_index) === "number" ? `${(position ?? micro.order_index ?? 0) + 1}${total && total > 1 ? `/${total}` : ""}. ` : ""}{micro.title}</span>
    </Button>
  );
  const body = (
    <>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" className="gap-2" onClick={listen}>
            {playing ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {playing ? T("Parar") : T("Ouvir")}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setMapOpen(true)}>
            <Network className="h-4 w-4" />
            {mindmap ? T("Recriar mapa mental") : T("Criar mapa mental")}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setVideoOpen(true)}>
            <Clapperboard className="h-4 w-4" />
            {T("Criar microvídeo")}
          </Button>
        </div>
        {(mindmap || videos.length > 0) && (
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{T("Prontos")}</p>
            <div className="flex flex-wrap gap-2">
              {mindmap && (
                <Button variant="outline" size="sm" className="gap-2" onClick={showMindmap}>
                  <Network className="h-4 w-4" />
                  {T("Ver mapa mental")}
                </Button>
              )}
              {!tv && videos.map((v, i) => (
                <Button key={v.id} variant="outline" size="sm" className="gap-2" onClick={() => setTv(v)}>
                  <PlayCircle className="h-4 w-4" />
                  {videos.length > 1 ? T("Vídeo {n}", { n: i + 1 }) : T("Assistir ao microvídeo")}
                </Button>
              ))}
            </div>
          </div>
        )}
        <MindMapViewerDialog path={mindmap?.path} open={!!mapUrl} onOpenChange={(o) => { if (!o) setMapUrl(null); }} {...(mindmap?.title ? { title: mindmap.title } : {})} />
        {tv && (
          <div className="mt-3">
            <FlashPilotTv source={tv} onClose={() => setTv(null)} onDeleted={() => { setTv(null); void loadVideos(); }} />
          </div>
        )}
        <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground">
          {micro.content}
        </div>
        <div className="mt-6 space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{T("Minhas anotações")}</p>
          <Textarea value={notes} maxLength={5000} rows={5} onChange={(e) => setNotes(e.target.value)} />
          <Button size="sm" onClick={saveNotes} disabled={saving || notes === (micro.user_notes ?? "")}>
            {saving ? T("Salvando...") : T("Salvar")}
          </Button>
        </div>
    </>
  );
  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={(v) => { if (v) setOpen(true); else close(); }}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{T("Recapitulação")}</p>
              <SheetTitle>{micro.title}</SheetTitle>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      ) : (
        trigger
      )}
      {!isMobile && open && (
        <div
          role="dialog"
          aria-label={micro.title}
          className="fixed z-50 flex max-h-[80vh] w-[28rem] flex-col rounded-lg border bg-background shadow-lg"
          style={pos ? { left: pos.x, top: pos.y } : { left: 24, top: 96 }}
        >
          <div
            className="flex cursor-move touch-none select-none items-start gap-2 border-b p-4"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => { drag.current = null; }}
          >
            <GripHorizontal className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{T("Recapitulação")}</p>
              <h2 className="text-lg font-semibold text-foreground">{micro.title}</h2>
            </div>
            <Button variant="ghost" size="icon" aria-label={T("Fechar")} onPointerDown={(e) => e.stopPropagation()} onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-y-auto px-4 pb-4">{body}</div>
        </div>
      )}
      <GenerateMindMapDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        source={micro ? { kind: "text", text: `${micro.title}. ${micro.content}`, lang, title: micro.title } : null}
        onSaved={(saved) => void linkMindmap(saved.path)}
      />
      {micro && (
        <CreateCardVideoDialog
          open={videoOpen}
          onOpenChange={setVideoOpen}
          microcontextId={micro.id}
          isOfficial={false}
          question={micro.title}
          answer={micro.content}
          appLang={lang ?? "pt-BR"}
          onCreated={() => void loadVideos()}
          onReady={(id) => void loadVideos(id)}
        />
      )}
    </>
  );
}
