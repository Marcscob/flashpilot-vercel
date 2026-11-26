import { useState, useEffect, useCallback } from "react";
import { useBlogUi } from "@/lib/blog-ui-i18n";
import { blogAddComment, blogDeleteComment, listBlogComments } from "@/lib/blog.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Trash2, Loader2, Send } from "lucide-react";

type Comment = { id: string; body: string; created_at: string; author_name: string };

export function CommentsSection({ postId, lang }: { postId: string; lang: string }) {
  const { t } = useBlogUi(lang);
  const addComment = useServerFn(blogAddComment);
  const deleteComment = useServerFn(blogDeleteComment);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    const res = await listBlogComments({ data: { postId } });
    setComments(res as Comment[]);
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    loadComments();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setSignedIn(true);
        setMyUserId(data.user.id);
      }
    });
  }, [loadComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await addComment({ data: { postId, body } });
      setBody("");
      await loadComments();
    } catch {
      // ignore
    }
    setSubmitting(false);
  }

  async function handleDelete(commentId: string) {
    if (!confirm(t("Você tem certeza?"))) return;
    try {
      await deleteComment({ data: { commentId } });
      await loadComments();
    } catch {
      // ignore
    }
  }

  return (
    <div className="mt-12 border-t border-stone-200 pt-8 dark:border-stone-700">
      <div className="mb-6 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <h3 className="font-serif text-xl font-semibold text-stone-800 dark:text-stone-100">
          {t("Comentários")} ({comments.length})
        </h3>
      </div>

      {signedIn ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("Escreva um comentário...")}
            rows={3}
            className="w-full rounded-xl border border-stone-300/60 bg-white/80 px-4 py-3 text-sm text-stone-800 placeholder-stone-400 outline-none transition focus:border-amber-400 dark:border-stone-600/60 dark:bg-stone-800/80 dark:text-stone-100"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="mt-2 flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t("Enviar comentário")}
          </button>
        </form>
      ) : (
        <div className="mb-6 rounded-xl border border-stone-200/60 bg-stone-50 p-4 text-center text-sm text-stone-600 dark:border-stone-700/50 dark:bg-stone-800/40 dark:text-stone-400">
          <Link to="/auth" className="font-semibold text-amber-600 underline dark:text-amber-400">
            {t("Entrar para comentar")}
          </Link>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-400">{t("Carregando...")}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-stone-400">{t("Nenhum comentário ainda")}</p>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-stone-200/60 bg-white/60 p-4 dark:border-stone-700/50 dark:bg-stone-800/40"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                  {c.author_name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">
                    {new Date(c.created_at).toLocaleDateString(lang)}
                  </span>
                  {signedIn && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-stone-400 hover:text-red-500"
                      aria-label={t("excluir")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-stone-600 dark:text-stone-300">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
