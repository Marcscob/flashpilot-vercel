import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert } from "lucide-react";
import { adminAiFallbacks } from "@/lib/ai-fallback-admin.functions";

export function AiFallbackLog() {
  const fn = useServerFn(adminAiFallbacks);
  const q = useQuery({ queryKey: ["admin-ai-fallbacks"], queryFn: () => fn(), staleTime: 15_000 });
  const rows = q.data ?? [];

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-serif text-foreground">
        <ShieldAlert className="h-4 w-4 text-primary" /> Fallbacks de IA
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Cada vez que o Gemini falha e o gateway é usado: funcionalidade e modelo que falhou (últimos
        200).
      </p>
      {q.isLoading ? (
        <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nenhum fallback registrado.</p>
      ) : (
        <div className="mt-4 max-h-96 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-3">Quando</th>
                <th className="pr-3">Funcionalidade</th>
                <th className="pr-3">Modelo que falhou</th>
                <th className="pr-3">Fallback</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-1 pr-3 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="pr-3">{r.feature}</td>
                  <td className="pr-3">{r.failedModel}</td>
                  <td className="pr-3">{r.fallbackModel ?? "—"}</td>
                  <td>{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
