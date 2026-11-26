import { Camera, FileSpreadsheet, FileText, Globe, Info, Mic, Type, Upload, Youtube, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MicButton } from "@/components/MicButton";
import { cn } from "@/lib/utils";
import { T } from "@/lib/i18n-ui";
import type { BulkV2Copy } from "@/lib/i18n-bulk-v2";

type Group = "docs" | "visual" | "media" | "sheets" | "web";

type GroupInfo = { id: Group; icon: LucideIcon; label: string; subtitle: string; tip: string; source: string; mode?: "mic" };

/** O balão abre ao passar o mouse ou focar o cartão e também ao tocar no "i" (celular). */
function SourceCard({ group, active, disabled, onSelect }: {
  group: GroupInfo; active: boolean; disabled: boolean; onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { icon: Icon, label, subtitle, tip } = group;
  return (
    <div className="relative min-w-0">
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <Button type="button" variant="outline" disabled={disabled}
            aria-pressed={active} onClick={onSelect}
            className={cn("group h-full min-h-28 w-full min-w-0 flex-col gap-2 whitespace-normal rounded-lg px-3 py-3 text-center transition-transform duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.025] hover:shadow-lg hover:bg-primary/5 hover:text-foreground",
              active && "border-primary bg-primary/5 ring-2 ring-primary/40")}>
            <Icon className="h-7 w-7 shrink-0 text-primary" />
            <span className="text-sm font-semibold leading-snug">{label}</span>
            <span className="text-xs font-normal leading-snug text-muted-foreground">{subtitle}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-center text-sm leading-snug">{tip}</TooltipContent>
      </Tooltip>
      <button type="button" aria-label={`${label}: ${tip}`} onClick={() => setOpen((value) => !value)}
        className="absolute end-1.5 top-1.5 rounded-full p-1 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function BulkV2CaptureSelector({ capture, audioMode, onSelect, t, disabled, micValue, micOnChange, micLang }: {
  capture: string | null;
  audioMode: "file" | "mic" | null;
  onSelect: (capture: string, audioMode?: "file" | "mic") => void;
  t: BulkV2Copy;
  disabled: boolean;
  /**
   * Texto narrado e quem o recebe. Quando micOnChange é informado, a gravação
   * acontece no próprio botão de opção; sem ele, a tela segue cuidando da
   * gravação do próprio jeito (é o caso da landing page).
   */
  micValue?: string;
  micOnChange?: (v: string) => void;
  micLang?: string;
}) {
  const activeGroup: Group | null = capture === "text" || capture === "doc" ? "docs"
    : capture === "photo" || capture === "image" ? "visual"
    : capture === "audio" || capture === "youtube" ? "media"
    : capture === "csv" ? "sheets" : capture === "web" ? "web" : null;
  const groups: GroupInfo[] = [
    { id: "docs", icon: FileText, label: t.groupDocs, subtitle: t.groupDocsDesc, source: "text",
      tip: T("Cole ou digite um texto, ou envie um PDF, DOCX ou TXT. O PilotAI lê o conteúdo e sugere os flashcards.") },
    { id: "visual", icon: Camera, label: t.groupVisual, subtitle: t.groupVisualDesc, source: "image",
      tip: T("Tire uma foto, escolha imagens ou cole um print de livro, caderno, slide ou tabela. O PilotAI lê o texto da imagem.") },
    { id: "media", icon: Mic, label: t.groupMedia, subtitle: t.groupMediaDesc, source: "audio",
      tip: T("Fale no microfone, envie um arquivo de áudio ou cole um link do YouTube. O que for dito é transcrito e vira flashcards.") },
    { id: "sheets", icon: FileSpreadsheet, label: t.groupSheets, subtitle: t.groupSheetsDesc, source: "csv",
      tip: T("Envie uma planilha com a pergunta em uma coluna e a resposta na outra. Duas colunas são importadas de graça, sem IA.") },
    { id: "web", icon: Globe, label: T("Página da Web"), subtitle: T("Link de artigo ou notícia"), source: "web",
      tip: T("Cole o link de um artigo, notícia ou página de estudo. Lemos o texto e as tabelas da página, sem menus e anúncios. Imagens e páginas com login não são lidas.") },
  ];
  const options = activeGroup === "docs" ? [
    { source: "text", label: t.typeText, icon: Type },
    { source: "doc", label: t.uploadDocument, icon: Upload },
  ] : activeGroup === "media" ? [
    { source: "audio", mode: "mic" as const, label: t.narrateAudio, icon: Mic },
    { source: "audio", mode: "file" as const, label: t.uploadAudio, icon: Upload },
    { source: "youtube", label: t.youtubeLink, icon: Youtube },
  ] : [];
  return <TooltipProvider delayDuration={150}>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {groups.map((group) => (
        <SourceCard key={group.id} group={group} active={activeGroup === group.id} disabled={disabled}
          onSelect={() => onSelect(group.source, group.mode)} />
      ))}
    </div>
    {options.length > 0 && <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const mode = "mode" in option ? option.mode : undefined;
        const selected = capture === option.source && (!mode || mode === audioMode);
        const Icon = option.icon;
        // Narração: um toque já abre o microfone; o próprio botão mostra
        // "Gravando…" com a cor oscilando e um novo toque encerra.
        if (option.source === "audio" && mode === "mic" && micOnChange) {
          return <MicButton key={`${option.source}-${mode}`} value={micValue ?? ""} onChange={micOnChange}
            lang={micLang} disabled={disabled} active={capture === "audio" && audioMode === "mic"}
            idleLabel={t.narrateAudio} recordingLabel={t.recording} busyLabel={t.transcribing}
            onStart={() => onSelect(option.source, "mic")} />;
        }
        return <Button key={`${option.source}-${mode ?? ""}`} type="button" disabled={disabled}
          variant={selected ? "default" : "outline"} aria-pressed={selected}
          onClick={() => onSelect(option.source, mode)}
          className={cn("h-auto min-h-10 max-w-full whitespace-normal text-start motion-safe:hover:scale-[1.025]", !selected && "hover:bg-primary/5 hover:text-foreground")}>
          <Icon className="h-4 w-4 shrink-0" />{option.label}
        </Button>;
      })}
    </div>}
  </TooltipProvider>;
}
