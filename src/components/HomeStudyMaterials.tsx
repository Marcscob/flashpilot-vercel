import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clapperboard, FileText, Network } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { T } from "@/lib/i18n-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import {
  LANDING_MATERIALS_KEY as LANDING_KEY,
  readLandingMaterials as readLandingRequest,
  readLandingMaterialPreference,
  saveLandingMaterialPreference,
  readLandingVisitorHandoff,
  runLandingMaterials,
} from "@/lib/landing-materials";
import { claimLandingMaterials } from "@/lib/landing-draft.functions";
import { BulkV2Attachments, EMPTY_ATTACHMENTS } from "@/components/BulkV2Attachments";

const RESUME_KEY = "flashpilot:home-materials";
const DEFAULT_LANDING_MATERIALS = { note: true, map: true, video: true };
function Editor({
  initialText,
  initialTopicId = "",
}: {
  initialText: string;
  initialTopicId?: string;
}) {
  const [text, setText] = useState(initialText);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [attachments, setAttachments] = useState(EMPTY_ATTACHMENTS);
  const topics = useQuery({
    queryKey: ["home-material-topics"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return [];
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, created_at, subjects(name)")
        .eq("user_id", user.user.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="space-y-4">
      <Textarea
        aria-label={T("Texto-fonte")}
        maxLength={20_000}
        rows={7}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={T("Cole ou digite o conteúdo aqui…")}
      />
      <p className="text-xs text-muted-foreground">{T("Use entre 40 e 20.000 caracteres.")}</p>
      <Select
        value={topicId}
        onValueChange={(id) => {
          setTopicId(id);
          setAttachments(EMPTY_ATTACHMENTS);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={T("Escolha a matéria e o assunto de destino.")} />
        </SelectTrigger>
        <SelectContent>
          {topics.data?.map((topic) => (
            <SelectItem key={topic.id} value={topic.id}>
              {topic.subjects?.name} / {topic.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {topicId && (
        <BulkV2Attachments
          key={topicId}
          hideVideos
          value={attachments}
          onChange={setAttachments}
          targetTopicId={topicId}
          sourceText={text}
        />
      )}
    </div>
  );
}

export function HomeStudyMaterials({
  sourceText = "",
  variant = "standalone",
  landingActionId,
}: {
  sourceText?: string;
  variant?: "standalone" | "landing";
  landingActionId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [initialText, setInitialText] = useState("");
  const [initialTopicId, setInitialTopicId] = useState("");
  const [request, setRequest] = useState(DEFAULT_LANDING_MATERIALS);
  const [landingPreferencesLoaded, setLandingPreferencesLoaded] = useState(variant !== "landing");
  const touched = useRef(false);
  const qc = useQueryClient();
  const langCtx = useLang() as unknown as { lang?: string } | string;
  const uiLang = typeof langCtx === "string" ? langCtx : (langCtx?.lang ?? "pt-BR");
  useEffect(() => {
    if (variant !== "landing") return;
    setRequest(readLandingMaterialPreference());
    touched.current = true;
    setLandingPreferencesLoaded(true);
  }, [variant]);
  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSignedIn(!!data.session);
      if (!data.session) return;
      if (variant === "landing" || readLandingVisitorHandoff()) return;
      let landing = readLandingRequest();
      if (landingActionId) {
        const claimed = await claimLandingMaterials({ data: { actionId: landingActionId } }).catch(
          () => null,
        );
        if (claimed)
          landing = {
            text: claimed.content,
            note: claimed.note,
            map: claimed.map,
            video: false,
            at: Date.now(),
          };
      }
      if (landing) {
        localStorage.removeItem(LANDING_KEY);
        const id = toast.loading(T("Criando anotação e mapa mental dos seus flashcards…"));
        try {
          await runLandingMaterials(landing, uiLang);
          toast.success(T("Anotação e mapa mental anexados aos flashcards."), { id });
          void qc.invalidateQueries();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : T("Falha ao salvar"), { id });
        }
        return;
      }
      const pending = sessionStorage.getItem(RESUME_KEY);
      if (pending !== null) {
        setInitialText(pending);
        setOpen(true);
        sessionStorage.removeItem(RESUME_KEY);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);
  useEffect(() => {
    if (variant !== "landing") return;
    if (!landingPreferencesLoaded) return;
    if (!touched.current) return;
    saveLandingMaterialPreference(request);
    if (!request.note && !request.map && !request.video) {
      localStorage.removeItem(LANDING_KEY);
      return;
    }
    const prev = readLandingRequest();
    const text =
      sourceText.trim().length >= 40 ? sourceText.slice(0, 20_000) : (prev?.text ?? sourceText);
    localStorage.setItem(LANDING_KEY, JSON.stringify({ text, ...request, at: Date.now() }));
  }, [variant, request, sourceText, landingPreferencesLoaded]);
  function show() {
    setInitialText(sourceText);
    setInitialTopicId("");
    setOpen(true);
  }
  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{T("Materiais de estudo")}</DialogTitle>
        </DialogHeader>
        {signedIn ? (
          <Editor initialText={initialText} initialTopicId={initialTopicId} />
        ) : (
          <div className="space-y-4">
            <p>{T("Entre na sua conta para criar e guardar anotações e mapas com o PilotAI.")}</p>
            <Button asChild>
              <Link
                to="/auth"
                onClick={() => sessionStorage.setItem(RESUME_KEY, initialText.slice(0, 20_000))}
              >
                {T("Entrar")}
              </Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
  if (variant === "landing") {
    const toggle = (kind: "note" | "map" | "video") => {
      touched.current = true;
      setRequest((r) => ({ ...r, [kind]: !r[kind] }));
    };
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox checked={request.note} onCheckedChange={() => toggle("note")} />
            <FileText className="size-4" />
            {T("Criar anotação")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox checked={request.map} onCheckedChange={() => toggle("map")} />
            <Network className="size-4" />
            {T("Criar mapa mental")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox checked={request.video} onCheckedChange={() => toggle("video")} />
            <Clapperboard className="size-4" />
            {T("Criar microvídeo")}
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {T(
            "Os materiais selecionados (anotação, mapa mental e microvídeo) serão criados automaticamente pelo PilotAI e anexados aos flashcards.",
          )}
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="flex flex-wrap justify-center gap-3 py-4">
        <Button variant="outline" onClick={show}>
          <FileText />
          {T("Criar anotação")}
        </Button>
        <Button variant="outline" onClick={show}>
          <Network />
          {T("Criar mapa mental")}
        </Button>
      </div>
      {dialog}
    </>
  );
}
