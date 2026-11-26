import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { T } from "@/lib/i18n-ui";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { Color } from "@tiptap/extension-color";
import { Underline } from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { Extension, Mark } from "@tiptap/core";
import { MultiRange, getMultiRanges, runOnRanges, clearMultiRanges } from "./note-multi-range";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadNoteImage } from "@/lib/note-image";
import {
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  Quote,
  Minus,
  Type,
  AArrowDown,
  AArrowUp,
  ImagePlus,
  Table as TableIcon,
  Rows3,
  Columns3,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noteH1: {
      toggleNoteH1: () => ReturnType;
    };
    noteH2: {
      toggleNoteH2: () => ReturnType;
    };
    noteH3: {
      toggleNoteH3: () => ReturnType;
    };
  }
}

/** Títulos como MARCA inline: aplicam-se apenas às palavras/trechos selecionados.
 *  O negrito e o tamanho vêm da classe CSS (note-h1/2/3), não de <strong>,
 *  então sobrevivem à normalização que remove negrito inline. */
function makeNoteHeading(level: 1 | 2 | 3) {
  const name = `noteH${level}` as const;
  const cls = `note-h${level}`;
  return Mark.create({
    name,
    group: "noteHeading",
    excludes: "noteH1 noteH2 noteH3",
    parseHTML() {
      return [{ tag: `span.${cls}` }, { tag: `p.${cls}` }];
    },
    renderHTML() {
      return ["span", { class: cls }, 0];
    },
    addCommands() {
      return {
        [`toggleNoteH${level}`]:
          () =>
          ({ commands }: any) =>
            commands.toggleMark(name),
      } as any;
    },
  });
}
const NoteH1 = makeNoteHeading(1);
const NoteH2 = makeNoteHeading(2);
const NoteH3 = makeNoteHeading(3);

/** Marca de tamanho de fonte por trecho (atributo do textStyle).
 *  Usa !important inline para vencer o `.note-body * { font-size: ... !important }`. */
