import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChaptersWithCourses } from "@/hooks/useAdminDashboardData";
import { formatDistanceToNow, format, isToday, isBefore } from "date-fns";
import { CheckCircle2, ExternalLink, AlertTriangle, Wrench, Zap, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { WHITELISTED_EMAILS } from "@/lib/emailWhitelist";

type IssueFilter = "all" | "questions" | "issues" | "feedback" | "quiz_rating" | "qa_issues";
type StatusFilter = "all" | "needs_response" | "responded";
type SenderFilter = "all" | "students" | "vas";

type UnifiedRow = {
  id: string;
  source: "chapter_questions" | "qa_issues";
  issue_type: string;
  question: string;
  student_email: string | null;
  student_name: string | null;
  chapter_id: string;
  asset_name: string | null;
  source_ref: string | null;
  created_at: string;
  responded: boolean;
  responded_at: string | null;
  respond_by_at: string | null;
  status: string;
  fixed: boolean;
  reply_text: string | null;
  // QA-specific fields
  qa_section?: string;
  qa_fix_status?: string;
  qa_fix_scope?: string;
  qa_screenshot_url?: string | null;
  // Urgent flag
  isUrgent?: boolean;
};

const URGENT_KEYWORDS = /wrong|incorrect|error|mistake|doesn't match|doesn't match|off|broken|fix/i;

function isStudentEmail(email: string | null, vaEmailSet: Set<string>): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  if (WHITELISTED_EMAILS.includes(lower)) return false;
  if (vaEmailSet.has(lower)) return false;
  return true;
}

function parseRatingMeta(sourceRef: string | null): { star_rating?: number; topic_name?: string } {
  if (!sourceRef) return {};
  try { return JSON.parse(sourceRef); } catch { return {}; }
}

function RespondByBadge({ respondByAt, responded }: { respondByAt: string | null; responded: boolean }) {
  if (!respondByAt || responded) return null;
  const d = new Date(respondByAt);
  const now = new Date();
  const overdue = isBefore(d, now);
  const dueToday = !overdue && isToday(d);

  const label = format(d, "EEE MMM d · h:mm a");

  if (overdue) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold bg-destructive/15 text-destructive rounded px-1.5 py-0.5">OVERDUE</span>
        <span className="text-[11px] text-destructive font-medium">{label}</span>
      </div>
    );
  }
  if (dueToday) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">DUE TODAY</span>
        <span className="text-[11px] text-amber-600 font-medium">{label}</span>
      </div>
    );
  }
  return <span className="text-[11px] text-muted-foreground">{label}</span>;
}

const issueColors: Record<string, string> = {
  question: "bg-blue-100 text-blue-700",
  issue: "bg-destructive/15 text-destructive",
  feedback: "bg-green-100 text-green-700",
  quiz_rating: "bg-amber-100 text-amber-700",
  qa_issue: "bg-orange-100 text-orange-700",
};

const issueLabels: Record<string, string> = {
  question: "Question",
  issue: "Issue",
  feedback: "Feedback",
  quiz_rating: "Quiz Feedback",
  qa_issue: "QA Issue",
};

