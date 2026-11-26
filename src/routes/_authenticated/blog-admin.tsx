import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import {
  adminListPosts,
  adminGetPost,
  adminCreatePost,
  adminUpdatePost,
  adminDeletePost,
  adminListSubscribers,
  adminListComments,
  adminToggleComment,
  adminDeleteComment,
  adminGeneratePost,
  adminTranslatePost,
  adminGenerateCover,
  adminUploadCover,
  adminListCategories,
} from "@/lib/blog-admin.functions";
import {
  adminFacebookPreview,
  adminFacebookDistribute,
  type FacebookPreview,
  type FacebookDistributeResult,
} from "@/lib/blog-facebook.functions";
import {
  adminInstagramPreview,
  adminInstagramDistribute,
  adminUploadSocialCard,
  type InstagramPreview,
  type InstagramDistributeResult,
} from "@/lib/blog-instagram.functions";
import { renderSocialCardDataUrl } from "@/lib/social-card-generator";
import { ALL_LANGS } from "@/lib/lang-match";
import { BLOG_LANGS } from "@/lib/blog-langs";
import { useLang } from "@/lib/i18n";
import { T } from "@/lib/i18n-ui";
import { safeBlogSlug } from "@/lib/blog-slug";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Sparkles,
  Image as ImageIcon,
  ImagePlus,
  Languages,
  Trash2,
  Eye,
  EyeOff,
  Mail,
  MessageSquare,
  FileText,
  ArrowLeft,
  Star,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Quote,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Share2,
  Check,
  X,
  ExternalLink,
  Instagram,
  Download,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/blog-admin")({
  validateSearch: (s: Record<string, unknown>): { edit?: string; tab?: string } => ({
    edit: typeof s.edit === "string" ? s.edit : undefined,
    tab: typeof s.tab === "string" ? s.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Painel do Blog — FlashPilot" },
      { name: "description", content: "Gerenciar posts, inscritos e comentários do blog." },
      { property: "og:title", content: "Painel do Blog — FlashPilot" },
      { property: "og:description", content: "Gerenciar posts, inscritos e comentários do blog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BlogAdminPage,
});

const LANG_LABELS: Record<string, string> = Object.fromEntries(
  BLOG_LANGS.map((l) => [l.code, l.label]),
);

type Tab = "posts" | "new" | "subscribers" | "comments";

function toLocalDateTimeValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function isFlashPilotStoredCover(url: string): boolean {
  try {
    return new URL(url).pathname.includes("/storage/v1/object/sign/blog-covers/");
  } catch {
    return false;
  }
}

function BlogAdminPage() {
  const { edit, tab: tabQ } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(edit || tabQ === "new" ? "new" : "posts");
  const [editingId, setEditingId] = useState<string | null>(edit ?? null);

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">{T("Painel do blog")}</h1>
            <Link to="/blog" className="text-sm text-muted-foreground hover:text-amber-600">
              {T("Voltar ao blog")}
            </Link>
          </div>
          <Link
            to="/admin"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {T("Admin")}
          </Link>
        </div>

        <div className="mb-6 flex gap-2 border-b border-border">
          {(
            [
              ["posts", T("Todos os posts"), FileText],
              ["new", T("Novo post"), Plus],
              ["subscribers", T("Inscritos"), Mail],
              ["comments", T("Comentários"), MessageSquare],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                if (key !== "new") setEditingId(null);
              }}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === key
                  ? "border-amber-600 text-amber-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "posts" && (
          <PostsTab
            onEdit={(id) => {
              setEditingId(id);
              setTab("new");
            }}
          />
        )}
        {tab === "new" && (
          <PostEditor
            postId={editingId}
            onDone={() => {
              setEditingId(null);
              setTab("posts");
            }}
          />
        )}
        {tab === "subscribers" && <SubscribersTab />}
        {tab === "comments" && <CommentsTab />}
      </div>
    </div>
  );
}

/* =================== POSTS LIST =================== */
function PostsTab({ onEdit }: { onEdit: (id: string) => void }) {
  const listFn = useServerFn(adminListPosts);
  const deleteFn = useServerFn(adminDeletePost);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["blog-admin-posts"],
    queryFn: () => listFn({}),
    staleTime: 10_000,
    retry: false,
  });

  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (q.isError || !q.data)
    return <p className="text-sm text-muted-foreground">{T("Erro ao carregar.")}</p>;

  async function handleDelete(id: string) {
    if (!confirm(T("Você tem certeza?"))) return;
    try {
      await deleteFn({ data: { id } });
      toast.success(T("Post removido"));
      qc.invalidateQueries({ queryKey: ["blog-admin-posts"] });
    } catch {
      toast.error(T("Erro"));
    }
  }

  return (
    <div className="space-y-3">
      {(q.data as any[]).map((p) => (
        <div
          key={p.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          {p.cover_image_url ? (
            <img src={p.cover_image_url} alt="" className="h-12 w-16 rounded object-cover" />
          ) : (
            <div className="flex h-12 w-16 items-center justify-center rounded bg-muted">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
            <p className="text-xs text-muted-foreground">
              {p.status === "published" ||
              (p.status === "scheduled" &&
                p.published_at &&
                Date.parse(p.published_at) <= Date.now())
                ? T("Publicado")
                : p.status === "scheduled"
                  ? T("Agendado")
                  : T("Rascunho")}
              {p.featured ? " · ★" : ""}
              {p.published_at ? ` · ${new Date(p.published_at).toLocaleDateString()}` : ""}
            </p>
          </div>
          <button onClick={() => onEdit(p.id)} className="text-sm text-amber-600 hover:underline">
            {T("Editar")}
          </button>
          <button
            onClick={() => handleDelete(p.id)}
            className="text-muted-foreground hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {(q.data as any[]).length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{T("Nenhum post ainda")}</p>
      )}
    </div>
  );
}

/* =================== POST EDITOR (manual + IA) =================== */
type TranslationDraft = { lang: string; title: string; excerpt: string; body_html: string };

const BlogImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alignment: {
        default: "center",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-alignment") ?? "center",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-alignment": attributes.alignment,
        }),
      },
    };
  },
});

function BlogBodyEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const uploadImageFn = useServerFn(adminUploadCover);
  const editorRef = useRef<Editor | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  async function insertImages(files: File[], position?: number) {
    const editor = editorRef.current;
    if (!editor) return;

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    const maxBytes = 10 * 1024 * 1024;
    if (files.some((file) => !allowedTypes.has(file.type))) {
      toast.error(T("Formato de imagem não suportado. Use PNG, JPEG, WebP ou GIF."));
      return;
    }
    if (files.some((file) => file.size > maxBytes)) {
      toast.error(T("Cada imagem deve ter no máximo 10 MB."));
      return;
    }

    setUploadingImage(true);
    try {
      const imageNodes = await Promise.all(
        files.map(async (file) => {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          const result = await uploadImageFn({
            data: { base64, contentType: file.type },
          });
          return { type: "image" as const, attrs: { src: result.url } };
        }),
      );

      const insertAt = position ?? editor.state.selection.from;
      editor.chain().focus().insertContentAt(insertAt, imageNodes).run();
    } catch (error) {
      toast.error(T("Falha ao inserir imagem"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setUploadingImage(false);
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      BlogImage.configure({
        inline: false,
        allowBase64: false,
        resize: {
          enabled: true,
          directions: ["top-left", "top-right", "bottom-left", "bottom-right"],
          minWidth: 100,
          minHeight: 60,
          alwaysPreserveAspectRatio: true,
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
    editorProps: {
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData;
        const files = clipboard
          ? Array.from(clipboard.items)
              .filter((item) => item.kind === "file")
              .map((item) => item.getAsFile())
              .filter((file): file is File => file !== null && file.type.startsWith("image/"))
          : [];
        if (!files.length) return false;
        event.preventDefault();
        void insertImages(files, view.state.selection.from);
        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (!files.length) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        void insertImages(files, position);
        return true;
      },
    },
  });
  editorRef.current = editor;

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return <div className="min-h-64 animate-pulse rounded-lg bg-muted" />;

  const controls = [
    {
      label: "Negrito",
      icon: Bold,
      run: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive("bold"),
    },
    {
      label: "Itálico",
      icon: Italic,
      run: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive("italic"),
    },
    {
      label: "Título 2",
      icon: Heading2,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive("heading", { level: 2 }),
    },
    {
      label: "Título 3",
      icon: Heading3,
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive("heading", { level: 3 }),
    },
    {
      label: "Lista com marcadores",
      icon: List,
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
    },
    {
      label: "Lista numerada",
      icon: ListOrdered,
      run: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
    },
    {
      label: "Citação",
      icon: Quote,
      run: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive("blockquote"),
    },
    {
      label: "Desfazer",
      icon: Undo2,
      run: () => editor.chain().focus().undo().run(),
      active: false,
    },
    {
      label: "Refazer",
      icon: Redo2,
      run: () => editor.chain().focus().redo().run(),
      active: false,
    },
  ];
  const imageAlignment = editor.getAttributes("image").alignment ?? "center";
  const alignmentControls = [
    { alignment: "left", label: "Alinhar imagem à esquerda", icon: AlignLeft },
    { alignment: "center", label: "Centralizar imagem", icon: AlignCenter },
    { alignment: "right", label: "Alinhar imagem à direita", icon: AlignRight },
  ] as const;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div
        className="flex flex-wrap gap-1 border-b border-border p-2"
        role="toolbar"
        aria-label={T("Formatação do texto")}
      >
        {controls.map(({ label, icon: Icon, run, active }) => (
          <button
            key={label}
            type="button"
            title={T(label)}
            aria-label={T(label)}
            aria-pressed={active}
            onClick={run}
            className={`rounded p-2 hover:bg-muted ${active ? "bg-muted text-amber-700" : "text-muted-foreground"}`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <span className="mx-1 h-6 w-px self-center bg-border" aria-hidden="true" />
        {alignmentControls.map(({ alignment, label, icon: Icon }) => (
          <button
            key={alignment}
            type="button"
            title={T(label)}
            aria-label={T(label)}
            aria-pressed={editor.isActive("image") && imageAlignment === alignment}
            disabled={!editor.isActive("image")}
            onClick={() => editor.chain().focus().updateAttributes("image", { alignment }).run()}
            className={`rounded p-2 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 ${
              editor.isActive("image") && imageAlignment === alignment
                ? "bg-muted text-amber-700"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) void insertImages(files);
          }}
        />
        <button
          type="button"
          title={uploadingImage ? T("Enviando imagem…") : T("Inserir imagem")}
          aria-label={uploadingImage ? T("Enviando imagem…") : T("Inserir imagem")}
          disabled={uploadingImage}
          onClick={() => imageInputRef.current?.click()}
          className="rounded p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {uploadingImage ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
        </button>
      </div>
      <EditorContent
        editor={editor}
        className="blog-editor-content min-h-64 px-4 py-3 text-sm text-foreground"
      />
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {T(
          "Arraste uma imagem para reposicioná-la. Selecione-a para alinhar; arraste um dos cantos para redimensionar.",
        )}
      </p>
    </div>
  );
}

function PostEditor({ postId, onDone }: { postId: string | null; onDone: () => void }) {
  const { lang } = useLang();
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetPost);
  const createFn = useServerFn(adminCreatePost);
  const updateFn = useServerFn(adminUpdatePost);
  const generateFn = useServerFn(adminGeneratePost);
  const translateFn = useServerFn(adminTranslatePost);
  const coverFn = useServerFn(adminGenerateCover);
  const uploadCoverFn = useServerFn(adminUploadCover);

  const catFn = useServerFn(adminListCategories);

  const editingQ = useQuery({
    queryKey: ["blog-admin-post", postId],
    queryFn: () => getFn({ data: { id: postId! } }),
    enabled: !!postId,
    retry: false,
  });
  const catQ = useQuery({ queryKey: ["blog-cats"], queryFn: () => catFn({}), retry: false });

  const [slug, setSlug] = useState("post");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverLinkInput, setCoverLinkInput] = useState("");
  const [coverSource, setCoverSource] = useState<"stored" | "external" | null>(null);
  const [coverImageWidth, setCoverImageWidth] = useState(100);
  const [categoryId, setCategoryId] = useState("");
  const [featured, setFeatured] = useState(false);
  const [status, setStatus] = useState("draft");
  const [publishedAt, setPublishedAt] = useState("");
  const [baseLang, setBaseLang] = useState<string>(lang);
  const [activeLang, setActiveLang] = useState<string>(lang);
  const [translations, setTranslations] = useState<Record<string, TranslationDraft>>({});
  const [aiTopic, setAiTopic] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const minScheduleAt = toLocalDateTimeValue(new Date(Date.now() + 60_000));

  useEffect(() => {
    if (!postId) setSlug(`post-${crypto.randomUUID()}`);
  }, [postId]);

  // Load editing data quando a consulta retorna
  useEffect(() => {
    if (!editingQ.data) return;
    const d = editingQ.data as any;
    setSlug(safeBlogSlug(d.post?.slug ?? "", `post-${postId}`));
    const savedCoverUrl = d.post?.cover_image_url ?? "";
    setCoverUrl(savedCoverUrl);
    setCoverSource(
      savedCoverUrl ? (isFlashPilotStoredCover(savedCoverUrl) ? "stored" : "external") : null,
    );
    setCoverLinkInput(
      savedCoverUrl && !isFlashPilotStoredCover(savedCoverUrl) ? savedCoverUrl : "",
    );
    setCoverImageWidth(d.post?.cover_image_width ?? 100);
    setCategoryId(d.post?.category_id ?? "");
    setFeatured(d.post?.featured ?? false);
    setStatus(d.post?.status ?? "draft");
    const publishDate = d.post?.published_at ? new Date(d.post.published_at) : null;
    if (publishDate && Number.isFinite(publishDate.getTime())) {
      const localDate = new Date(publishDate.getTime() - publishDate.getTimezoneOffset() * 60_000);
      setPublishedAt(localDate.toISOString().slice(0, 16));
    } else {
      setPublishedAt("");
    }
    const tr: Record<string, TranslationDraft> = {};
    for (const t of d.translations ?? []) {
      tr[t.lang] = {
        lang: t.lang,
        title: t.title ?? "",
        excerpt: t.excerpt ?? "",
        body_html: t.body_html ?? "",
      };
    }
    setTranslations(tr);
    const preferredLang =
      tr[lang]?.body_html || tr[lang]?.title
        ? lang
        : (ALL_LANGS.find((candidate) => tr[candidate]?.body_html || tr[candidate]?.title) ?? lang);
    setBaseLang(preferredLang);
    setActiveLang(preferredLang);
  }, [editingQ.data, lang]);

  const current = translations[activeLang] ?? {
    lang: activeLang,
    title: "",
    excerpt: "",
    body_html: "",
  };

  function setField(field: keyof TranslationDraft, value: string) {
    setTranslations((prev) => ({
      ...prev,
      [activeLang]: { ...(prev[activeLang] ?? current), [field]: value },
    }));
  }

  async function handleGenerateAI() {
    if (!aiTopic.trim()) return;
    setBusy("gen");
    try {
      const res = await generateFn({ data: { topic: aiTopic, source_lang: baseLang } });
      setTranslations((prev) => ({
        ...prev,
        [baseLang]: {
          lang: baseLang,
          title: res.title,
          excerpt: res.excerpt,
          body_html: res.body_html,
        },
      }));
      setActiveLang(baseLang);
      setSlug(safeBlogSlug(aiTopic, `post-${crypto.randomUUID()}`));
      toast.success(T("Texto gerado com sucesso!"));
    } catch (e) {
      toast.error(T("Erro ao gerar. Tente novamente."));
    }
    setBusy(null);
  }

  const [trProgress, setTrProgress] = useState<{ done: number; total: number } | null>(null);
  async function handleTranslateAll() {
    const base = translations[baseLang];
    if (!base?.body_html) {
      toast.error(T("Escreva ou gere o texto no idioma base primeiro."));
      return;
    }
    setBusy("tr-all");
    try {
      // Fatiado: uma chamada por idioma, 3 por vez, para nunca estourar o tempo limite.
      const targets = BLOG_LANGS.map((l) => l.code).filter(
        (c) => c !== baseLang && !translations[c]?.body_html,
      );
      const res = { failed: [] as string[] };
      let done = 0;
      let next = 0;
      setTrProgress({ done, total: targets.length });
      const worker = async () => {
        while (next < targets.length) {
          const target = targets[next++]!;
          let ok = false;
          for (let attempt = 0; attempt < 3 && !ok; attempt++) {
            try {
              if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
              const t = await translateFn({
                data: {
                  title: base.title,
                  excerpt: base.excerpt,
                  body_html: base.body_html,
                  target_lang: target,
                  source_lang: baseLang,
                },
              });
              setTranslations((prev) => ({
                ...prev,
                [target]: {
                  lang: target,
                  title: t.title,
                  excerpt: t.excerpt,
                  body_html: t.body_html,
                },
              }));
              ok = true;
            } catch {
              /* tenta de novo */
            }
          }
          if (!ok) res.failed.push(target);
          done += 1;
          setTrProgress({ done, total: targets.length });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      setTrProgress(null);
      if (!targets.length) toast.success(T("Tradução concluída!"));
      else if (res.failed.length) {
        const failedLabels = res.failed.map((lang) => LANG_LABELS[lang] ?? lang).join(", ");
        toast.warning(`${T("Alguns idiomas falharam. Tente novamente.")} (${failedLabels})`);
      } else toast.success(T("Tradução concluída!"));
    } catch {
      toast.error(T("Erro ao gerar. Tente novamente."));
    }
    setBusy(null);
  }

  async function handleTranslate(targetLang: string) {
    const base = translations[baseLang];
    if (!base?.body_html) return;
    setBusy("tr-" + targetLang);
    try {
      const res = await translateFn({
        data: {
          title: base.title,
          excerpt: base.excerpt,
          body_html: base.body_html,
          target_lang: targetLang,
          source_lang: baseLang,
        },
      });
      setTranslations((prev) => ({
        ...prev,
        [targetLang]: {
          lang: targetLang,
          title: res.title,
          excerpt: res.excerpt,
          body_html: res.body_html,
        },
      }));
      toast.success(T("Tradução concluída!"));
    } catch {
      toast.error(T("Erro ao gerar. Tente novamente."));
    }
    setBusy(null);
  }

  async function handleUploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("upload");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const res = await uploadCoverFn({ data: { base64, contentType: file.type || "image/png" } });
      setCoverUrl(res.url);
      setCoverLinkInput("");
      setCoverSource("stored");
      toast.success(T("Imagem carregada com sucesso."));
    } catch {
      toast.error(T("Erro ao gerar. Tente novamente."));
    }
    setBusy(null);
  }

  async function handleGenerateCover() {
    const topic =
      translations[baseLang]?.title ||
      translations["pt"]?.title ||
      translations["en"]?.title ||
      aiTopic;
    if (!topic) return;
    setBusy("cover");
    try {
      const res = await coverFn({ data: { topic } });
      setCoverUrl(res.url);
      setCoverLinkInput("");
      setCoverSource("stored");
      toast.success(T("Imagem gerada!"));
    } catch {
      toast.error(T("Erro ao gerar. Tente novamente."));
    }
    setBusy(null);
  }

  async function handleSave(publish = false) {
    const trList = Object.values(translations).filter((t) => t.title || t.body_html);
    if (!trList.length) {
      toast.error(T("Adicione pelo menos título e conteúdo."));
      return;
    }
    const finalSlug = safeBlogSlug(
      slug,
      translations[baseLang]?.title || `post-${postId ?? crypto.randomUUID()}`,
    );
    setSlug(finalSlug);
    setBusy("save");
    try {
      const finalStatus = publish ? "published" : status;
      let failedTranslations: string[] = [];
      if (postId) {
        const result = await updateFn({
          data: {
            id: postId,
            source_lang: baseLang,
            slug: finalSlug,
            cover_image_url: coverUrl || null,
            cover_image_width: coverImageWidth,
            category_id: categoryId || null,
            featured,
            status: finalStatus as any,
            ...(finalStatus === "scheduled" && publishedAt
              ? { published_at: new Date(publishedAt).toISOString() }
              : {}),
            translations: trList.map((t) => ({
              lang: t.lang,
              title: t.title,
              excerpt: t.excerpt,
              body_html: t.body_html,
            })),
          },
        });
        failedTranslations = result.failedTranslations;
      } else {
        const result = await createFn({
          data: {
            source_lang: baseLang,
            slug: finalSlug,
            cover_image_url: coverUrl || null,
            cover_image_width: coverImageWidth,
            category_id: categoryId || null,
            featured,
            status: finalStatus as any,
            ...(finalStatus === "scheduled" && publishedAt
              ? { published_at: new Date(publishedAt).toISOString() }
              : {}),
            translations: trList.map((t) => ({
              lang: t.lang,
              title: t.title,
              excerpt: t.excerpt,
              body_html: t.body_html,
            })),
          },
        });
        failedTranslations = result.failedTranslations;
      }
      if (failedTranslations.length) {
        toast.warning(T("Post salvo, mas algumas traduções não foram geradas."), {
          description: failedTranslations
            .map((failedLang) => LANG_LABELS[failedLang] ?? failedLang)
            .join(", "),
        });
      } else {
        toast.success(T(postId ? "Post atualizado" : "Post criado"));
      }
      qc.invalidateQueries({ queryKey: ["blog-admin-posts"] });
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? T("Erro"));
    }
    setBusy(null);
  }

  if (postId && editingQ.isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {T("Carregando…")}
      </div>
    );
  }
  if (postId && (editingQ.isError || !editingQ.data)) {
    return (
      <div className="space-y-3 py-8 text-sm text-destructive">
        <p>{T("Não foi possível carregar este post.")}</p>
        <button onClick={onDone} className="text-amber-600 hover:underline">
          {T("Voltar aos posts")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* PilotAI generation */}
      <div className="rounded-xl border border-amber-300/40 bg-amber-50/50 p-4 dark:bg-amber-900/10">
        <h3 className="mb-2 flex items-center gap-2 font-serif font-semibold text-amber-700 dark:text-amber-400">
          <Sparkles className="h-4 w-4" /> {T("Gerar com o PilotAI")}
        </h3>
        <div className="mb-2 flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">{T("Idioma base")}</label>
          <select
            value={baseLang}
            onChange={(e) => {
              setBaseLang(e.target.value);
              setActiveLang(e.target.value);
            }}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
          >
            {ALL_LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_LABELS[l] ?? l}
              </option>
            ))}
          </select>
          {status === "scheduled" && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              {T("Data e hora de publicação")}
              <input
                type="datetime-local"
                value={publishedAt}
                min={minScheduleAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder={T("Assunto do post")}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            onClick={handleGenerateAI}
            disabled={busy === "gen"}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy === "gen" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {busy === "gen" ? T("Gerando...") : T("Gerar com o PilotAI")}
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={handleTranslateAll}
            disabled={busy === "tr-all"}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500 bg-amber-100/60 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200/60 disabled:opacity-50 dark:bg-amber-900/20 dark:text-amber-300"
          >
            {busy === "tr-all" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Languages className="h-3.5 w-3.5" />
            )}
            {busy === "tr-all"
              ? `${T("Traduzindo...")}${trProgress ? ` ${trProgress.done}/${trProgress.total}` : ""}`
              : T("Traduzir para todos os idiomas")}
          </button>
        </div>
      </div>

      {/* Language tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {BLOG_LANGS.map(({ code: l }) => (
          <button
            key={l}
            onClick={() => setActiveLang(l)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${
              activeLang === l
                ? "border-amber-600 text-amber-600"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {LANG_LABELS[l] ?? l}
            {translations[l] ? " ✓" : ""}
          </button>
        ))}
        {activeLang !== baseLang && translations[baseLang]?.body_html && (
          <button
            onClick={() => handleTranslate(activeLang)}
            disabled={busy === "tr-" + activeLang}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:underline disabled:opacity-50"
          >
            {busy === "tr-" + activeLang ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Languages className="h-3 w-3" />
            )}
            {T("Traduzir com o PilotAI")}
          </button>
        )}
      </div>

      {/* Fields */}
      <div className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="blog-post-slug"
              className="mb-1 block text-xs font-medium text-muted-foreground"
            >
              {T("Slug")}
            </label>
            <input
              id="blog-post-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onBlur={(e) =>
                setSlug(
                  safeBlogSlug(
                    e.target.value,
                    translations[baseLang]?.title || `post-${postId ?? crypto.randomUUID()}`,
                  ),
                )
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {T("Categoria")}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {((catQ.data as any[]) ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.slug}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ImageIcon className="h-4 w-4 text-amber-600" /> {T("Imagem de capa")}
          </h4>
          <p className="mb-3 text-xs text-muted-foreground">
            {T(
              "Cole o endereço de uma imagem da internet, envie uma foto do computador ou gere com o PilotAI.",
            )}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                1. {T("Usar imagem por link externo")}
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  value={coverLinkInput}
                  onChange={(e) => setCoverLinkInput(e.target.value)}
                  placeholder={T("https://exemplo.com/imagem.jpg")}
                  className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const candidate = coverLinkInput.trim();
                    try {
                      const parsed = new URL(candidate);
                      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
                        throw new Error("unsupported protocol");
                      }
                      setCoverUrl(candidate);
                      setCoverSource("external");
                    } catch {
                      toast.error(
                        T(
                          "Informe um endereço de imagem válido começando com http:// ou https://.",
                        ),
                      );
                    }
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-amber-400"
                >
                  {T("Usar este link")}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                2. {T("Selecionar do computador")}
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium hover:border-amber-400">
                {busy === "upload" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {busy === "upload" ? T("Enviando…") : T("Selecionar do computador")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadCover}
                />
              </label>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                3. {T("Gerar com o PilotAI")}
              </label>
              <button
                type="button"
                onClick={handleGenerateCover}
                disabled={busy === "cover"}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-stone-800"
              >
                {busy === "cover" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {T("Gerar com o PilotAI")}
              </button>
            </div>
          </div>

          {coverUrl && (
            <div className="mt-3 rounded-lg bg-muted/40 p-3">
              <p className="mb-3 text-xs text-muted-foreground">
                {coverSource === "stored"
                  ? T(
                      "Esta imagem foi enviada ou gerada e está armazenada no FlashPilot. O endereço interno abaixo da imagem não precisa ser copiado.",
                    )
                  : T("Esta capa usa o link externo selecionado.")}
              </p>
              <img
                src={coverUrl}
                alt=""
                className="mx-auto h-auto max-w-full rounded-lg"
                style={{ width: `${coverImageWidth}%` }}
              />
              <label className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="shrink-0">{T("Largura da capa")}</span>
                <input
                  type="range"
                  min={25}
                  max={100}
                  step={1}
                  value={coverImageWidth}
                  onChange={(event) => setCoverImageWidth(Number(event.target.value))}
                  className="w-full accent-amber-600"
                  aria-label={T("Largura da capa")}
                />
                <span className="w-10 text-right tabular-nums">{coverImageWidth}%</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setCoverUrl("");
                  setCoverLinkInput("");
                  setCoverSource(null);
                }}
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" /> {T("Remover imagem")}
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {T("Título")} ({LANG_LABELS[activeLang]})
          </label>
          <input
            value={current.title}
            onChange={(e) => setField("title", e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {T("Resumo")}
          </label>
          <textarea
            value={current.excerpt}
            onChange={(e) => setField("excerpt", e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {T("Conteúdo")}
          </label>
          <BlogBodyEditor
            value={current.body_html}
            onChange={(html) => setField("body_html", html)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
            />
            {T("Destaque")}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="draft">{T("Rascunho")}</option>
            <option value="published">{T("Publicado")}</option>
            <option value="scheduled">{T("Agendado")}</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={busy === "save"}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-amber-400 disabled:opacity-50"
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy === "save" ? T("Salvando…") : T("Salvar")}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={busy === "save"}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {T("Publicar")}
          </button>
          <button
            onClick={onDone}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground"
          >
            {T("Cancelar")}
          </button>
        </div>

        {postId ? (
          <SocialDistribution postId={postId} coverUrl={coverUrl} />
        ) : (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            {T("Salve o post primeiro para distribuir nas redes sociais.")}
          </p>
        )}
      </div>
    </div>
  );
}

/* =================== SOCIAL DISTRIBUTION HUB =================== */
function SocialDistribution({ postId, coverUrl }: { postId: string; coverUrl?: string | null }) {
  const [activeNetwork, setActiveNetwork] = useState<"facebook" | "instagram">("facebook");

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Share2 className="h-4 w-4 text-amber-600" />
            {T("Distribuição Multilíngue nas Redes Sociais")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {T("Publique em 8 destinos regionais segmentados por idioma e cultura.")}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30">
          <button
            type="button"
            onClick={() => setActiveNetwork("facebook")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeNetwork === "facebook"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Share2 className="h-3.5 w-3.5" />
            Facebook (8 páginas)
          </button>
          <button
            type="button"
            onClick={() => setActiveNetwork("instagram")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition ${
              activeNetwork === "instagram"
                ? "bg-pink-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Instagram className="h-3.5 w-3.5" />
            Instagram (8 contas + Cards)
          </button>
        </div>
      </div>

      {activeNetwork === "facebook" ? (
        <FacebookDistribution postId={postId} />
      ) : (
        <InstagramDistribution postId={postId} coverUrl={coverUrl} />
      )}
    </section>
  );
}

/* =================== INSTAGRAM DISTRIBUTION =================== */
function InstagramDistribution({
  postId,
  coverUrl,
}: {
  postId: string;
  coverUrl?: string | null;
}) {
  const previewFn = useServerFn(adminInstagramPreview);
  const distributeFn = useServerFn(adminInstagramDistribute);
  const uploadCardFn = useServerFn(adminUploadSocialCard);

  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState<InstagramDistributeResult[] | null>(null);
  const [cards, setCards] = useState<
    Record<string, { dataUrl: string; publicUrl?: string; generating?: boolean }>
  >({});

  const q = useQuery({
    queryKey: ["blog-ig-preview", postId],
    queryFn: () => previewFn({ data: { postId } }),
    staleTime: 10_000,
    retry: false,
  });
  const previews = (q.data ?? []) as InstagramPreview[];

  const checked =
    selected ??
    new Set(
      previews
        .filter((p) => p.hasContent && p.configured && (p.hasImage || Boolean(coverUrl)))
        .map((p) => p.key),
    );
  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleGenerateCard = async (p: InstagramPreview) => {
    setCards((prev) => ({
      ...prev,
      [p.key]: {
        dataUrl: prev[p.key]?.dataUrl ?? "",
        generating: true,
      },
    }));
    try {
      const dataUrl = await renderSocialCardDataUrl({
        coverUrl: coverUrl ?? p.coverUrl,
        title: p.title,
        subtitle: p.excerpt,
        accountHandle: `@${p.accountName}`,
      });
      const { publicUrl } = await uploadCardFn({
        data: {
          base64Image: dataUrl,
          accountKey: p.key,
          postId,
        },
      });
      setCards((prev) => ({
        ...prev,
        [p.key]: { dataUrl, publicUrl, generating: false },
      }));
      toast.success(T(`Card gerado para @${p.accountName}`));
    } catch (e: any) {
      toast.error(e.message ?? T("Erro ao gerar card."));
      setCards((prev) => ({
        ...prev,
        [p.key]: {
          dataUrl: prev[p.key]?.dataUrl ?? "",
          generating: false,
        },
      }));
    }
  };

  const handleDistribute = async () => {
    const accounts = [...checked];
    if (!accounts.length) {
      toast.error(T("Selecione ao menos uma conta."));
      return;
    }
    setPosting(true);
    setResults(null);
    try {
      const customImageUrls: Record<string, string> = {};
      for (const key of accounts) {
        if (cards[key]?.publicUrl) {
          customImageUrls[key] = cards[key].publicUrl!;
        }
      }

      const out = await distributeFn({
        data: {
          postId,
          accounts: accounts as any,
          customImageUrls: Object.keys(customImageUrls).length ? customImageUrls : undefined,
        },
      });
      setResults(out);
      if (out.every((r) => r.ok)) toast.success(T("Publicado no Instagram"));
      else toast.error(T("Falha em publicações do Instagram."));
    } catch {
      toast.error(T("Falha ao publicar no Instagram."));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Instagram className="h-4 w-4 text-pink-600" /> {T("Contas do Instagram")}
        </h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {T(
            "Selecione as contas desejadas. Você pode usar a capa do post ou gerar um card 1080x1080 com o título sobreposto e marca d'água.",
          )}
        </p>
      </div>

      {q.isLoading ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="space-y-2.5">
          {previews.map((p) => {
            const hasImage = Boolean(cards[p.key]?.publicUrl || p.coverUrl || coverUrl);
            const disabled = !p.hasContent || !p.configured || !hasImage;
            const card = cards[p.key];

            return (
              <div key={p.key} className="rounded-lg border border-border p-3 space-y-2 bg-background/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked.has(p.key)}
                      disabled={disabled || posting}
                      onChange={() => toggle(p.key)}
                      className="h-4 w-4 accent-pink-600"
                    />
                    <span className="font-medium text-foreground">@{p.accountName}</span>
                    {p.lang ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {p.lang}
                      </span>
                    ) : null}
                    {!p.configured ? (
                      <span className="text-[10px] text-red-600">
                        {T("Página sem token/ID")}
                      </span>
                    ) : null}
                    {p.configured && !p.hasContent ? (
                      <span className="text-[10px] text-red-600">{T("Sem resumo neste idioma")}</span>
                    ) : null}
                    {p.configured && p.hasContent && !hasImage ? (
                      <span className="text-[10px] text-amber-600">
                        {T("Requer capa ou card")}
                      </span>
                    ) : null}
                  </label>

                  {p.hasContent ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleGenerateCard(p)}
                        disabled={card?.generating}
                        className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {card?.generating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="h-3 w-3 text-amber-500" />
                        )}
                        {card?.dataUrl ? T("Regerar Card") : T("Gerar Card com Texto")}
                      </button>
                      {card?.dataUrl ? (
                        <a
                          href={card.dataUrl}
                          download={`card-${p.accountName}-${p.lang ?? "post"}.jpg`}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                          title={T("Baixar Card")}
                        >
                          <Download className="h-3 w-3" />
                          {T("Baixar")}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {card?.dataUrl ? (
                  <div className="flex items-start gap-3 rounded bg-muted/40 p-2">
                    <img
                      src={card.dataUrl}
                      alt={`Card @${p.accountName}`}
                      className="h-20 w-20 rounded object-cover shadow border border-border shrink-0"
                    />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-semibold text-foreground text-[11px] flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600" />{" "}
                        {T("Card com texto sobreposto pronto")}
                      </p>
                      <p className="text-[11px]">
                        {T(
                          "Este card 1080x1080 será enviado na publicação do Instagram com alto contraste e tipografia elegante.",
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}

                {p.hasContent ? (
                  <p className="line-clamp-2 pl-6 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">{T("Legenda")}:</span>{" "}
                    {p.caption.replace(/\n+/g, " ")}
                  </p>
                ) : null}
              </div>
            );
          })}

          <button
            onClick={handleDistribute}
            disabled={posting || !previews.length}
            className="flex items-center gap-1.5 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700 disabled:opacity-50"
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
            {posting ? T("Publicando…") : T("Publicar no Instagram")}
          </button>

          {results?.map((r) => (
            <div
              key={r.key}
              className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs ${
                r.ok ? "border-green-500/40 text-green-700" : "border-red-500/40 text-red-600"
              }`}
            >
              {r.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              <span className="font-medium">@{r.accountName}</span>
              {r.ok && r.instagramUrl ? (
                <a
                  href={r.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  {T("Ver no Instagram")} <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {!r.ok && r.error ? <span className="text-muted-foreground">{r.error}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =================== FACEBOOK DISTRIBUTION =================== */
function FacebookDistribution({ postId }: { postId: string }) {
  const previewFn = useServerFn(adminFacebookPreview);
  const distributeFn = useServerFn(adminFacebookDistribute);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [posting, setPosting] = useState(false);
  const [results, setResults] = useState<FacebookDistributeResult[] | null>(null);

  const q = useQuery({
    queryKey: ["blog-fb-preview", postId],
    queryFn: () => previewFn({ data: { postId } }),
    staleTime: 10_000,
    retry: false,
  });
  const previews = (q.data ?? []) as FacebookPreview[];

  // primeira carga: marca as páginas aptas (com conteúdo e token)
  const checked =
    selected ?? new Set(previews.filter((p) => p.hasContent && p.configured).map((p) => p.key));
  const toggle = (key: string) => {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  const handleDistribute = async () => {
    const pages = [...checked];
    if (!pages.length) {
      toast.error(T("Selecione ao menos uma página."));
      return;
    }
    setPosting(true);
    setResults(null);
    try {
      const out = await distributeFn({ data: { postId, pages: pages as any } });
      setResults(out);
      if (out.every((r) => r.ok)) toast.success(T("Publicado"));
      else toast.error(T("Falha ao publicar no Facebook."));
    } catch {
      toast.error(T("Falha ao publicar no Facebook."));
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Share2 className="h-4 w-4 text-amber-600" /> {T("Distribuir no Facebook")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {T(
          "Marque as páginas em que o post será publicado. O texto começa com flashpilot.net, seguido do resumo no idioma da página e do link do artigo.",
        )}
      </p>

      {q.isLoading ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="mt-3 space-y-2">
          {previews.map((p) => {
            const disabled = !p.hasContent || !p.configured;
            return (
              <div key={p.key} className="rounded-lg border border-border p-3">
                <label
                  className={`flex items-center gap-2 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(p.key)}
                    disabled={disabled || posting}
                    onChange={() => toggle(p.key)}
                    className="h-4 w-4 accent-amber-600"
                  />
                  <span className="font-medium text-foreground">{p.pageName}</span>
                  {p.lang ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {p.lang}
                    </span>
                  ) : null}
                  {!p.configured ? (
                    <span className="text-[10px] text-red-600">
                      {T("Página sem token configurado")}
                    </span>
                  ) : null}
                  {p.configured && !p.hasContent ? (
                    <span className="text-[10px] text-red-600">{T("Sem resumo neste idioma")}</span>
                  ) : null}
                </label>
                {p.hasContent ? (
                  <p className="mt-1.5 line-clamp-2 pl-6 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/70">{T("Prévia")}:</span>{" "}
                    {p.message} · {p.url}
                  </p>
                ) : null}
              </div>
            );
          })}

          <button
            onClick={handleDistribute}
            disabled={posting || !previews.length}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {posting ? T("Publicando…") : T("Publicar no Facebook")}
          </button>

          {results?.map((r) => (
            <div
              key={r.key}
              className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs ${r.ok ? "border-green-500/40 text-green-700" : "border-red-500/40 text-red-600"}`}
            >
              {r.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              <span className="font-medium">{r.pageName}</span>
              {r.ok && r.facebookUrl ? (
                <a
                  href={r.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline"
                >
                  {T("Ver publicação")} <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
              {!r.ok && r.error ? <span className="text-muted-foreground">{r.error}</span> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* =================== SUBSCRIBERS =================== */
function SubscribersTab() {
  const fn = useServerFn(adminListSubscribers);
  const q = useQuery({
    queryKey: ["blog-subs"],
    queryFn: () => fn({}),
    staleTime: 10_000,
    retry: false,
  });
  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">{T("Erro")}</p>;
  return (
    <div className="space-y-2">
      {(q.data as any[]).map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
        >
          <div>
            <p className="text-sm font-medium text-foreground">{s.email}</p>
            <p className="text-xs text-muted-foreground">
              {s.name ?? "—"} · {s.lang}
            </p>
          </div>
          <span className={`text-xs ${s.confirmed_at ? "text-green-600" : "text-amber-600"}`}>
            {s.confirmed_at ? T("Confirmado") : T("Não confirmado")}
          </span>
        </div>
      ))}
      {(q.data as any[]).length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{T("Nenhum inscrito")}</p>
      )}
    </div>
  );
}

/* =================== COMMENTS MODERATION =================== */
function CommentsTab() {
  const fn = useServerFn(adminListComments);
  const toggleFn = useServerFn(adminToggleComment);
  const deleteFn = useServerFn(adminDeleteComment);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["blog-comments"],
    queryFn: () => fn({}),
    staleTime: 10_000,
    retry: false,
  });

  if (q.isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (q.isError || !q.data) return <p className="text-sm text-muted-foreground">{T("Erro")}</p>;

  async function handleToggle(id: string, hidden: boolean) {
    await toggleFn({ data: { id, hidden: !hidden } });
    qc.invalidateQueries({ queryKey: ["blog-comments"] });
  }
  async function handleDelete(id: string) {
    if (!confirm(T("Você tem certeza?"))) return;
    await deleteFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["blog-comments"] });
  }

  return (
    <div className="space-y-2">
      {(q.data as any[]).map((c) => (
        <div key={c.id} className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">{c.body}</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleToggle(c.id, c.hidden)}
                className="text-muted-foreground hover:text-amber-600"
              >
                {c.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(c.created_at).toLocaleDateString()} · {c.hidden ? T("Ocultar") : T("Mostrar")}
          </p>
        </div>
      ))}
      {(q.data as any[]).length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{T("Nenhum comentário")}</p>
      )}
    </div>
  );
}
