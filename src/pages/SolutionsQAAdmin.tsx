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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2, Copy, FileText, Sparkles, Zap, Target, Loader2,
  Wrench, X, RotateCcw, Check, ChevronDown, ChevronUp, ExternalLink,
  Mail, Send,
} from "lucide-react";
import { toast } from "sonner";
import { WHITELISTED_EMAILS } from "@/lib/emailWhitelist";

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

type StudentIssue = {
  id: string;
  chapter_id: string;
  asset_name: string | null;
  question: string;
  student_email: string;
  student_name: string | null;
  responded: boolean;
  responded_at: string | null;
  created_at: string;
  source_ref: string | null;
  fixed: boolean;
};

type StatusCounts = {
  total: number;
  pending: number;
  clean: number;
  issues: number;
  fixApproved: number;
  generated: number;
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

// ── Fix Email Preview Modal ──────────────────────────────────────────

function FixEmailModal({
  issue,
  onClose,
  onSent,
}: {
  issue: StudentIssue;
  onClose: () => void;
  onSent: () => void;
}) {
  const [sending, setSending] = useState<"test" | "real" | null>(null);

  const assetCode = issue.asset_name || "unknown";
  const emailParts = issue.student_email?.split("@")[0] || "";
  const firstName = emailParts
    ? emailParts.charAt(0).toUpperCase() + emailParts.slice(1).replace(/[._\d]/g, "")
    : "there";
  const displayFirst = firstName.length >= 2 ? firstName : "there";

  const subject = `Fixed — ${assetCode} on Survive Accounting`;
  const previewUrl = `learn.surviveaccounting.com/solutions/${assetCode}`;

  const sendEmail = async (isTest: boolean) => {
    setSending(isTest ? "test" : "real");
    try {
      const { data, error } = await supabase.functions.invoke("send-fix-email", {
        body: {
          to: issue.student_email,
          subject,
          assetCode,
          firstName: displayFirst,
          isTest,
          questionId: issue.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(isTest ? "Test email sent to Lee" : "Fix email sent to student");
      if (!isTest) onSent();
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSending(null);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4" /> Preview Fix Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs space-y-1">
            <p><span className="font-bold text-muted-foreground">To:</span> {issue.student_email}</p>
            <p><span className="font-bold text-muted-foreground">Subject:</span> {subject}</p>
          </div>

          <div className="rounded-md border border-border bg-muted/20 p-4 text-sm leading-relaxed space-y-3">
            <p>Hey {displayFirst},</p>
            <p>Thanks for flagging that — I appreciate it. I've improved that problem and it should make more sense now.</p>
            <p>
              You can view the updated version here:<br />
              <a href={`https://${previewUrl}`} className="text-primary font-bold hover:underline" target="_blank" rel="noopener noreferrer">
                {previewUrl}
              </a>
            </p>
            <p>— Lee</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={!!sending}
            onClick={() => sendEmail(true)}
          >
            {sending === "test" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
            Send Test Email →
          </Button>
          <Button
            size="sm"
            className="text-xs"
            disabled={!!sending}
            onClick={() => sendEmail(false)}
          >
            {sending === "real" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
            Send to Student →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Fix Asset Modal ──────────────────────────────────────────────────

function FixAssetModal({
  issue,
  onClose,
  onComplete,
}: {
  issue: QAIssue;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<FixStep>("input");
  const [fixPrompt, setFixPrompt] = useState(issue.issue_description || "");
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [runProgress, setRunProgress] = useState<Record<string, "pending" | "running" | "done" | "error">>({});
  const [snapshot, setSnapshot] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [afterData, setAfterData] = useState<Record<string, Record<string, unknown>> | null>(null);
  const [runResults, setRunResults] = useState<{ key: string; ok: boolean; error?: string }[]>([]);
  const [attemptNumber, setAttemptNumber] = useState(1);

  const { data: qaAsset } = useQuery({
    queryKey: ["fix-qa-asset", issue.qa_asset_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solutions_qa_assets" as any)
        .select("teaching_asset_id, asset_name")
        .eq("id", issue.qa_asset_id)
        .single();
      if (error) throw error;
      return data as unknown as { teaching_asset_id: string; asset_name: string };
    },
  });

  const teachingAssetId = qaAsset?.teaching_asset_id;
  const canRun = fixPrompt.trim().length >= 20 && selectedSections.size > 0 && !!teachingAssetId;

  const toggleSection = (key: string) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedSections.size === FIX_SECTIONS.length) {
      setSelectedSections(new Set());
    } else {
      setSelectedSections(new Set(FIX_SECTIONS.map(s => s.key)));
    }
  };

  const runFix = async () => {
    if (!teachingAssetId) return;
    const sections = [...selectedSections];
    setStep("running");
    const progress: Record<string, "pending" | "running" | "done" | "error"> = {};
    sections.forEach(s => { progress[s] = "pending"; });
    setRunProgress({ ...progress });

    try {
      sections.forEach(s => { progress[s] = "running"; });
      setRunProgress({ ...progress });
      const snapRes = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, sections, action: "snapshot" },
      });
      if (snapRes.error) throw new Error(snapRes.error.message);
      setSnapshot(snapRes.data.snapshot);

      const runRes = await supabase.functions.invoke("fix-asset", {
        body: {
          teaching_asset_id: teachingAssetId,
          sections,
          fix_prompt: fixPrompt.trim(),
          action: "run",
          attempt_number: attemptNumber,
        },
      });
      if (runRes.error) throw new Error(runRes.error.message);

      const results = runRes.data.results as { key: string; ok: boolean; error?: string }[];
      setRunResults(results);
      setAfterData(runRes.data.after);
      results.forEach(r => { progress[r.key] = r.ok ? "done" : "error"; });
      setRunProgress({ ...progress });
      setStep("compare");
    } catch (err: any) {
      toast.error("Fix failed: " + err.message);
      setStep("input");
    }
  };

  const approveChanges = async () => {
    if (!teachingAssetId) return;
    try {
      const res = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, fix_prompt: fixPrompt.trim(), action: "approve" },
      });
      if (res.error) throw new Error(res.error.message);
      await supabase.from("solutions_qa_issues" as any).update({
        fix_status: "approved",
        fix_description: fixPrompt.trim(),
      }).eq("id", issue.id);
      toast.success("Changes approved and saved");
      setStep("done");
      onComplete();
    } catch (err: any) {
      toast.error("Approve failed: " + err.message);
    }
  };

  const rejectChanges = async () => {
    if (!teachingAssetId || !snapshot) return;
    try {
      const res = await supabase.functions.invoke("fix-asset", {
        body: { teaching_asset_id: teachingAssetId, snapshot, action: "restore" },
      });
      if (res.error) throw new Error(res.error.message);
      toast.info("Changes reverted — try again");
      setAttemptNumber(prev => prev + 1);
      setStep("input");
      setRunResults([]);
      setAfterData(null);
    } catch (err: any) {
      toast.error("Restore failed: " + err.message);
    }
  };

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return "(empty)";
    if (typeof val === "string") return val.length > 500 ? val.slice(0, 500) + "…" : val;
    return JSON.stringify(val, null, 2);
  };

  return (
    <Dialog open onOpenChange={() => { if (step !== "running") onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Fix This Asset
            </h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{issue.asset_name} · {issue.section}</p>
          </div>
          {attemptNumber > 1 && (
            <Badge variant="outline" className="text-[10px]">Attempt #{attemptNumber} (stronger model)</Badge>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3">
            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Reported Issue</p>
            <p className="text-xs text-foreground">{issue.issue_description}</p>
            {issue.suggested_fix && (
              <p className="text-xs text-muted-foreground mt-1 italic">Suggested: {issue.suggested_fix}</p>
            )}
          </div>

          {issue.screenshot_url && (
            <img src={issue.screenshot_url} alt="Issue screenshot" className="max-h-32 rounded border border-border" />
          )}

          <a
            href={`/solutions/${issue.asset_name}?admin=true`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            View Asset → <ExternalLink className="h-3 w-3" />
          </a>

          {step === "input" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">What's wrong and how to fix it</label>
                <Textarea
                  value={fixPrompt}
                  onChange={e => setFixPrompt(e.target.value)}
                  placeholder="e.g. The supplementary JE for bond issuance is missing Interest Payable..."
                  className="text-xs min-h-[80px]"
                />
                <p className="text-[10px] text-muted-foreground">
                  {fixPrompt.trim().length < 20 ? `${20 - fixPrompt.trim().length} more characters needed` : "✓ Ready"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">Sections to regenerate</label>
                  <button onClick={selectAll} className="text-[10px] text-primary hover:underline font-medium">
                    {selectedSections.size === FIX_SECTIONS.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="space-y-1.5">
                  {FIX_SECTIONS.map(sec => (
                    <label key={sec.key} className="flex items-center gap-2 cursor-pointer group">
                      <Checkbox checked={selectedSections.has(sec.key)} onCheckedChange={() => toggleSection(sec.key)} />
                      <span className="text-xs text-foreground group-hover:text-primary transition-colors">{sec.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={runFix} disabled={!canRun} className="w-full">
                <Wrench className="h-3.5 w-3.5 mr-1.5" /> Run Fix →
              </Button>
            </>
          )}

          {step === "running" && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground">Regenerating sections…</p>
              {FIX_SECTIONS.filter(s => selectedSections.has(s.key)).map(sec => {
                const status = runProgress[sec.key] || "pending";
                return (
                  <div key={sec.key} className="flex items-center gap-2 text-xs">
                    {status === "running" || status === "pending" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : status === "done" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className={status === "done" ? "text-muted-foreground" : "text-foreground"}>{sec.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {step === "compare" && snapshot && afterData && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-foreground">Review Changes</p>
              {runResults.filter(r => !r.ok).length > 0 && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                  <p className="text-[10px] font-bold text-destructive">Some sections failed:</p>
                  {runResults.filter(r => !r.ok).map(r => (
                    <p key={r.key} className="text-[10px] text-destructive">{r.key}: {r.error}</p>
                  ))}
                </div>
              )}

              {[...selectedSections].map(sectionKey => {
                const before = snapshot[sectionKey] || {};
                const after = afterData[sectionKey] || {};
                const sec = FIX_SECTIONS.find(s => s.key === sectionKey);
                const result = runResults.find(r => r.key === sectionKey);
                if (!result?.ok) return null;
                return (
                  <CompareSection key={sectionKey} label={sec?.label || sectionKey} before={before} after={after} formatValue={formatValue} />
                );
              })}

              <div className="flex gap-2 pt-2">
                <Button onClick={approveChanges} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Check className="h-3.5 w-3.5 mr-1" /> Approve Changes
                </Button>
                <Button onClick={rejectChanges} variant="outline" className="flex-1">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reject & Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Compare Section ──────────────────────────────────────────────────

function CompareSection({
  label,
  before,
  after,
  formatValue,
}: {
  label: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  formatValue: (val: unknown) => string;
}) {
  const [expanded, setExpanded] = useState(true);
  const cols = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 text-xs font-bold text-foreground hover:bg-muted/50 transition-colors"
      >
        {label}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Before</p>
            {cols.map(col => (
              <div key={col}>
                <p className="text-[9px] font-mono text-muted-foreground">{col}</p>
                <ScrollArea className="max-h-[200px]">
                  <pre className="text-[11px] text-foreground whitespace-pre-wrap break-words">{formatValue(before[col])}</pre>
                </ScrollArea>
              </div>
            ))}
          </div>
          <div className="p-3 space-y-2 bg-emerald-500/5">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">After (proposed)</p>
            {cols.map(col => {
              const changed = formatValue(before[col]) !== formatValue(after[col]);
              return (
                <div key={col}>
                  <p className="text-[9px] font-mono text-muted-foreground">{col}</p>
                  <ScrollArea className="max-h-[200px]">
                    <pre className={`text-[11px] whitespace-pre-wrap break-words ${changed ? "text-emerald-700 bg-emerald-500/10 rounded px-1" : "text-foreground"}`}>
                      {formatValue(after[col])}
                    </pre>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [emailIssue, setEmailIssue] = useState<StudentIssue | null>(null);

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

  const { data: urgentCount } = useQuery({
    queryKey: ["qa-admin-urgent-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_questions")
        .select("id, student_email")
        .eq("issue_type", "issue")
        .eq("responded", false);
      if (error) throw error;
      const studentOnly = (data || []).filter(
        (r) => !WHITELISTED_EMAILS.includes((r.student_email || "").trim().toLowerCase())
      );
      return studentOnly.length;
    },
  });

  const safeCount = counts ?? { total: 0, pending: 0, clean: 0, issues: 0, fixApproved: 0, generated: 0 };

  // ── Student-reported issues ──
  const { data: studentIssues } = useQuery({
    queryKey: ["qa-admin-student-issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_questions")
        .select("*")
        .eq("issue_type", "issue")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const studentOnly = (data || []).filter(
        (r: any) => !WHITELISTED_EMAILS.includes((r.student_email || "").trim().toLowerCase())
      );
      return studentOnly as StudentIssue[];
    },
  });

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

  const pendingIssues = useMemo(() => allIssues?.filter(i => i.fix_status === "pending") || [], [allIssues]);
  const approvedIssues = useMemo(() => allIssues?.filter(i => i.fix_status === "approved") || [], [allIssues]);

  const bulkAssetIds = useMemo(() => {
    const ids = new Set<string>();
    allIssues?.forEach(i => { if (i.fix_scope === "bulk_pattern") ids.add(i.qa_asset_id); });
    return ids;
  }, [allIssues]);

  // Merged issues list: URGENT student issues on top, then QA review issues
  const mergedIssuesList = useMemo(() => {
    const urgentRows = (studentIssues || [])
      .filter(si => !si.responded)
      .map(si => ({ type: "urgent" as const, data: si, created_at: si.created_at }));

    const qaRows = pendingIssues.map(qi => ({ type: "qa" as const, data: qi, created_at: "" }));

    // Urgent first, then QA
    return [...urgentRows, ...qaRows];
  }, [studentIssues, pendingIssues]);

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("solutions_qa_issues" as any).update({ fix_status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-admin-issues"] });
      toast.success("Issue rejected");
    },
  });

  const markFixedMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapter_questions").update({
        responded: true,
        responded_at: new Date().toISOString(),
        fixed: true,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-admin-student-issues"] });
      qc.invalidateQueries({ queryKey: ["qa-admin-urgent-count"] });
      toast.success("Marked as fixed");
    },
  });

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
        <div className="grid grid-cols-8 gap-2">
          {[
            { label: "Total", value: safeCount.total, color: "text-foreground", bg: "" },
            { label: "Pending", value: safeCount.pending, color: "text-muted-foreground", bg: "" },
            { label: "Clean", value: safeCount.clean, color: "text-emerald-400", bg: "" },
            { label: "Issues", value: safeCount.issues, color: "text-amber-400", bg: "" },
            { label: "Urgent", value: urgentCount ?? 0, color: "text-white", bg: "bg-red-600/80 border-red-500/60" },
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
            <TabsTrigger value="issues" className="text-xs">
              Issues ({mergedIssuesList.length})
            </TabsTrigger>
            <TabsTrigger value="prompt" className="text-xs">Generate Prompt ({approvedIssues.length})</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">All Assets ({safeCount.total})</TabsTrigger>
          </TabsList>

          {/* TAB 1: Issues — merged urgent + QA */}
          <TabsContent value="issues" className="space-y-3 mt-3">
            {mergedIssuesList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No issues to review.</p>
            ) : mergedIssuesList.map(row => {
              if (row.type === "urgent") {
                const si = row.data as StudentIssue;
                return (
                  <Card key={`student-${si.id}`} className="bg-card/50 border-red-500/30">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-red-600 text-white text-[10px] font-bold">URGENT</Badge>
                        {si.asset_name && (
                          <a
                            href={`/solutions/${si.asset_name}?admin=true`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono font-bold text-sm text-primary hover:underline flex items-center gap-0.5"
                          >
                            {si.asset_name} <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {new Date(si.created_at).toLocaleDateString()} {new Date(si.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
                        <p className="text-xs text-foreground">{si.question}</p>
                        {si.student_email && (
                          <p className="text-[10px] text-muted-foreground mt-1">{si.student_email}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                          <Checkbox
                            checked={si.responded}
                            onCheckedChange={() => markFixedMutation.mutate(si.id)}
                            disabled={si.responded}
                          />
                          <span className={si.responded ? "text-emerald-400" : "text-foreground"}>✓ Fixed</span>
                        </label>

                        {si.student_email && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs ml-auto gap-1"
                            onClick={() => setEmailIssue(si)}
                          >
                            <Mail className="h-3 w-3" /> Send Fix Email →
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              // QA Review issue
              const issue = row.data as QAIssue;
              const scope = getScope(issue);
              return (
                <Card key={`qa-${issue.id}`} className="bg-card/50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-muted text-muted-foreground text-[10px]">QA Review</Badge>
                      <span className="font-mono font-bold text-sm text-foreground">{issue.asset_name}</span>
                      <Badge variant="outline" className="text-[10px]">{issue.section}</Badge>
                      <a
                        href={`/solutions/${issue.asset_name}?admin=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-[10px] text-primary hover:underline flex items-center gap-0.5"
                      >
                        View Asset <ExternalLink className="h-2.5 w-2.5" />
                      </a>
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

                    <div className="space-y-1">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setFixScopes(prev => ({ ...prev, [issue.id]: "asset_specific" }))}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                            scope === "asset_specific" ? "bg-muted text-foreground border border-border" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Target className="h-3 w-3" /> This Asset Only
                        </button>
                        <button
                          onClick={() => setFixScopes(prev => ({ ...prev, [issue.id]: "bulk_pattern" }))}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                            scope === "bulk_pattern" ? "bg-amber-500/30 text-amber-200 border border-amber-500/40 font-bold" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Zap className="h-3 w-3" /> Apply System-Wide
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="text-xs" onClick={() => setFixIssue(issue)}>
                        <Wrench className="h-3 w-3 mr-1" /> Fix This Asset →
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => rejectMutation.mutate(issue.id)}>
                        Dismiss
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

      {fixIssue && (
        <FixAssetModal
          issue={fixIssue}
          onClose={() => setFixIssue(null)}
          onComplete={() => {
            setFixIssue(null);
            qc.invalidateQueries({ queryKey: ["qa-admin-issues"] });
            qc.invalidateQueries({ queryKey: ["qa-admin-counts"] });
          }}
        />
      )}

      {emailIssue && (
        <FixEmailModal
          issue={emailIssue}
          onClose={() => setEmailIssue(null)}
          onSent={() => {
            setEmailIssue(null);
            qc.invalidateQueries({ queryKey: ["qa-admin-student-issues"] });
            qc.invalidateQueries({ queryKey: ["qa-admin-urgent-count"] });
          }}
        />
      )}
    </SurviveSidebarLayout>
  );
}
