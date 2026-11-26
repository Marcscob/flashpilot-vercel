import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "@e965/xlsx";
import { topicDisplayName } from "@/lib/topic-tree";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  X,
  HelpCircle,
  Check,
  CheckCheck,
  History as HistoryIcon,
  Download,
  Loader2,
} from "lucide-react";
import { EvolutionChart } from "@/components/EvolutionChart";
import { useLang, useT } from "@/lib/i18n";
import { useScreenT } from "@/lib/i18n-screens";
import { T } from "@/lib/i18n-ui";
import { exportFlashcardsReportPdf } from "@/lib/export-report-pdf";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Relatório de revisões · FlashPilot" },
      { name: "description", content: "Acompanhe a situação atual e o histórico de revisões dos seus flashcards." },
      { property: "og:title", content: "Relatório de revisões · FlashPilot" },
      { property: "og:description", content: "Acompanhe a situação atual e o histórico de revisões dos seus flashcards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type QualityMeta = { key: "qForgot" | "qHard" | "qGood" | "qEasy"; tone: string; Icon: typeof X };
const QUALITY_META: Record<number, QualityMeta> = {
  0: { key: "qForgot", tone: "bg-destructive/15 text-destructive", Icon: X },
  3: { key: "qHard", tone: "bg-warning/25 text-warning-foreground", Icon: HelpCircle },
  4: { key: "qGood", tone: "bg-primary/10 text-primary", Icon: Check },
  5: { key: "qEasy", tone: "bg-success/15 text-success", Icon: CheckCheck },
};

function useQualityBadge() {
  const t = useT();
  return (q: number | null | undefined) => {
    if (q == null) return <span className="text-muted-foreground text-xs">—</span>;
    const meta = QUALITY_META[q];
    const label = meta ? t.reports[meta.key] : `Q${q}`;
    const tone = meta?.tone ?? "bg-muted text-foreground";
    const Icon = meta?.Icon ?? HelpCircle;
    return (
      <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>
        <Icon className="h-3 w-3" /> {label}
      </span>
    );
  };
}

function fmtDate(v: string | null | undefined, lang: string) {
  if (!v) return "—";
  try {
    const d = v.length <= 10 ? new Date(`${v}T00:00:00`) : new Date(v);
    return d.toLocaleDateString(lang);
  } catch { return v; }
}

function fmtDateTime(v: string | null | undefined, lang: string) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString(lang); } catch { return v; }
}

function fmtInterval(days: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "day",
    unitDisplay: "short",
  }).format(days);
}