const FontSize = Extension.create({
  name: "noteFontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) =>
              el.style.fontSize ? el.style.fontSize.replace(/\s*!important/i, "").trim() : null,
            renderHTML: (attrs: Record<string, any>) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize} !important` } : {},
          },
        },
      },
    ];
  },
});

const FS_KEY = "note-font-size";
const FS_MIN = 12;
const FS_MAX = 28;

export function useNoteFontSize() {
  const [size, setSize] = useState(16);
  useEffect(() => {
    const saved = Number(localStorage.getItem(FS_KEY));
    if (saved >= FS_MIN && saved <= FS_MAX) setSize(saved);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--note-fs", `${size}px`);
    localStorage.setItem(FS_KEY, String(size));
  }, [size]);
  return { size, setSize };
}

const COLORS = ["#111827", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  toolbarStickyClass?: string;
};

export function RichTextEditor({ value, onChange, toolbarStickyClass }: Props) {
  const [uploading, setUploading] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  async function insertFiles(files: File[]) {
    setUploading(true);
    try {
      for (const file of files) {
        const url = await uploadNoteImage(file);
        editorRef.current?.chain().focus().setImage({ src: url }).run();
      }
    } catch (e) {
      toast.error(T("Falha ao enviar a imagem"), {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setUploading(false);
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      NoteH1,
      NoteH2,
      NoteH3,
      Underline,
      TextStyle,
      FontSize,
      MultiRange,

      FontFamily.configure({ types: ["textStyle"] }),
      Color.configure({ types: ["textStyle"] }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "note-img" } }),
      Table.configure({ resizable: false, HTMLAttributes: { class: "note-table" } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "note-body max-w-none focus:outline-none min-h-[400px] p-6 bg-card rounded-b-xl",
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (!files.length) return false;
        event.preventDefault();
        void insertFiles(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        const files = Array.from(dt?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        void insertFiles(files);
        return true;
      },
    },
    immediatelyRender: false,
  });

  editorRef.current = editor;

  // Sync external value changes (switching notes)
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border border-border rounded-xl bg-card shadow-soft">
      <Toolbar
        editor={editor}
        stickyClass={toolbarStickyClass ?? "sticky top-16 z-30"}
        uploading={uploading}
        onPickImages={insertFiles}
      />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({
  editor,
  stickyClass,
  uploading,
  onPickImages,
}: {
  editor: Editor;
  stickyClass: string;
  uploading: boolean;
  onPickImages: (files: File[]) => void;
}) {
  const { size, setSize } = useNoteFontSize();
  const fileRef = useRef<HTMLInputElement>(null);
  const inTable = editor.isActive("table");

  const { from, to } = editor.state.selection;
  const extraRanges = getMultiRanges(editor);
  const hasSelection = from !== to || extraRanges.length > 0;
  const markSize = Number(
    String(editor.getAttributes("textStyle").fontSize ?? "").replace("px", ""),
  );
  const selectionSize = markSize >= FS_MIN && markSize <= FS_MAX ? markSize : size;

  function stepFontSize(delta: number) {
    if (hasSelection) {
      const next = Math.min(FS_MAX, Math.max(FS_MIN, selectionSize + delta));
      runOnRanges(editor, (c: any) => c.setMark("textStyle", { fontSize: `${next}px` }));
    } else {
      setSize(Math.min(FS_MAX, Math.max(FS_MIN, size + delta)));
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 p-2 border-b border-border rounded-t-xl bg-muted/40",
        stickyClass,
      )}
    >
      <Btn
        active={editor.isActive("italic")}
        onClick={() => runOnRanges(editor, (c: any) => c.toggleItalic())}
        label={T("Itálico")}
      >
        <Italic className="h-4 w-4" />
      </Btn>
      <Btn
        active={editor.isActive("underline")}
        onClick={() => runOnRanges(editor, (c: any) => c.toggleUnderline())}
        label={T("Sublinhado")}
      >
        <UnderlineIcon className="h-4 w-4" />
      </Btn>

      <Divider />

      <Btn
        active={editor.isActive("noteH1")}
        onClick={() => runOnRanges(editor, (c: any) => c.toggleNoteH1())}
        label={T("Título 1 (20px)")}
      >
        <span className="text-xs font-bold leading-none">T1</span>
      </Btn>
      <Btn
        active={editor.isActive("noteH2")}
        onClick={() => runOnRanges(editor, (c: any) => c.toggleNoteH2())}
        label={T("Título 2 (18px)")}
      >
        <span className="text-xs font-bold leading-none">T2</span>
      </Btn>
      <Btn
        active={editor.isActive("noteH3")}
        onClick={() => runOnRanges(editor, (c: any) => c.toggleNoteH3())}
        label={T("Título 3 (16px)")}
      >
        <span className="text-xs font-bold leading-none">T3</span>
      </Btn>

      <Divider />

      <Btn
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        label={T("Alinhar à esquerda")}
      >
        <AlignLeft className="h-4 w-4" />
      </Btn>
      <Btn
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        label={T("Centralizar")}
      >
        <AlignCenter className="h-4 w-4" />
      </Btn>
      <Btn
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        label={T("Alinhar à direita")}
      >
        <AlignRight className="h-4 w-4" />
      </Btn>
      <Btn
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        label={T("Justificar")}
      >
        <AlignJustify className="h-4 w-4" />
      </Btn>

      <Divider />

      <Btn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        label={T("Lista")}
      >
        <List className="h-4 w-4" />
      </Btn>
      <Btn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        label={T("Lista numerada")}
      >
        <ListOrdered className="h-4 w-4" />
      </Btn>
      <Btn
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        label={T("Citação")}
      >
        <Quote className="h-4 w-4" />
      </Btn>
      <Btn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        label={T("Linha horizontal")}
      >
        <Minus className="h-4 w-4" />
      </Btn>

      <Divider />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onPickImages(files);
          e.target.value = "";
        }}
      />
      <Btn onClick={() => fileRef.current?.click()} label={T("Inserir imagem")}>
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
      </Btn>
      <Btn
        active={inTable}
        onClick={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
        label={T("Inserir tabela")}
      >
        <TableIcon className="h-4 w-4" />
      </Btn>
      {inTable && (
        <>
          <Btn
            onClick={() => editor.chain().focus().addRowAfter().run()}
            label={T("Adicionar linha")}
          >
            <Rows3 className="h-4 w-4" />
          </Btn>
          <Btn onClick={() => editor.chain().focus().deleteRow().run()} label={T("Remover linha")}>
            <Rows3 className="h-4 w-4 opacity-50" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            label={T("Adicionar coluna")}
          >
            <Columns3 className="h-4 w-4" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().deleteColumn().run()}
            label={T("Remover coluna")}
          >
            <Columns3 className="h-4 w-4 opacity-50" />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().deleteTable().run()}
            label={T("Excluir tabela")}
          >
            <Trash2 className="h-4 w-4" />
          </Btn>
        </>
      )}

      <Divider />

      <div
        className="flex items-center gap-0.5"
        title={
          hasSelection
            ? T("Tamanho da fonte do trecho selecionado")
            : T("Tamanho da fonte de todo o texto")
        }
      >
        <Btn onClick={() => stepFontSize(-1)} label={T("Diminuir fonte")}>
          <AArrowDown className="h-4 w-4" />
        </Btn>
        <span className="text-xs text-muted-foreground w-7 text-center tabular-nums">
          {hasSelection ? selectionSize : size}
        </span>
        <Btn onClick={() => stepFontSize(1)} label={T("Aumentar fonte")}>
          <AArrowUp className="h-4 w-4" />
        </Btn>
      </div>

      <Divider />

      <div className="flex items-center gap-0.5" title={T("Cor do texto")}>
        <Type className="h-4 w-4 text-muted-foreground" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => runOnRanges(editor, (ch: any) => ch.setColor(c))}
            className="h-4 w-4 rounded-full border border-border"
            style={{ background: c }}
            aria-label={T("Cor {color}", { color: c })}
          />
        ))}
        <button
          type="button"
          onClick={() => runOnRanges(editor, (ch: any) => ch.unsetColor())}
          className="h-4 w-4 rounded-full border border-border bg-card text-[8px]"
          aria-label={T("Cor padrão")}
        >
          ×
        </button>
      </div>

      {extraRanges.length > 0 && (
        <button
          type="button"
          onClick={() => clearMultiRanges(editor)}
          className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary"
          title={T("Limpar seleção múltipla (Esc)")}
        >
          {T("{n} trechos ×", { n: extraRanges.length + 1 })}
        </button>
      )}

      <div className="flex-1" />

      <Btn onClick={() => editor.chain().focus().undo().run()} label={T("Desfazer")}>
        <Undo2 className="h-4 w-4" />
      </Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} label={T("Refazer")}>
        <Redo2 className="h-4 w-4" />
      </Btn>
    </div>
  );
}

function Btn({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "h-8 w-8 rounded-md flex items-center justify-center hover:bg-secondary transition",
        active && "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-6 w-px bg-border" />;
}
