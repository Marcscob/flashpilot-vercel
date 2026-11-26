import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { T } from "@/lib/i18n-ui";
import { cn } from "@/lib/utils";
import { generateCardVideo } from "@/lib/card-video.functions";
import { needsLanguageChoice, type TvStyle } from "@/lib/card-video";
import { completeCardVideo } from "@/lib/card-video-ready";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cardId?: string;
  /** Quando definido, o vídeo é gerado a partir do texto do bloco (Card 0), sem cardId. */
  microcontextId?: string;
  isOfficial: boolean;
  question: string;
  answer: string;
  appLang: string;
  subjectLang?: string | null;
  onCreated: () => void;
  onReady: (id: string) => void;
};

export function CreateCardVideoDialog({ open, onOpenChange, cardId, microcontextId, isOfficial, question, answer, appLang, subjectLang, onCreated, onReady }: Props) {
  const ask = needsLanguageChoice(appLang, subjectLang);
  const [lang, setLang] = useState(appLang);
  const [style, setStyle] = useState<TvStyle>("both");

  const opt = (active: boolean) => cn("flex-1 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition", active ? "border-primary bg-primary/10" : "border-border hover:bg-muted");

  const submit = () => {
    onOpenChange(false);
    toast.info(T("Pode levar alguns segundos. Continue estudando; avisaremos quando estiver pronto."));
    generateCardVideo({ data: { actionId: crypto.randomUUID(), cardId, microcontextId, isOfficial, question, answer, lang: ask ? lang : appLang, style } })
      .then(({ id }) => {
        completeCardVideo(id, onCreated, (videoId) => {
          toast.success(T("Microvídeo pronto"), { duration: 15000, action: { label: T("Assistir"), onClick: () => onReady(videoId) } });
        });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : String(e)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{T("Criar microvídeo")}</DialogTitle>
          <DialogDescription>{T("Pode levar alguns segundos. Continue estudando; avisaremos quando estiver pronto.")}</DialogDescription>
        </DialogHeader>
        {ask && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{T("Idioma do vídeo")}</p>
            <div className="flex gap-2">
              <button type="button" className={opt(lang === appLang)} onClick={() => setLang(appLang)}>{T("Idioma do app")} ({appLang})</button>
              <button type="button" className={opt(lang === subjectLang)} onClick={() => setLang(subjectLang!)}>{T("Idioma da matéria")} ({subjectLang})</button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          <p className="text-sm font-medium">{T("Estilo do vídeo")}</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={opt(style === "avatar")} onClick={() => setStyle("avatar")}>👩‍🎓 {T("Avatar")}</button>
            <button type="button" className={opt(style === "motion")} onClick={() => setStyle("motion")}>✨ {T("Textos e animações")}</button>
            <button type="button" className={opt(style === "both")} onClick={() => setStyle("both")}>🎬 {T("Ambos")}</button>
          </div>
        </div>
        <Button onClick={submit} className="w-full">{T("Gerar vídeo")}</Button>
      </DialogContent>
    </Dialog>
  );
}
