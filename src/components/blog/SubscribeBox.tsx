import { useState } from "react";
import { blogSubscribe } from "@/lib/blog.functions";
import { useServerFn } from "@tanstack/react-start";
import { matchBlogTag } from "@/lib/blog-langs";
import { useBlogUi } from "@/lib/blog-ui-i18n";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";

export function SubscribeBox({ lang }: { lang: string }) {
  const subscribe = useServerFn(blogSubscribe);
  const { t } = useBlogUi(lang);
  const subscriptionLang = matchBlogTag(lang) ?? "en";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      await subscribe({ data: { email, name, lang: subscriptionLang } });
      setStatus("ok");
      setMsg("Se a inscrição ainda não estiver confirmada, verifique seu e-mail.");
      setEmail("");
      setName("");
    } catch {
      setStatus("error");
      setMsg("Não foi possível concluir a inscrição. Tente novamente.");
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200/60 bg-gradient-to-br from-amber-50 to-stone-50 p-6 dark:border-stone-700/50 dark:from-stone-800/60 dark:to-stone-900/60">
      <div className="mb-4 flex items-center gap-2">
        <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <h3 className="font-serif text-lg font-semibold text-stone-800 dark:text-stone-100">
          {t("Receba novos posts")}
        </h3>
      </div>
      <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">
        {t("Receba os novos posts do FlashPilot diretamente no seu e-mail.")}
      </p>
      {status === "ok" ? (
        <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5" />
          <span>{t(msg)}</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("Seu nome")}
            className="w-full rounded-lg border border-stone-300/60 bg-white/80 px-4 py-2.5 text-sm text-stone-800 placeholder-stone-400 outline-none transition focus:border-amber-400 dark:border-stone-600/60 dark:bg-stone-800/80 dark:text-stone-100"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("Seu e-mail")}
            className="w-full rounded-lg border border-stone-300/60 bg-white/80 px-4 py-2.5 text-sm text-stone-800 placeholder-stone-400 outline-none transition focus:border-amber-400 dark:border-stone-600/60 dark:bg-stone-800/80 dark:text-stone-100"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {status === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("Inscrever")}
          </button>
        </form>
      )}
    </div>
  );
}
