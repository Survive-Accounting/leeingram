import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CheckCircle2, Copy, FileText, Sparkles, Zap, Target, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
};

const PAGE_SIZE = 100;

export default function SolutionsQAAdmin() {
  const qc = useQueryClient();
  const [fixDescriptions, setFixDescriptions] = useState<Record<string, string>>({});
  const [fixScopes, setFixScopes] = useState<Record<string, string>>({});
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [promptIds, setPromptIds] = useState<string[]>([]);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [allAssetsFilter, setAllAssetsFilter] = useState<string>("all");
  const [allAssetsChapter, setAllAssetsChapter] = useState<string>("all");
  const [highlightAsset, setHighlightAsset] = useState<string | null>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  // ── Server-side COUNT query for summary cards ──
  const { data: counts } = useQuery<StatusCounts>({
    queryKey: ["qa-admin-counts"],
    queryFn: async () => {
      // Use individual count queries since we can't do SQL aggregates via JS client
      const base = supabase.from("solutions_qa_assets" as any);
      const [total, pending, clean, issues, fixApproved, generated] = await Promise.all([
        base.select("id", { count: "exact", head: true }),
        base.select("id", { count: "exact", head: true }).eq("qa_status", "pending"),
        base.select("id", { count: "exact", head: true }).eq("qa_status", "reviewed_clean"),
        base.select("id", { count: "exact", head: true }).eq("qa_status", "reviewed_issues"),
        base.select("id", { count: "exact", head: true }).eq("qa_status", "fix_approved"),
        base.select("id", { count: "exact", head: true }).eq("qa_status", "fix_generated"),
      ]);
      return {
        total: total.count ?? 0,
        pending: pending.count ?? 0,
        clean: clean.count ?? 0,
        issues: issues.count ?? 0,
        fixApproved: fixApproved.count ?? 0,
        generated: generated.count ?? 0,
      };
    },
  });

  const safeCount = counts ?? { total: 0, pending: 0, clean: 0, issues: 0, fixApproved: 0, generated: 0 };

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

  // Reset pagination when filters change
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

  const pendingIssues = useMemo(() => allIssues?.filter(i => i.fix_status === "pending") || [], [allIssues]);
  const approvedIssues = useMemo(() => allIssues?.filter(i => i.fix_status === "approved") || [], [allIssues]);

  const bulkAssetIds = useMemo(() => {
    const ids = new Set<string>();
    allIssues?.forEach(i => { if (i.fix_scope === "bulk_pattern") ids.add(i.qa_asset_id); });
    return ids;
  }, [allIssues]);

  const approveMutation = useMutation({
    mutationFn: async ({ id, fixDesc, fixScope }: { id: string; fixDesc: string; fixScope: string }) => {
      const { error } = await supabase.from("solutions_qa_issues" as any).update({
        fix_status: "approved",
        fix_description: fixDesc,
        fix_scope: fixScope,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-admin-issues"] });
      toast.success("Fix approved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("solutions_qa_issues" as any).update({
        fix_status: "rejected",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-admin-issues"] });
      toast.success("Issue rejected");
    },
  });

  const generatePrompt = () => {
    if (approvedIssues.length === 0) return;

    const bulkIssues = approvedIssues.filter(i => i.fix_scope === "bulk_pattern");
    const assetIssues = approvedIssues.filter(i => i.fix_scope !== "bulk_pattern");

    const parts: string[] = [
      `Read src/pages/SolutionsViewer.tsx and src/components/SolutionTextRenderer.tsx fully before making any changes.`,
    ];

    if (bulkIssues.length > 0) {
      const lines = bulkIssues.map((r, i) =>
        `${i + 1}. [${r.section}]: ${r.fix_description || r.issue_description}`
      );
      parts.push(`\n━━━ SYSTEM-WIDE FIXES ━━━\n\nApply these fixes globally across ALL assets. These are formatting pattern fixes that affect every asset where this pattern appears:\n\n${lines.join("\n\n")}`);
    }

    if (assetIssues.length > 0) {
      const lines = assetIssues.map((r, i) =>
        `${i + 1}. **${r.asset_name}** — [${r.section}]: ${r.fix_description || r.issue_description}`
      );
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
    };
    return <Badge className={`text-[10px] ${colors[s] || colors.pending}`}>{s.replace(/_/g, " ")}</Badge>;
  };

  const issueCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    allIssues?.forEach(i => { map[i.qa_asset_id] = (map[i.qa_asset_id] || 0) + 1; });
    return map;
  }, [allIssues]);

  const getScope = (issue: QAIssue) => fixScopes[issue.id] ?? issue.fix_scope ?? "asset_specific";

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Solutions QA — Admin</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-7 gap-2">
          {[
            { label: "Total", value: safeCount.total, color: "text-foreground", bg: "" },
            { label: "Pending", value: safeCount.pending, color: "text-muted-foreground", bg: "" },
            { label: "Clean", value: safeCount.clean, color: "text-emerald-400", bg: "" },
            { label: "Issues", value: safeCount.issues, color: "text-amber-400", bg: "" },
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

        <Tabs defaultValue="issues">
          <TabsList>
            <TabsTrigger value="issues" className="text-xs">Issues to Review ({pendingIssues.length})</TabsTrigger>
            <TabsTrigger value="prompt" className="text-xs">Generate Prompt ({approvedIssues.length})</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">All Assets ({safeCount.total})</TabsTrigger>
          </TabsList>

          {/* TAB 1: Issues */}
          <TabsContent value="issues" className="space-y-3 mt-3">
            {pendingIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No issues to review.</p>
            ) : pendingIssues.map(issue => {
              const scope = getScope(issue);
              return (
                <Card key={issue.id} className="bg-card/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">{issue.asset_name}</span>
                      <Badge variant="outline" className="text-[10px]">{issue.section}</Badge>
                    </div>

                    <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
                      <p className="text-xs text-amber-300">{issue.issue_description}</p>
                      {issue.suggested_fix && (
                        <p className="text-xs text-muted-foreground mt-1 italic">Suggested: {issue.suggested_fix}</p>
                      )}
                    </div>

                    {issue.screenshot_url && (
                      <img
                        src={issue.screenshot_url}
                        alt="Issue screenshot"
                        className="max-h-32 rounded border border-border cursor-pointer hover:opacity-80"
                        onClick={() => setExpandedImage(issue.screenshot_url)}
                      />
                    )}

                    <Textarea
                      value={fixDescriptions[issue.id] ?? issue.issue_description ?? ""}
                      onChange={e => setFixDescriptions(prev => ({ ...prev, [issue.id]: e.target.value }))}
                      placeholder="Edit fix description..."
                      className="text-xs min-h-[60px]"
                    />

                    {/* Fix scope toggle */}
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setFixScopes(prev => ({ ...prev, [issue.id]: "asset_specific" }))}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                            scope === "asset_specific"
                              ? "bg-muted text-foreground border border-border"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Target className="h-3 w-3" /> This Asset Only
                        </button>
                        <button
                          onClick={() => setFixScopes(prev => ({ ...prev, [issue.id]: "bulk_pattern" }))}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                            scope === "bulk_pattern"
                              ? "bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Zap className="h-3 w-3" /> Apply System-Wide
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground pl-1">
                        {scope === "asset_specific"
                          ? `Fix will only be applied to ${issue.asset_name}`
                          : "Fix will be applied across ALL assets with this pattern — use for formatting rules, not content-specific issues"}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                        onClick={() => approveMutation.mutate({
                          id: issue.id,
                          fixDesc: fixDescriptions[issue.id] ?? issue.issue_description ?? "",
                          fixScope: scope,
                        })}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Approve Fix
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => rejectMutation.mutate(issue.id)}>
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* TAB 2: Generate Prompt */}
          <TabsContent value="prompt" className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{approvedIssues.length} fixes ready to compile</p>
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
                    <Badge variant="outline" className="text-[9px]">{r.section}</Badge>
                    {r.fix_scope === "bulk_pattern" && (
                      <Badge className="bg-amber-500/20 text-amber-400 text-[8px]">⚡ Bulk</Badge>
                    )}
                    <span>— {r.fix_description || r.issue_description}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: All Assets (paginated) */}
          <TabsContent value="all" className="space-y-3 mt-3">
            <div className="flex items-center gap-2 mb-3">
              <Select value={allAssetsFilter} onValueChange={v => handleFilterChange(setAllAssetsFilter, v)}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed_clean">Clean</SelectItem>
                  <SelectItem value="reviewed_issues">Issues</SelectItem>
                  <SelectItem value="fix_approved">Fix Approved</SelectItem>
                  <SelectItem value="fix_generated">Generated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={allAssetsChapter} onValueChange={v => handleFilterChange(setAllAssetsChapter, v)}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All chapters</SelectItem>
                  {chapters?.map(ch => <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">
                {allAssetsFiltered.length} loaded{hasNextPage ? " (more available)" : ""}
              </span>
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
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/10">
                      <td className="px-3 py-2 font-mono">
                        {r.asset_name}
                        {bulkAssetIds.has(r.id) && (
                          <Badge className="ml-1.5 bg-amber-500/20 text-amber-400 text-[8px]">Bulk</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">{statusBadge(r.qa_status)}</td>
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
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-3xl">
          {expandedImage && <img src={expandedImage} alt="Expanded screenshot" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </SurviveSidebarLayout>
  );
}
