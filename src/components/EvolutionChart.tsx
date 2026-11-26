import { useMemo, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { useT } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { localDateStr } from "@/lib/today";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

type Range = "7" | "30" | "90" | "all";

const RANGES: { key: Range; days: number | null }[] = [
  { key: "7", days: 7 },
  { key: "30", days: 30 },
  { key: "90", days: 90 },
  { key: "all", days: null },
];

function dayKey(d: Date) {
  return localDateStr(d);
}

function fmtDayShort(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function EvolutionChart({ subjectId }: { subjectId: string }) {
  const t = useT();
  const d = t.chart.dayShort;
  const rangeLabels: Record<Range, string> = { "7": `7${d}`, "30": `30${d}`, "90": `90${d}`, all: t.chart.rangeAll };
  const [range, setRange] = useState<Range>("30");

  const data = useQuery({
    queryKey: ["evolution", subjectId, range],
    queryFn: async () => {
      const days = RANGES.find((r) => r.key === range)?.days ?? null;
      let q = supabase
        .from("flashcard_reviews")
        .select(
          "quality, reviewed_at, flashcard:flashcards!inner(topics!inner(subject_id))",
        )
        .order("reviewed_at", { ascending: true })
        .limit(10000);
      if (days) {
        const since = new Date();
        since.setDate(since.getDate() - (days - 1));
        since.setHours(0, 0, 0, 0);
        q = q.gte("reviewed_at", since.toISOString());
      }
      if (subjectId !== "all") {
        q = q.eq("flashcard.topics.subject_id", subjectId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const chart = useMemo(() => {
    const rows = data.data ?? [];
    const buckets: Record<string, { correct: number; total: number }> = {};
    for (const r of rows as any[]) {
      const d = new Date(r.reviewed_at);
      const key = dayKey(d);
      if (!buckets[key]) buckets[key] = { correct: 0, total: 0 };
      buckets[key].total += 1;
      if (r.quality >= 3) buckets[key].correct += 1;
    }

    const days = RANGES.find((r) => r.key === range)?.days;
    const series: { day: string; label: string; total: number; accuracy: number | null; ma7: number | null }[] = [];

    if (days) {
      // Dense series across the range for a clean timeline
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = dayKey(d);
        const b = buckets[key];
        series.push({
          day: key,
          label: fmtDayShort(key),
          total: b?.total ?? 0,
          accuracy: b && b.total > 0 ? Math.round((b.correct / b.total) * 100) : null,
          ma7: null,
        });
      }
    } else {
      // Sparse series with only days that had reviews
      const keys = Object.keys(buckets).sort();
      for (const key of keys) {
        const b = buckets[key];
        series.push({
          day: key,
          label: fmtDayShort(key),
          total: b.total,
          accuracy: b.total > 0 ? Math.round((b.correct / b.total) * 100) : null,
          ma7: null,
        });
      }
    }

    // 7-day moving average of accuracy weighted by reviews
    for (let i = 0; i < series.length; i++) {
      let corr = 0;
      let tot = 0;
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        const b = buckets[series[j].day];
        if (b) {
          corr += b.correct;
          tot += b.total;
        }
      }
      series[i].ma7 = tot > 0 ? Math.round((corr / tot) * 100) : null;
    }

    const totalReviews = (rows as any[]).length;
    const totalCorrect = (rows as any[]).filter((r) => r.quality >= 3).length;
    const overall = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : null;

    return { series, overall, totalReviews };
  }, [data.data, range]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg">{t.chart.title}</h2>
          <p className="text-xs text-muted-foreground">
            {t.chart.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{t.chart.periodAccuracy}</div>
            <div className="text-lg font-semibold tabular-nums">
              {chart.overall != null ? `${chart.overall}%` : "—"}
              <span className="text-xs text-muted-foreground font-normal ml-1">
                ({chart.totalReviews} {t.chart.revShort})
              </span>
            </div>
          </div>
          <div className="inline-flex rounded-lg border p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-2.5 py-1 text-xs rounded-md ${range === r.key ? "bg-secondary" : ""}`}
              >
                {rangeLabels[r.key]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        {data.isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{T("Carregando…")}</div>
        ) : chart.series.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            {t.chart.empty}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart.series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
              />
              <YAxis
                yAxisId="acc"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                tickFormatter={(v) => `${v}%`}
                width={38}
              />
              <YAxis
                yAxisId="rev"
                orientation="right"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--muted-foreground) 12%, transparent)" }}
                contentStyle={{
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--popover-foreground)" }}
                itemStyle={{ color: "var(--popover-foreground)" }}
                formatter={(value: any, name: string) => {
                  if (name === t.chart.reviews) return [value, name];
                  return [value == null ? "—" : `${value}%`, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
              <ReferenceLine y={70} yAxisId="acc" stroke="var(--muted-foreground)" strokeDasharray="4 4" />
              <Bar
                yAxisId="rev"
                dataKey="total"
                name={t.chart.reviews}
                fill="color-mix(in oklab, var(--primary) 35%, transparent)"
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="acc"
                type="monotone"
                dataKey="accuracy"
                name={t.chart.dailyAccuracy}
                stroke="var(--primary)"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="acc"
                type="monotone"
                dataKey="ma7"
                name={t.chart.ma7}
                stroke="var(--foreground)"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>

        )}
      </div>
    </Card>
  );
}