function ReportsPage() {
  const t = useT();
  const sc = useScreenT();
  const { lang, extLang } = useLang();
  const locale = extLang ?? lang;
  const qualityBadge = useQualityBadge();
  const [tab, setTab] = useState<"current" | "history">("current");
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState<string>("all");
  const [reviewedFilter, setReviewedFilter] = useState<"all" | "yes" | "no">("all");
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const subjects = useQuery({
    queryKey: ["report-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const current = useQuery({
    queryKey: ["report-current", subjectId],
    enabled: tab === "current",
    queryFn: async () => {
      let q = supabase
        .from("flashcards")
        .select(
          "id, question, due_date, last_reviewed_at, repetitions, interval_days, reviewed, reviewed_marked_at, topics!inner(id, name, article_range, subject_id, subjects(id, name))",
        )
        .order("last_reviewed_at", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (subjectId !== "all") q = q.eq("topics.subject_id", subjectId);
      const { data, error } = await q;
      if (error) throw error;

      // For each card, fetch the last review quality
      const ids = (data ?? []).map((c: any) => c.id);
      const lastByCard: Record<string, { quality: number; reviewed_at: string }> = {};
      if (ids.length) {
        // Chunk to avoid URL limits
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200);
          const { data: revs } = await supabase
            .from("flashcard_reviews")
            .select("flashcard_id, quality, reviewed_at")
            .in("flashcard_id", chunk)
            .order("reviewed_at", { ascending: false });
          for (const r of revs ?? []) {
            if (!lastByCard[(r as any).flashcard_id]) {
              lastByCard[(r as any).flashcard_id] = { quality: (r as any).quality, reviewed_at: (r as any).reviewed_at };
            }
          }
        }
      }
      return (data ?? []).map((c: any) => ({ ...c, last_review: lastByCard[c.id] ?? null }));
    },
  });

  const history = useQuery({
    queryKey: ["report-history", subjectId],
    enabled: tab === "history",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcard_reviews")
        .select(
          "id, quality, reviewed_at, previous_due_date, next_due_date, interval_days, flashcard:flashcards!inner(id, question, topics!inner(id, name, article_range, subject_id, subjects(id, name)))",
        )
        .order("reviewed_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const rows = data ?? [];
      if (subjectId === "all") return rows;
      return rows.filter((r: any) => r.flashcard?.topics?.subject_id === subjectId);
    },
  });

  const filteredCurrent = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = current.data ?? [];
    if (reviewedFilter === "yes") rows = rows.filter((r: any) => r.reviewed);
    if (reviewedFilter === "no") rows = rows.filter((r: any) => !r.reviewed);
    if (!term) return rows;
    return rows.filter((r: any) => r.question?.toLowerCase().includes(term));
  }, [current.data, search, reviewedFilter]);

  const filteredHistory = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = history.data ?? [];
    if (!term) return rows;
    return rows.filter((r: any) => r.flashcard?.question?.toLowerCase().includes(term));
  }, [history.data, search]);

  function reportExportData() {
    const qualityLabel = (quality: number | null | undefined) => {
      if (quality == null) return "—";
      const meta = QUALITY_META[quality];
      return meta ? t.reports[meta.key] : `Q${quality}`;
    };
    if (tab === "current") {
      return {
        head: [
          t.reports.colFlashcard,
          t.reports.colSubjectTopic,
          t.reports.colLastReview,
          t.reports.colClassification,
          t.reports.colNextReview,
          t.reports.reviewed,
          t.reports.colReviewsDone,
        ],
        body: filteredCurrent.map((r: any) => [
          r.question ?? "",
          [r.topics?.subjects?.name, r.topics ? topicDisplayName(r.topics) : ""]
            .filter(Boolean)
            .join(" / ") || "—",
          fmtDateTime(r.last_review?.reviewed_at ?? r.last_reviewed_at, locale),
          qualityLabel(r.last_review?.quality),
          fmtDate(r.due_date, locale),
          r.reviewed ? t.reports.yes : t.reports.no,
          `${r.repetitions ?? 0} ${(r.repetitions ?? 0) === 1 ? t.reports.reviewOne : t.reports.reviewMany}`,
        ]),
      };
    }
    return {
      head: [
        t.reports.colReviewDate,
        t.reports.colFlashcard,
        t.reports.colSubjectTopic,
        t.reports.colClassification,
        t.reports.colPrevDue,
        t.reports.colNextReview,
        t.reports.colInterval,
      ],
      body: filteredHistory.map((r: any) => [
        fmtDateTime(r.reviewed_at, locale),
        r.flashcard?.question ?? "",
        [
          r.flashcard?.topics?.subjects?.name,
          r.flashcard?.topics ? topicDisplayName(r.flashcard.topics) : "",
        ]
          .filter(Boolean)
          .join(" / ") || "—",
        qualityLabel(r.quality),
        fmtDate(r.previous_due_date, locale),
        fmtDate(r.next_due_date, locale),
        r.interval_days != null ? fmtInterval(r.interval_days, locale) : "—",
      ]),
    };
  }

  function reportExportFilters() {
    const filters = [];
    if (subjectId !== "all") {
      const subjectName = (subjects.data ?? []).find((subject: any) => subject.id === subjectId)?.name;
      if (subjectName) filters.push({ label: t.reports.allSubjects, value: subjectName });
    }
    if (search.trim()) filters.push({ label: t.reports.searchPh, value: search.trim() });
    if (tab === "current" && reviewedFilter !== "all") {
      filters.push({
        label: t.reports.reviewed,
        value: reviewedFilter === "yes" ? t.reports.reviewedOnly : t.reports.notReviewedOnly,
      });
    }
    return filters;
  }

  async function exportReport(format: "pdf" | "excel") {
    const { head, body } = reportExportData();
    if (!body.length) return;
    setExporting(format);
    try {
      const fileName = `flashpilot-reports-${tab}-${new Date().toISOString().slice(0, 10)}`;
      if (format === "pdf") {
        await exportFlashcardsReportPdf({
          head,
          body,
          filters: reportExportFilters(),
          fileName,
          title: t.reports.title,
          locale,
          labels: {
            generatedAt: sc.fc.generatedAt,
            card: T("flashcard"),
            cards: T("flashcards"),
            page: sc.fc.page,
            of: sc.fc.of,
            footer: "FlashPilot",
          },
        });
      } else {
        const worksheet = XLSX.utils.aoa_to_sheet([head, ...body]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          tab === "current" ? "Current" : "History",
        );
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-serif">{t.reports.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t.reports.subtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.reports.searchPh}
            className="pl-8"
          />
        </div>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t.reports.allSubjects} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.reports.allSubjectsGlobal}</SelectItem>
            {(subjects.data ?? []).map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reviewedFilter} onValueChange={(v) => setReviewedFilter(v as "all" | "yes" | "no")}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.reports.reviewedAll}</SelectItem>
            <SelectItem value="yes">{t.reports.reviewedOnly}</SelectItem>
            <SelectItem value="no">{t.reports.notReviewedOnly}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <EvolutionChart subjectId={subjectId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          <button
            onClick={() => setTab("current")}
            className={`px-3 py-1.5 text-sm rounded-md ${tab === "current" ? "bg-secondary" : ""}`}
          >
            {t.reports.tabCurrent}
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1 ${tab === "history" ? "bg-secondary" : ""}`}
          >
            <HistoryIcon className="h-4 w-4" /> {t.reports.tabHistory}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void exportReport("pdf")}
            disabled={
              exporting !== null ||
              (tab === "current"
                ? current.isLoading || filteredCurrent.length === 0
                : history.isLoading || filteredHistory.length === 0)
            }
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {T("Exportar")} PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => void exportReport("excel")}
            disabled={
              exporting !== null ||
              (tab === "current"
                ? current.isLoading || filteredCurrent.length === 0
                : history.isLoading || filteredHistory.length === 0)
            }
          >
            {exporting === "excel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {T("Exportar")} Excel
          </Button>
        </div>
      </div>


      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {tab === "current" ? (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.reports.colFlashcard}</th>
                  <th className="px-3 py-2 font-medium">{t.reports.colSubjectTopic}</th>
                  <th className="px-3 py-2 font-medium">{t.reports.colLastReview}</th>
                  <th className="px-3 py-2 font-medium">{t.reports.colClassification}</th>
                  <th className="px-3 py-2 font-medium">{t.reports.colNextReview}</th>
                  <th className="px-3 py-2 font-medium">{t.reports.reviewed}</th>
                  <th className="px-3 py-2 font-medium text-right">{t.reports.colReviewsDone}</th>
                </tr>
              </thead>
              <tbody>
                {current.isLoading && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">…</td></tr>
                )}
                {!current.isLoading && filteredCurrent.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{t.reports.empty}</td></tr>
                )}
                {filteredCurrent.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 max-w-[380px] truncate" title={r.question}>{r.question}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-xs text-muted-foreground">{r.topics?.subjects?.name ?? "—"}</div>
                      <div>{r.topics ? topicDisplayName(r.topics) : "—"}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(r.last_review?.reviewed_at ?? r.last_reviewed_at, locale)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{qualityBadge(r.last_review?.quality)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.due_date, locale)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.reviewed ? t.reports.yes : t.reports.no}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {r.repetitions ?? 0} {(r.repetitions ?? 0) === 1 ? t.reports.reviewOne : t.reports.reviewMany}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.reports.colReviewDate}</th>
                  <th className="px-3 py-2 font-medium">{t.reports.colFlashcard}</th>
                  <th className="px-3 py-2 font-medium">{t.reports.colSubjectTopic}</th>
                  <th className="px-3 py-2 font-medium">{t.reports.colClassification}</th>
                  <th className="px-3 py-2 font-medium">{t.reports.colPrevDue}</th>
                  <th className="px-3 py-2 font-medium">{t.reports.colNextReview}</th>
                  <th className="px-3 py-2 font-medium text-right">{t.reports.colInterval}</th>
                </tr>
              </thead>
              <tbody>
                {history.isLoading && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">…</td></tr>
                )}
                {!history.isLoading && filteredHistory.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{t.reports.emptyHistory}</td></tr>
                )}
                {filteredHistory.map((r: any) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDateTime(r.reviewed_at, locale)}</td>
                    <td className="px-3 py-2 max-w-[320px] truncate" title={r.flashcard?.question}>{r.flashcard?.question}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-xs text-muted-foreground">{r.flashcard?.topics?.subjects?.name ?? "—"}</div>
                      <div>{r.flashcard?.topics ? topicDisplayName(r.flashcard.topics) : "—"}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{qualityBadge(r.quality)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.previous_due_date, locale)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.next_due_date, locale)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.interval_days != null ? fmtInterval(r.interval_days, locale) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
