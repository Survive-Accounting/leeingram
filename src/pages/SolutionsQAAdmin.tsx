import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { QAToolboxModal } from "@/components/QAToolboxModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, Copy, FileText, Sparkles, Zap, Target, Loader2,
  Wrench, X, RotateCcw, Check, ChevronDown, ChevronUp, ExternalLink,
  Mail, Send, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ChapterQAReportExporter } from "@/components/admin-dashboard/ChapterQAReportExporter";
import { ChapterAuditPanel } from "@/components/admin-dashboard/ChapterAuditPanel";

// ── Types ────────────────────────────────────────────────────────────

type QAAsset = {
  id: string;
  asset_name: string;
  chapter_id: string;
  qa_status: string;
  reviewed_by: string | null;
};

type QAIssue = {
  id: string;
  qa_asset_id: string;
  asset_name: string;
  section: string;
  issue_description: string;
  suggested_fix: string | null;
  screenshot_url: string | null;
  fix_description: string | null;
  fix_status: string;
  fix_scope: string;
};

type StatusCounts = {
  total: number;
  pending: number;
  clean: number;
  issues: number;
  fixApproved: number;
  generated: number;
  needsLee: number;
};

type FixStep = "input" | "running" | "compare" | "done";

type SectionOption = {
  key: string;
  label: string;
};

const FIX_SECTIONS: SectionOption[] = [
  { key: "solution_je", label: "Solution text + JE reasons" },
  { key: "supplementary_je", label: "Supplementary journal entries" },
  { key: "dissector", label: "Problem dissector highlights" },
  { key: "formulas", label: "Important formulas" },
  { key: "concepts", label: "Key concepts" },
  { key: "traps", label: "Exam traps" },
  { key: "flowchart", label: "Flowchart" },
];

const PAGE_SIZE = 100;

const FIX_STATUS_OPTIONS = [
  { value: "pending_fix", label: "Pending Fix", bg: "rgba(245,158,11,0.2)", text: "#D97706" },
  { value: "fix_applied", label: "Fix Applied", bg: "rgba(59,130,246,0.2)", text: "#3B82F6" },
  { value: "fix_verified", label: "Verified ✓", bg: "rgba(16,185,129,0.2)", text: "#10B981" },
  { value: "still_has_issues", label: "Still Has Issues", bg: "rgba(239,68,68,0.2)", text: "#EF4444" },
  { value: "needs_lee", label: "Needs Lee 🚩", bg: "rgba(249,115,22,0.2)", text: "#F97316" },
  { value: "pending_lee_review", label: "Pending Review 🔍", bg: "rgba(139,92,246,0.2)", text: "#8B5CF6" },
  { value: "ready_for_students", label: "Ready ✓", bg: "rgba(16,185,129,0.2)", text: "#10B981" },
] as const;

