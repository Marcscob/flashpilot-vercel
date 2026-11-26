import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { T } from "@/lib/i18n-ui";

export function NoteExportMenu({
  title,
  html,
  className,
}: {
  title: string;
  html: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function run(kind: "pdf" | "docx") {
    setBusy(true);
    try {
      const m = await import("@/lib/note-export");
      await (kind === "pdf" ? m.exportNotePdf(title, html) : m.exportNoteDocx(title, html));
    } catch (e: any) {
      toast.error(e?.message ?? T("Erro"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={className}
          disabled={busy}
          title={T("Exportar anotação")}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Download className="h-4 w-4 shrink-0" />
          )}
          <span>{T("Exportar")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run("pdf")}>{T("PDF (.pdf)")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("docx")}>{T("Word (.docx)")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
