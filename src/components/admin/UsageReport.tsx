import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminAnalyticsReport } from "@/lib/analytics-report.functions";
import { useLang } from "@/lib/i18n";
import { T } from "@/lib/i18n-ui";

type Row = { key: string; count: number };

function List({ title, rows, locale }: { title: string; rows: Row[]; locale: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">{T("Sem dados ainda.")}</p>
      ) : (
        <ol className="mt-2 space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.key} className="flex justify-between gap-3">
              <span className="truncate text-muted-foreground" title={r.key}>
                {r.key}
              </span>
              <span className="font-medium text-foreground">{r.count.toLocaleString(locale)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function UsageReport() {
  const { lang, extLang } = useLang();
  const locale = extLang || lang;
  const [days, setDays] = useState(30);
  const fn = useServerFn(adminAnalyticsReport);
  const q = useQuery({
    queryKey: ["admin-usage", days],
    queryFn: () => fn({ data: { days } }),
    retry: false,
  });
  const d = q.data;

  function exportCsv() {
    if (!d) return;
    const lines = [[T("Seção do relatório"), T("Nome do item"), T("Quantidade total")].join(";")];
    const add = (s: string, rows: Row[]) =>
      rows.forEach((r) => {
        const safe = /^[=+\-@\t\r]/.test(r.key) ? `'${r.key}` : r.key;
        lines.push(`${s};"${safe.replace(/"/g, '""')}";${r.count}`);
      });
    add(T("Posts mais lidos"), d.topPosts);
    add(T("Páginas mais vistas"), d.topPages);
    add(T("Cliques de funções"), d.topClicks);
    const url = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `flashpilot-${days}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-serif text-foreground">
          <Eye className="h-4 w-4 text-primary" /> {T("Visualizações e cliques")}
        </h2>
        <div className="flex gap-2">
          {([7, 30, 90] as const).map((n) => (
            <Button
              key={n}
              size="sm"
              variant={days === n ? "default" : "outline"}
              onClick={() => setDays(n)}
            >
              {T(`${n} dias`)}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!d}>
            <Download className="mr-1 h-4 w-4" /> {T("Relatório de uso")}
          </Button>
        </div>
      </div>
      {d && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              [T("Visualizações totais"), d.views],
              [T("Cliques totais"), d.clicks],
              [T("Visitas totais"), d.sessions],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-border p-3">
                <div className="text-xs text-muted-foreground">{l}</div>
                <div className="text-xl font-semibold text-foreground">
                  {(v as number).toLocaleString(locale)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <List title={T("Posts mais lidos")} rows={d.topPosts} locale={locale} />
            <List title={T("Páginas mais vistas")} rows={d.topPages} locale={locale} />
            <List title={T("Funções mais clicadas")} rows={d.topClicks} locale={locale} />
          </div>
        </>
      )}
    </section>
  );
}