function FixStatusControl({ teachingAssetId }: { teachingAssetId: string | undefined }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!teachingAssetId) return;
    supabase.from("teaching_assets").select("fix_status").eq("id", teachingAssetId).single().then(({ data }) => {
      setCurrent((data as any)?.fix_status || null);
      setLoaded(true);
    });
  }, [teachingAssetId]);

  if (!teachingAssetId || !loaded) return null;

  const update = async (value: string) => {
    const next = current === value ? null : value;
    await supabase.from("teaching_assets").update({ fix_status: next } as any).eq("id", teachingAssetId);
    setCurrent(next);
    toast.success("Status updated");
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-foreground">Mark fix status</label>
      <div className="flex flex-wrap gap-1.5">
        {FIX_STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => update(opt.value)}
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all border"
            style={{
              backgroundColor: current === opt.value ? opt.bg : "transparent",
              color: current === opt.value ? opt.text : "var(--muted-foreground)",
              borderColor: current === opt.value ? opt.text : "var(--border)",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Old FixAssetModal and CompareSection removed — replaced by QAToolboxModal

// ── Main Component ───────────────────────────────────────────────────

export default function SolutionsQAAdmin() {
  const qc = useQueryClient();
  const [fixScopes, setFixScopes] = useState<Record<string, string>>({});
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [promptIds, setPromptIds] = useState<string[]>([]);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [allAssetsFilter, setAllAssetsFilter] = useState<string>("all");
  const [allAssetsChapter, setAllAssetsChapter] = useState<string>("all");
  const [highlightAsset, setHighlightAsset] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);
  const [fixIssue, setFixIssue] = useState<QAIssue | null>(null);
  const [fixPanelAsset, setFixPanelAsset] = useState<{ assetName: string; teachingAssetId: string } | null>(null);
  const [auditChapter, setAuditChapter] = useState<{ id: string; name: string } | null>(null);

  // ── Server-side COUNT queries ──
  const { data: counts } = useQuery<StatusCounts>({
    queryKey: ["qa-admin-counts"],
    queryFn: async () => {
      const base = supabase.from("solutions_qa_assets" as any);
      const [total, pending, clean, issues, fixApproved, generated] = await Promise.all([
        base.select("id", { count: "exact", head: true }),
        base.select("id", { count: "exact", head: true }).eq("qa_status", "pending"),
        base.select("id", { count: "exact", head: true }).eq("qa_status", "reviewed_clean"),
        base.select("id", { count: "exact", head: true }).eq("qa_status", "reviewed_issues"),
        base.select("id", { count: "exact", head: true }).eq("qa_status", "fix_approved"),
        base.select("id", { count: "exact", head: true }).eq("qa_status", "fix_generated"),
      ]);
      // Count "needs_lee" from teaching_assets fix_status
      const { count: needsLeeCount } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("fix_status", "needs_lee");
      return {
        total: total.count ?? 0,
        pending: pending.count ?? 0,
        clean: clean.count ?? 0,
        issues: issues.count ?? 0,
        fixApproved: fixApproved.count ?? 0,
        generated: generated.count ?? 0,
        needsLee: needsLeeCount ?? 0,
      };
    },
  });

  const safeCount = counts ?? { total: 0, pending: 0, clean: 0, issues: 0, fixApproved: 0, generated: 0, needsLee: 0 };

  // ── Paginated assets for the "All Assets" tab ──
  const assetsQueryKey = ["qa-admin-assets-paged", allAssetsFilter, allAssetsChapter];

  const {
    data: assetsPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: assetsQueryKey,
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from("solutions_qa_assets" as any)
        .select("*")
        .order("asset_name")
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (allAssetsFilter !== "all") q = q.eq("qa_status", allAssetsFilter);
      if (allAssetsChapter !== "all") q = q.eq("chapter_id", allAssetsChapter);
      const { data, error } = await q;
      if (error) throw error;
      return { rows: (data as any[]) as QAAsset[], nextOffset: (data as any[]).length === PAGE_SIZE ? pageParam + PAGE_SIZE : undefined };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  const allAssetsFiltered = useMemo(() => assetsPages?.pages.flatMap(p => p.rows) ?? [], [assetsPages]);

  // Fetch fix_status for displayed teaching assets
  const adminTeachingAssetIds = useMemo(() => {
    return allAssetsFiltered.map((a: any) => a.teaching_asset_id).filter(Boolean) as string[];
  }, [allAssetsFiltered]);

  const { data: adminFixStatusMap } = useQuery({
    queryKey: ["qa-admin-fix-status", adminTeachingAssetIds],
    queryFn: async () => {
      if (!adminTeachingAssetIds.length) return {} as Record<string, string | null>;
      const map: Record<string, string | null> = {};
      for (let i = 0; i < adminTeachingAssetIds.length; i += 200) {
        const chunk = adminTeachingAssetIds.slice(i, i + 200);
        const { data } = await supabase
          .from("teaching_assets")
          .select("id, fix_status")
          .in("id", chunk);
        if (data) for (const r of data) map[r.id] = (r as any).fix_status || null;
      }
      return map;
    },
    enabled: adminTeachingAssetIds.length > 0,
  });

  useEffect(() => {
    const lastAsset = localStorage.getItem("qa_last_asset_id");
    if (lastAsset && allAssetsFiltered.length > 0) {
      const found = allAssetsFiltered.find(a => a.asset_name === lastAsset);
      if (found) {
        setHighlightAsset(found.id);
        setTimeout(() => {
          highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => setHighlightAsset(null), 2000);
        }, 100);
      }
    }
  }, [allAssetsFiltered.length > 0]);

  const handleFilterChange = useCallback((setter: (v: string) => void, value: string) => {
    setter(value);
  }, []);

  const { data: allIssues } = useQuery({
    queryKey: ["qa-admin-issues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("solutions_qa_issues" as any).select("*").order("created_at");
      if (error) throw error;
      return (data as any[]) as QAIssue[];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["qa-admin-chapters"],
    queryFn: async () => {
      const { data: ia2 } = await supabase.from("courses").select("id").ilike("course_name", "%Intermediate Accounting 2%");
      if (!ia2?.length) return [];
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name").eq("course_id", ia2[0].id).order("chapter_number");
      return data || [];
    },
  });

  const bulkFixesReady = useMemo(() =>
    allIssues?.filter(i => i.fix_scope === "bulk_pattern" && i.fix_status === "approved").length ?? 0,
  [allIssues]);

  const approvedIssues = useMemo(() => allIssues?.filter(i => i.fix_status === "approved") || [], [allIssues]);

  const bulkAssetIds = useMemo(() => {
    const ids = new Set<string>();
    allIssues?.forEach(i => { if (i.fix_scope === "bulk_pattern") ids.add(i.qa_asset_id); });
    return ids;
  }, [allIssues]);

  const generatePrompt = () => {
    if (approvedIssues.length === 0) return;
    const bulkIssues = approvedIssues.filter(i => i.fix_scope === "bulk_pattern");
    const assetIssues = approvedIssues.filter(i => i.fix_scope !== "bulk_pattern");
    const parts: string[] = [`Read src/pages/SolutionsViewer.tsx and src/components/SolutionTextRenderer.tsx fully before making any changes.`];
    if (bulkIssues.length > 0) {
      const lines = bulkIssues.map((r, i) => `${i + 1}. [${r.section}]: ${r.fix_description || r.issue_description}`);
      parts.push(`\n━━━ SYSTEM-WIDE FIXES ━━━\n\nApply these fixes globally across ALL assets:\n\n${lines.join("\n\n")}`);
    }
    if (assetIssues.length > 0) {
      const lines = assetIssues.map((r, i) => `${i + 1}. **${r.asset_name}** — [${r.section}]: ${r.fix_description || r.issue_description}`);
      parts.push(`\n━━━ ASSET-SPECIFIC FIXES ━━━\n\nApply these fixes only to the listed asset:\n\n${lines.join("\n\n")}`);
    }
    parts.push(`\nDo not change any other behaviour. Files to modify: src/pages/SolutionsViewer.tsx, src/components/SolutionTextRenderer.tsx only.`);
    setGeneratedPrompt(parts.join("\n"));
    setPromptIds(approvedIssues.map(r => r.id));
  };

  const markGeneratedMutation = useMutation({
    mutationFn: async () => {
      for (const id of promptIds) {
        await supabase.from("solutions_qa_issues" as any).update({ fix_status: "generated" }).eq("id", id);
      }
      const assetIds = [...new Set(approvedIssues.filter(i => promptIds.includes(i.id)).map(i => i.qa_asset_id))];
      for (const aid of assetIds) {
        await supabase.from("solutions_qa_assets" as any).update({ qa_status: "fix_generated" }).eq("id", aid);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-admin-issues"] });
      qc.invalidateQueries({ queryKey: ["qa-admin-counts"] });
      qc.invalidateQueries({ queryKey: assetsQueryKey });
      toast.success("All marked as generated");
      setGeneratedPrompt("");
      setPromptIds([]);
    },
  });

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      pending: "bg-muted text-muted-foreground",
      reviewed_clean: "bg-emerald-500/20 text-emerald-400",
      reviewed_issues: "bg-amber-500/20 text-amber-400",
      fix_approved: "bg-blue-500/20 text-blue-400",
      fix_generated: "bg-purple-500/20 text-purple-400",
      pending_lee_review: "bg-purple-500/20 text-purple-400",
    };
    const label = s === "pending_lee_review" ? "Pending Review 🔍" : s.replace(/_/g, " ");
    return <Badge className={`text-[10px] ${colors[s] || colors.pending}`}>{label}</Badge>;
  };

  const issueCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    allIssues?.forEach(i => { map[i.qa_asset_id] = (map[i.qa_asset_id] || 0) + 1; });
    return map;
  }, [allIssues]);

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Solutions QA — Admin</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <ChapterQAReportExporter />
          {allAssetsChapter !== "all" && chapters?.find(c => c.id === allAssetsChapter) && (
            <Button
              size="sm"
              className="text-xs text-white"
              style={{ backgroundColor: "#14213D" }}
              onClick={() => {
                const ch = chapters!.find(c => c.id === allAssetsChapter)!;
                setAuditChapter({ id: ch.id, name: `Ch ${ch.chapter_number}: ${ch.chapter_name}` });
              }}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Audit This Chapter →
            </Button>
          )}
        </div>

        {auditChapter && (
          <ChapterAuditPanel
            chapterId={auditChapter.id}
            chapterName={auditChapter.name}
            onDismiss={() => setAuditChapter(null)}
          />
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-8 gap-2">
          {[
            { label: "Total", value: safeCount.total, color: "text-foreground", bg: "" },
            { label: "Pending", value: safeCount.pending, color: "text-muted-foreground", bg: "" },
            { label: "Clean", value: safeCount.clean, color: "text-emerald-400", bg: "" },
            { label: "Issues", value: safeCount.issues, color: "text-amber-400", bg: "" },
            { label: "Needs Lee", value: safeCount.needsLee, color: "text-amber-900", bg: "bg-amber-400/20 border-amber-500/40" },
            { label: "Fix Approved", value: safeCount.fixApproved, color: "text-blue-400", bg: "" },
            { label: "Generated", value: safeCount.generated, color: "text-purple-400", bg: "" },
            { label: "⚡ Bulk Fixes", value: bulkFixesReady, color: "text-amber-900", bg: "bg-amber-400/30 border-amber-500/40" },
          ].map(c => (
            <Card key={c.label} className={`${c.bg || "bg-card/50"}`}>
              <CardContent className="p-3 text-center">
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-[10px] text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* View in Inbox link */}
        {safeCount.issues > 0 && (
          <div className="flex items-center gap-2">
            <Link
              to="/inbox"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Inbox className="h-3.5 w-3.5" /> View Issues in Inbox →
            </Link>
          </div>
        )}

        {/* Generate Prompt section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Generate Prompt ({approvedIssues.length} fixes ready)</p>
            <Button size="sm" className="text-xs" onClick={generatePrompt} disabled={approvedIssues.length === 0}>
              <Sparkles className="h-3 w-3 mr-1" /> Generate Lovable Prompt
            </Button>
          </div>

          {generatedPrompt && (
            <div className="space-y-3">
              <Textarea value={generatedPrompt} readOnly className="text-xs font-mono min-h-[300px] bg-muted/30" />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => { navigator.clipboard.writeText(generatedPrompt); toast.success("Copied"); }}>
                  <Copy className="h-3 w-3 mr-1" /> Copy Prompt
                </Button>
                <Button size="sm" className="text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={() => markGeneratedMutation.mutate()} disabled={markGeneratedMutation.isPending}>
                  <FileText className="h-3 w-3 mr-1" /> Mark All as Generated
                </Button>
              </div>
            </div>
          )}

          {approvedIssues.length > 0 && !generatedPrompt && (
            <div className="space-y-2">
              {approvedIssues.map(r => (
                <div key={r.id} className="flex items-center gap-2 text-xs text-muted-foreground border-b border-border pb-2">
                  <span className="font-mono font-medium text-foreground">{r.asset_name}</span>
                  <Badge variant="outline" className="text-[9px]">{r.section === "Solution" ? "Explanation" : r.section}</Badge>
                  {r.fix_scope === "bulk_pattern" && (
                    <Badge className="bg-amber-500/20 text-amber-400 text-[8px]">⚡ Bulk</Badge>
                  )}
                  <span>— {r.fix_description || r.issue_description}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* All Assets table */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">All Assets ({safeCount.total})</p>
            <div className="ml-auto flex items-center gap-2">
              <Select value={allAssetsFilter} onValueChange={v => handleFilterChange(setAllAssetsFilter, v)}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed_clean">Clean</SelectItem>
                  <SelectItem value="reviewed_issues">Issues</SelectItem>
                  <SelectItem value="fix_approved">Fix Approved</SelectItem>
                  <SelectItem value="fix_generated">Generated</SelectItem>
                  <SelectItem value="pending_lee_review">Pending Review 🔍</SelectItem>
                </SelectContent>
              </Select>
              <Select value={allAssetsChapter} onValueChange={v => handleFilterChange(setAllAssetsChapter, v)}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All chapters</SelectItem>
                  {chapters?.map(ch => <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {allAssetsFiltered.length} loaded{hasNextPage ? " (more available)" : ""}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium">Asset</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Reviewed By</th>
                  <th className="text-left px-3 py-2 font-medium">Issues</th>
                </tr>
              </thead>
              <tbody>
                {allAssetsFiltered.map(r => (
                  <tr
                    key={r.id}
                    ref={highlightAsset === r.id ? highlightRef : undefined}
                    className={`border-b border-border/50 hover:bg-muted/10 transition-colors ${
                      highlightAsset === r.id ? "ring-2 ring-primary bg-primary/10" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono">
                      {r.asset_name}
                      {bulkAssetIds.has(r.id) && (
                        <Badge className="ml-1.5 bg-amber-500/20 text-amber-400 text-[8px]">Bulk</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 flex items-center gap-1 flex-wrap">
                      {statusBadge(r.qa_status)}
                      {(() => {
                        const fs = adminFixStatusMap?.[(r as any).teaching_asset_id];
                        if (!fs) return null;
                        const fsColors: Record<string, { bg: string; text: string; label: string }> = {
                          pending_fix: { bg: "rgba(245,158,11,0.2)", text: "#D97706", label: "Pending Fix" },
                          fix_applied: { bg: "rgba(59,130,246,0.2)", text: "#3B82F6", label: "Fix Applied" },
                          fix_verified: { bg: "rgba(16,185,129,0.2)", text: "#10B981", label: "Verified ✓" },
                          still_has_issues: { bg: "rgba(239,68,68,0.2)", text: "#EF4444", label: "Still Has Issues" },
                          needs_lee: { bg: "rgba(249,115,22,0.2)", text: "#F97316", label: "Needs Lee 🚩" },
                          pending_lee_review: { bg: "rgba(139,92,246,0.2)", text: "#8B5CF6", label: "Pending Review 🔍" },
                          ready_for_students: { bg: "rgba(16,185,129,0.2)", text: "#10B981", label: "Ready ✓" },
                        };
                        const style = fsColors[fs];
                        if (!style) return null;
                        return <Badge className="text-[8px]" style={{ backgroundColor: style.bg, color: style.text }}>{style.label}</Badge>;
                      })()}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.reviewed_by || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{issueCountMap[r.id] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading…</>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-3xl">
          {expandedImage && <img src={expandedImage} alt="Expanded screenshot" className="w-full rounded" />}
        </DialogContent>
      </Dialog>

      {fixPanelAsset && (
        <FixThisAssetPanel
          assetName={fixPanelAsset.assetName}
          assetCode={fixPanelAsset.assetName}
          teachingAssetId={fixPanelAsset.teachingAssetId}
          onClose={() => {
            setFixPanelAsset(null);
            qc.invalidateQueries({ queryKey: ["qa-admin-issues"] });
            qc.invalidateQueries({ queryKey: ["qa-admin-counts"] });
          }}
        />
      )}
    </SurviveSidebarLayout>
  );
}
