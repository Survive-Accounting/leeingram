import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { ExternalLink, Eye, Copy, Check, MessageCircle, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboardFallback";
import {
  buildV2IframeCode, buildV2LiveUrl, buildV2PreviewUrl, buildV2Title,
} from "@/lib/v2/iframeBuilder";
import {
  useV2Assets, useV2StatusCounts, useChaptersAndCourses,
  type V2Status, type V2AssetRow,
} from "@/hooks/useV2Assets";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 50;

const STATUS_STYLES: Record<V2Status, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  ready: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  embedded: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
};
const NEXT_STATUS: Record<V2Status, V2Status> = {
  draft: "ready",
  ready: "embedded",
  embedded: "draft",
};

export default function AssetsControlPanelV2() {
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();

  const courseId = params.get("course") || "";
  const chapterId = params.get("chapter") || "";
  const status = (params.get("status") as V2Status | "all") || "all";
  const search = params.get("q") || "";
  const page = Math.max(0, parseInt(params.get("page") || "0", 10));

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  // Debounce search.
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) {
        const p = new URLSearchParams(params);
        if (searchInput) p.set("q", searchInput); else p.delete("q");
        p.delete("page");
        setParams(p, { replace: true });
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v && v !== "all" && v !== "") p.set(k, v); else p.delete(k);
    if (k !== "page") p.delete("page");
    setParams(p, { replace: true });
  };

  const { data: meta } = useChaptersAndCourses();
  const { data: counts } = useV2StatusCounts();
  const filters = useMemo(
    () => ({
      courseId: courseId || null,
      chapterId: chapterId || null,
      status,
      search,
      page,
      pageSize: PAGE_SIZE,
    }),
    [courseId, chapterId, status, search, page],
  );
  const { data, isLoading, isFetching, refetch } = useV2Assets(filters);

  const visibleChapters = useMemo(() => {
    const chs = meta?.chapters || [];
    return courseId ? chs.filter((c: any) => c.course_id === courseId) : chs;
  }, [meta, courseId]);

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE));

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${label} copied`); else toast.error("Copy failed");
  };

  const cycleStatus = async (row: V2AssetRow) => {
    const next = NEXT_STATUS[row.v2_status];
    const patch: any = { v2_status: next };
    if (next === "embedded") patch.v2_embedded_at = new Date().toISOString();
    if (next === "draft") patch.v2_embedded_at = null;
    const { error } = await supabase.from("teaching_assets").update(patch).eq("id", row.id);
    if (error) {
      toast.error("Update failed: " + error.message);
      return;
    }
    toast.success(`Marked ${next}`);
    qc.invalidateQueries({ queryKey: ["v2-assets"] });
    qc.invalidateQueries({ queryKey: ["v2-status-counts"] });
  };

  const markEmbedded = async (row: V2AssetRow) => {
    const { error } = await supabase
      .from("teaching_assets")
      .update({ v2_status: "embedded", v2_embedded_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      toast.error("Update failed");
      return;
    }
    toast.success("Marked embedded");
    qc.invalidateQueries({ queryKey: ["v2-assets"] });
    qc.invalidateQueries({ queryKey: ["v2-status-counts"] });
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>V2 Assets Control Panel</title></Helmet>

      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1400px] px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold">Teaching Assets V2 — Control Panel</h1>
            <p className="text-xs text-muted-foreground">
              LearnWorlds embed workflow · {counts?.total ?? "—"} total
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className={STATUS_STYLES.draft}>
              Draft {counts?.draft ?? 0}
            </Badge>
            <Badge variant="outline" className={STATUS_STYLES.ready}>
              Ready {counts?.ready ?? 0}
            </Badge>
            <Badge variant="outline" className={STATUS_STYLES.embedded}>
              Embedded {counts?.embedded ?? 0}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 py-2 flex flex-wrap items-center gap-2">
          <Select value={courseId || "all"} onValueChange={(v) => { setParam("course", v === "all" ? null : v); setParam("chapter", null); }}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {meta?.courses.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={chapterId || "all"} onValueChange={(v) => setParam("chapter", v === "all" ? null : v)}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Chapter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All chapters</SelectItem>
              {visibleChapters.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>Ch {c.chapter_number} — {c.chapter_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v) => setParam("status", v)}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="embedded">Embedded</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search source_ref…"
            className="h-8 w-[200px] text-xs"
          />

          <div className="ml-auto text-xs text-muted-foreground">
            {data ? `${data.rows.length ? page * PAGE_SIZE + 1 : 0}–${page * PAGE_SIZE + data.rows.length} of ${data.total}` : ""}
          </div>
        </div>
      </div>

      {/* Table */}
      <main className="mx-auto max-w-[1400px] px-4 py-4">
        <div className="rounded-md border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="h-9 w-[140px]">source_ref</TableHead>
                <TableHead className="h-9 w-[60px]">Ch</TableHead>
                <TableHead className="h-9 w-[100px]">Course</TableHead>
                <TableHead className="h-9 w-[110px]">Status</TableHead>
                <TableHead className="h-9 w-[60px] text-center">❓</TableHead>
                <TableHead className="h-9">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" />
                </TableCell></TableRow>
              ) : data?.rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                  No assets match these filters.
                </TableCell></TableRow>
              ) : (
                data?.rows.map((r) => (
                  <AssetRow
                    key={r.id}
                    row={r}
                    onCopy={handleCopy}
                    onCycleStatus={cycleStatus}
                    onMarkEmbedded={markEmbedded}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-3 text-xs">
          <div className="text-muted-foreground">Page {page + 1} of {totalPages}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setParam("page", String(page - 1))}>
              ← Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setParam("page", String(page + 1))}>
              Next →
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function AssetRow({
  row, onCopy, onCycleStatus, onMarkEmbedded,
}: {
  row: V2AssetRow;
  onCopy: (text: string, label: string) => void;
  onCycleStatus: (r: V2AssetRow) => void;
  onMarkEmbedded: (r: V2AssetRow) => void;
}) {
  const title = buildV2Title(row.chapter_number, row.source_ref);
  const iframe = buildV2IframeCode(row.asset_name);
  const liveUrl = buildV2LiveUrl(row.asset_name);
  const previewUrl = buildV2PreviewUrl(row.asset_name);

  return (
    <TableRow className="text-xs">
      <TableCell className="py-1.5 font-mono">{row.source_ref || "—"}</TableCell>
      <TableCell className="py-1.5">{row.chapter_number ?? "—"}</TableCell>
      <TableCell className="py-1.5">{row.course_code || "—"}</TableCell>
      <TableCell className="py-1.5">
        <button
          onClick={() => onCycleStatus(row)}
          className={cn(
            "px-2 py-0.5 rounded border text-[11px] font-medium uppercase tracking-wide hover:opacity-80 transition",
            STATUS_STYLES[row.v2_status],
          )}
          title="Click to cycle status"
        >
          {row.v2_status}
        </button>
      </TableCell>
      <TableCell className="py-1.5 text-center">
        {row.question_count > 0 ? (
          <QuestionsPopover chapterId={row.chapter_id} sourceRef={row.source_ref} count={row.question_count} />
        ) : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="py-1.5">
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onCopy(title, "Title")}>
            <Copy className="h-3 w-3 mr-1" /> Title
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => onCopy(iframe, "Iframe")}>
            <Copy className="h-3 w-3 mr-1" /> Iframe
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" asChild>
            <a href={previewUrl} target="_blank" rel="noreferrer"><Eye className="h-3 w-3 mr-1" /> Preview</a>
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" asChild>
            <a href={liveUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" /> Live</a>
          </Button>
          {row.v2_status !== "embedded" && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => onMarkEmbedded(row)}>
              <Check className="h-3 w-3 mr-1" /> Mark Embedded
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function QuestionsPopover({
  chapterId, sourceRef, count,
}: { chapterId: string; sourceRef: string | null; count: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || items) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("chapter_questions")
        .select("id, question, student_email, created_at, responded")
        .eq("chapter_id", chapterId)
        .ilike("source_ref", sourceRef || "")
        .eq("responded", false)
        .order("created_at", { ascending: false })
        .limit(20);
      setItems(data || []);
      setLoading(false);
    })();
  }, [open, items, chapterId, sourceRef]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/15 text-destructive text-[11px] font-medium hover:bg-destructive/25 transition">
          <MessageCircle className="h-3 w-3" /> {count}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="end">
        <div className="text-xs font-semibold mb-2">Open questions ({count})</div>
        {loading ? (
          <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
        ) : (items || []).length === 0 ? (
          <div className="text-xs text-muted-foreground py-2">No open questions.</div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {items!.map((q) => (
              <div key={q.id} className="border border-border rounded p-2 text-xs">
                <div className="text-muted-foreground text-[10px] mb-1">
                  {q.student_email} · {new Date(q.created_at).toLocaleDateString()}
                </div>
                <div className="line-clamp-3">{q.question}</div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 pt-2 border-t border-border">
          <a href="/inbox" className="text-[11px] text-primary hover:underline">Open full inbox →</a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