export function StudentInbox() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");
  const [senderFilter, setSenderFilter] = useState<SenderFilter>("all");
  const queryClient = useQueryClient();

  const { data: chaptersData } = useChaptersWithCourses();
  const chapters = chaptersData?.chapters || [];
  const courses = chaptersData?.courses || [];

  const chapterMap = useMemo(() => {
    const m: Record<string, { chapter_number: number; chapter_name: string; course_id: string }> = {};
    chapters.forEach((c: any) => { m[c.id] = c; });
    return m;
  }, [chapters]);

  const courseMap = useMemo(() => {
    const m: Record<string, { course_name: string; code: string }> = {};
    courses.forEach((c: any) => { m[c.id] = c; });
    return m;
  }, [courses]);

  const { data: vaEmails = [] } = useQuery({
    queryKey: ["va-emails-set"],
    queryFn: async () => {
      const { data, error } = await supabase.from("va_accounts").select("email");
      if (error) throw error;
      return (data || []).map((v: any) => (v.email as string).toLowerCase());
    },
  });

  const vaEmailSet = useMemo(() => new Set(vaEmails), [vaEmails]);

  // Fetch chapter_questions
  const { data: chapterRows = [], isLoading: isLoadingCQ } = useQuery({
    queryKey: ["admin-student-inbox-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_questions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).filter((r: any) =>
        r.issue_type !== "quiz_rating" || (r.question && r.question.trim() !== "")
      );
    },
  });

  // Fetch QA issues
  const { data: qaIssues = [], isLoading: isLoadingQA } = useQuery({
    queryKey: ["admin-inbox-qa-issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solutions_qa_issues" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch QA assets for chapter mapping
  const { data: qaAssetMap = {} } = useQuery({
    queryKey: ["admin-inbox-qa-asset-map"],
    queryFn: async () => {
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("solutions_qa_assets" as any)
          .select("id, asset_name, chapter_id, course_id")
          .range(from, from + 999);
        if (error) throw error;
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      const m: Record<string, { chapter_id: string; course_id: string; asset_name: string }> = {};
      all.forEach((a: any) => { m[a.id] = a; });
      return m;
    },
  });

  const isLoading = isLoadingCQ || isLoadingQA;

  // Unify rows
  const rows: UnifiedRow[] = useMemo(() => {
    const unified: UnifiedRow[] = [];

    // chapter_questions rows
    chapterRows.forEach((r: any) => {
      const isIssue = r.issue_type === "issue";
      const fromStudent = isStudentEmail(r.student_email, vaEmailSet);
      const hasUrgentKeyword = isIssue && URGENT_KEYWORDS.test(r.question || "");
      const urgent = isIssue && fromStudent && hasUrgentKeyword;

      unified.push({
        id: r.id,
        source: "chapter_questions",
        issue_type: r.issue_type,
        question: r.question,
        student_email: r.student_email,
        student_name: r.student_name,
        chapter_id: r.chapter_id,
        asset_name: r.asset_name,
        source_ref: r.source_ref,
        created_at: r.created_at,
        responded: !!r.responded,
        responded_at: r.responded_at,
        respond_by_at: r.respond_by_at,
        status: r.status,
        fixed: !!r.fixed,
        reply_text: r.reply_text,
        isUrgent: urgent,
      });
    });

    // QA issues
    qaIssues.forEach((qi: any) => {
      const qaAsset = qaAssetMap[qi.qa_asset_id];
      const isResolved = qi.fix_status === "approved" || qi.fix_status === "generated" || qi.fix_status === "rejected";
      unified.push({
        id: `qa_${qi.id}`,
        source: "qa_issues",
        issue_type: "qa_issue",
        question: qi.issue_description,
        student_email: null,
        student_name: qi.fix_status === "pending" ? "QA Review" : `QA Review (${qi.fix_status})`,
        chapter_id: qaAsset?.chapter_id || "",
        asset_name: qi.asset_name,
        source_ref: null,
        created_at: qi.created_at,
        responded: isResolved,
        responded_at: isResolved ? qi.created_at : null,
        respond_by_at: null,
        status: qi.fix_status,
        fixed: qi.fix_status === "approved" || qi.fix_status === "generated",
        reply_text: qi.fix_description,
        qa_section: qi.section,
        qa_fix_status: qi.fix_status,
        qa_fix_scope: qi.fix_scope,
        qa_screenshot_url: qi.screenshot_url,
      });
    });

    return unified;
  }, [chapterRows, qaIssues, qaAssetMap, vaEmailSet]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "needs_response" && r.responded) return false;
      if (statusFilter === "responded" && !r.responded) return false;
      if (issueFilter !== "all") {
        if (issueFilter === "qa_issues" && r.source !== "qa_issues") return false;
        if (issueFilter === "questions" && r.issue_type !== "question") return false;
        if (issueFilter === "issues" && r.issue_type !== "issue") return false;
        if (issueFilter === "feedback" && r.issue_type !== "feedback") return false;
        if (issueFilter === "quiz_rating" && r.issue_type !== "quiz_rating") return false;
      }
      if (senderFilter !== "all") {
        if (r.source === "qa_issues") {
          if (senderFilter === "students") return false;
        } else {
          const email = (r.student_email || "").toLowerCase();
          const isVa = vaEmailSet.has(email);
          if (senderFilter === "students" && isVa) return false;
          if (senderFilter === "vas" && !isVa) return false;
        }
      }
      return true;
    });
  }, [rows, statusFilter, issueFilter, senderFilter, vaEmailSet]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Urgent items first
      if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
      if (a.responded !== b.responded) return a.responded ? 1 : -1;
      if (!a.responded && !b.responded) {
        const aTime = a.respond_by_at ? new Date(a.respond_by_at).getTime() : Infinity;
        const bTime = b.respond_by_at ? new Date(b.respond_by_at).getTime() : Infinity;
        if (aTime !== bTime) return aTime - bTime;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      const aResp = a.responded_at ? new Date(a.responded_at).getTime() : 0;
      const bResp = b.responded_at ? new Date(b.responded_at).getTime() : 0;
      return bResp - aResp;
    });
  }, [filtered]);

  const unrespondedCount = rows.filter((r) => !r.responded).length;
  const qaIssueCount = rows.filter((r) => r.source === "qa_issues" && !r.responded).length;
  const urgentCount = rows.filter((r) => r.isUrgent && !r.responded).length;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const respondedThisWeek = rows.filter((r) => r.responded && r.responded_at && new Date(r.responded_at) >= weekAgo).length;

  const handleToggleResponded = async (row: UnifiedRow) => {
    if (row.source === "qa_issues") {
      const realId = row.id.replace("qa_", "");
      const newStatus = row.responded ? "pending" : "approved";
      const { error } = await supabase
        .from("solutions_qa_issues" as any)
        .update({ fix_status: newStatus })
        .eq("id", realId);
      if (error) {
        toast.error("Failed to update", { description: error.message });
        return;
      }
      toast.success(newStatus === "approved" ? "Marked as resolved ✓" : "Reopened");
      queryClient.invalidateQueries({ queryKey: ["admin-inbox-qa-issues"] });
      return;
    }

    const updates: any = { responded: !row.responded };
    if (!row.responded) {
      updates.responded_at = new Date().toISOString();
      updates.status = "replied";
    } else {
      updates.responded_at = null;
      updates.status = "new";
    }
    const { error } = await supabase.from("chapter_questions").update(updates).eq("id", row.id);
    if (error) {
      toast.error("Failed to update", { description: error.message });
      return;
    }
    if (!row.responded) {
      toast.success("Marked as responded ✓");
    } else {
      toast("Reopened — marked as not responded");
    }
    queryClient.invalidateQueries({ queryKey: ["admin-student-inbox-v2"] });
  };

  const handleToggleFixed = async (row: UnifiedRow) => {
    if (row.source === "qa_issues") {
      const realId = row.id.replace("qa_", "");
      const newStatus = row.fixed ? "pending" : "approved";
      const { error } = await supabase
        .from("solutions_qa_issues" as any)
        .update({ fix_status: newStatus })
        .eq("id", realId);
      if (error) {
        toast.error("Failed to update", { description: error.message });
        return;
      }
      toast.success(!row.fixed ? "Marked as fixed ✓" : "Unmarked fixed");
      queryClient.invalidateQueries({ queryKey: ["admin-inbox-qa-issues"] });
      return;
    }

    const { error } = await supabase.from("chapter_questions").update({ fixed: !row.fixed } as any).eq("id", row.id);
    if (error) {
      toast.error("Failed to update", { description: error.message });
      return;
    }
    toast.success(!row.fixed ? "Marked as fixed ✓" : "Unmarked fixed");
    queryClient.invalidateQueries({ queryKey: ["admin-student-inbox-v2"] });
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Sender tabs */}
        <div className="flex items-center gap-1 border-b border-border">
          {(["all", "students", "vas"] as SenderFilter[]).map((tab) => {
            const labels: Record<SenderFilter, string> = { all: "All", students: "Students", vas: "VAs" };
            const isActive = senderFilter === tab;
            return (
              <button
                key={tab}
                onClick={() => setSenderFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Inbox</span>
            {unrespondedCount > 0 ? (
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold px-1.5">
                {unrespondedCount}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full bg-green-100 text-green-700 text-[11px] font-bold px-1.5">
                0
              </span>
            )}
            {qaIssueCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-600">
                {qaIssueCount} QA
              </Badge>
            )}
            {urgentCount > 0 && (
              <Badge className="bg-red-600 text-white text-[10px] font-bold">
                ⚡ {urgentCount} Urgent
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{respondedThisWeek} responded this week</span>

          <div className="ml-auto flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
            >
              <option value="all">All</option>
              <option value="needs_response">Needs Response</option>
              <option value="responded">Responded</option>
            </select>
            <select
              value={issueFilter}
              onChange={e => setIssueFilter(e.target.value as IssueFilter)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
            >
              <option value="all">All Types</option>
              <option value="questions">Questions</option>
              <option value="issues">Issues</option>
              <option value="feedback">Feedback</option>
              <option value="quiz_rating">Quiz Feedback</option>
              <option value="qa_issues">QA Issues</option>
            </select>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : sorted.length === 0 && statusFilter === "all" && issueFilter === "all" ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm text-muted-foreground italic">"All caught up." — Lee</p>
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No messages match this filter.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((row) => {
              const ch = chapterMap[row.chapter_id];
              const co = ch ? courseMap[ch.course_id] : null;
              const isRating = row.issue_type === "quiz_rating";
              const isQA = row.source === "qa_issues";
              const isIssueType = row.issue_type === "issue";
              const ratingMeta = isRating ? parseRatingMeta(row.source_ref) : null;
              const chapterLabel = ch ? `Ch ${ch.chapter_number} — ${ch.chapter_name}` : "";
              const displayEmail = row.student_email && row.student_email !== "anonymous" ? row.student_email : null;

              const overdue = row.respond_by_at && !row.responded && isBefore(new Date(row.respond_by_at), now);
              const dueToday = row.respond_by_at && !row.responded && !overdue && isToday(new Date(row.respond_by_at));

              const borderClass = row.isUrgent && !row.responded
                ? "border-l-4 border-l-red-500"
                : isQA && !row.responded
                ? "border-l-4 border-l-orange-400"
                : overdue
                ? "border-l-4 border-l-destructive"
                : dueToday
                ? "border-l-4 border-l-amber-400"
                : "border-l-4 border-l-transparent";

              const mailtoSubject = encodeURIComponent(
                `Re: Your message about ${isRating && ratingMeta?.topic_name ? ratingMeta.topic_name : chapterLabel}`
              );

              return (
                <div
                  key={row.id}
                  className={`border border-border rounded-lg p-3 bg-card flex gap-4 ${borderClass} ${row.responded ? "opacity-50" : ""}`}
                >
                  {/* Left */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Go to QA Page button for issue-type rows */}
                      {isIssueType && row.asset_name && (
                        <a
                          href={`/solutions-qa?asset=${row.asset_name}`}
                          className="inline-flex items-center rounded text-[12px] font-medium text-white px-2.5 py-1 no-underline"
                          style={{ backgroundColor: "#14213D", borderRadius: "4px", padding: "4px 10px" }}
                        >
                          Go to QA Page →
                        </a>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${issueColors[row.issue_type] || "bg-secondary text-secondary-foreground"}`}>
                        {issueLabels[row.issue_type] || row.issue_type}
                      </span>
                      {row.isUrgent && !row.responded && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white">
                          <Zap className="h-2.5 w-2.5 mr-0.5" /> URGENT
                        </span>
                      )}
                      {isQA && row.qa_section && (
                        <Badge variant="outline" className="text-[9px]">{row.qa_section}</Badge>
                      )}
                      {isQA && row.qa_fix_scope === "bulk_pattern" && (
                        <Badge className="bg-amber-500/20 text-amber-600 text-[8px]">⚡ Bulk</Badge>
                      )}
                      {isRating && ratingMeta?.star_rating && (
                        <span className="text-amber-400 font-bold text-sm">
                          {"★".repeat(ratingMeta.star_rating)}
                          <span className="text-muted-foreground">{"★".repeat(5 - ratingMeta.star_rating)}</span>
                        </span>
                      )}
                    </div>

                    <div>
                      {isQA ? (
                        <span className="text-xs font-bold text-orange-600 font-mono">{row.asset_name}</span>
                      ) : (
                        <>
                          <span className="text-xs font-bold text-foreground">
                            {displayEmail || "Anonymous"}
                          </span>
                          {row.student_name && (
                            <span className="text-[11px] text-muted-foreground ml-2">{row.student_name}</span>
                          )}
                        </>
                      )}
                    </div>

                    {row.question && (
                      <p className="text-[13px] text-foreground">
                        {row.question.length > 120 ? row.question.slice(0, 120) + "…" : row.question}
                      </p>
                    )}

                    {/* QA screenshot thumbnail */}
                    {isQA && row.qa_screenshot_url && (
                      <img src={row.qa_screenshot_url} alt="QA screenshot" className="max-h-16 rounded border border-border" />
                    )}

                    {/* Context */}
                    {isQA ? (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {chapterLabel}{co?.code ? ` · ${co.code}` : ""}
                      </p>
                    ) : (isRating && ratingMeta?.topic_name) ? (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {ratingMeta.topic_name}{chapterLabel ? ` — ${chapterLabel}` : ""}{co?.code ? ` · ${co.code}` : ""}
                      </p>
                    ) : (chapterLabel || row.asset_name || row.source_ref) ? (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {row.source_ref || row.asset_name}{(row.source_ref || row.asset_name) && chapterLabel ? " — " : ""}{chapterLabel}{co?.code ? ` · ${co.code}` : ""}
                      </p>
                    ) : null}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-[10px] text-muted-foreground cursor-default">
                          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        {format(new Date(row.created_at), "PPpp")}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Right */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {!isQA && <RespondByBadge respondByAt={row.respond_by_at} responded={row.responded} />}

                    {/* QA fix status badge */}
                    {isQA && row.qa_fix_status && (
                      <Badge variant="outline" className={`text-[9px] ${
                        row.qa_fix_status === "pending" ? "border-orange-400 text-orange-600" :
                        row.qa_fix_status === "approved" ? "border-emerald-400 text-emerald-600" :
                        row.qa_fix_status === "rejected" ? "border-destructive text-destructive" :
                        "border-muted text-muted-foreground"
                      }`}>
                        {row.qa_fix_status}
                      </Badge>
                    )}

                    {/* View Asset link — hide for issue-type rows (they get "Go to QA Page" instead) */}
                    {row.asset_name && !isIssueType && (
                      <a
                        href={`/solutions/${row.asset_name}?admin=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap flex items-center gap-1"
                      >
                        View Asset → <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}

                    {/* QA Admin link */}
                    {isQA && (
                      <a
                        href={`/solutions-qa`}
                        className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap flex items-center gap-1"
                      >
                        <Wrench className="h-2.5 w-2.5" /> QA Admin
                      </a>
                    )}

                    {/* Reply via email — only for chapter_questions */}
                    {!isQA && displayEmail && (
                      <a
                        href={`mailto:${displayEmail}?subject=${mailtoSubject}`}
                        className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap"
                      >
                        Reply via Email →
                      </a>
                    )}

                    {/* Responded / Resolved toggle */}
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!row.responded}
                        onChange={() => handleToggleResponded(row)}
                        className="rounded"
                      />
                      {isQA
                        ? (row.responded ? "Resolved" : "Mark resolved")
                        : (row.responded ? "Responded" : "Mark responded")
                      }
                    </label>

                    {/* Fixed / Fix Applied checkbox */}
                    {(isIssueType || isQA) && (
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!row.fixed}
                          onChange={() => handleToggleFixed(row)}
                          className="rounded accent-emerald-600"
                        />
                        {isIssueType
                          ? (row.fixed ? "✓ Fix Applied" : "Fix Applied")
                          : (row.fixed ? "✓ Fixed" : "Mark fixed")
                        }
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
