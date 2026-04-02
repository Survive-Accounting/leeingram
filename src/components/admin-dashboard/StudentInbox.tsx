import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChaptersWithCourses } from "@/hooks/useAdminDashboardData";
import { formatDistanceToNow, format, isToday, isBefore } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

type IssueFilter = "all" | "questions" | "issues" | "feedback" | "quiz_rating";
type StatusFilter = "all" | "needs_response" | "responded";

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
};

const issueLabels: Record<string, string> = {
  question: "Question",
  issue: "Issue",
  feedback: "Feedback",
  quiz_rating: "Quiz Feedback",
};

export function StudentInbox() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");
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

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-student-inbox-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_questions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Filter out quiz_rating rows with no message
      return (data as any[]).filter((r: any) =>
        r.issue_type !== "quiz_rating" || (r.question && r.question.trim() !== "")
      );
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r: any) => {
      if (statusFilter === "needs_response" && r.responded) return false;
      if (statusFilter === "responded" && !r.responded) return false;
      if (issueFilter !== "all") {
        if (issueFilter === "questions" && r.issue_type !== "question") return false;
        if (issueFilter === "issues" && r.issue_type !== "issue") return false;
        if (issueFilter === "feedback" && r.issue_type !== "feedback") return false;
        if (issueFilter === "quiz_rating" && r.issue_type !== "quiz_rating") return false;
      }
      return true;
    });
  }, [rows, statusFilter, issueFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      // Unresponded first
      if (a.responded !== b.responded) return a.responded ? 1 : -1;
      if (!a.responded && !b.responded) {
        // Sort by respond_by_at ASC (most urgent first)
        const aTime = a.respond_by_at ? new Date(a.respond_by_at).getTime() : Infinity;
        const bTime = b.respond_by_at ? new Date(b.respond_by_at).getTime() : Infinity;
        return aTime - bTime;
      }
      // Responded: most recently responded first
      const aResp = a.responded_at ? new Date(a.responded_at).getTime() : 0;
      const bResp = b.responded_at ? new Date(b.responded_at).getTime() : 0;
      return bResp - aResp;
    });
  }, [filtered]);

  const unrespondedCount = rows.filter((r: any) => !r.responded).length;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const respondedThisWeek = rows.filter((r: any) => r.responded && r.responded_at && new Date(r.responded_at) >= weekAgo).length;

  const handleToggleResponded = async (id: string, currentValue: boolean) => {
    const updates: any = { responded: !currentValue };
    if (!currentValue) {
      updates.responded_at = new Date().toISOString();
      updates.status = "replied";
    } else {
      updates.responded_at = null;
      updates.status = "new";
    }
    const { error } = await supabase.from("chapter_questions").update(updates).eq("id", id);
    if (error) {
      toast.error("Failed to update", { description: error.message });
      return;
    }
    if (!currentValue) {
      toast.success("Marked as responded ✓");
    } else {
      toast("Reopened — marked as not responded");
    }
    queryClient.invalidateQueries({ queryKey: ["admin-student-inbox-v2"] });
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
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
            {sorted.map((row: any) => {
              const ch = chapterMap[row.chapter_id];
              const co = ch ? courseMap[ch.course_id] : null;
              const isRating = row.issue_type === "quiz_rating";
              const ratingMeta = isRating ? parseRatingMeta(row.source_ref) : null;
              const chapterLabel = ch ? `Ch ${ch.chapter_number} — ${ch.chapter_name}` : "";
              const displayEmail = row.student_email && row.student_email !== "anonymous" ? row.student_email : null;

              const overdue = row.respond_by_at && !row.responded && isBefore(new Date(row.respond_by_at), now);
              const dueToday = row.respond_by_at && !row.responded && !overdue && isToday(new Date(row.respond_by_at));

              const borderClass = overdue
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
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${issueColors[row.issue_type] || "bg-secondary text-secondary-foreground"}`}>
                        {issueLabels[row.issue_type] || row.issue_type}
                      </span>
                      {isRating && ratingMeta?.star_rating && (
                        <span className="text-amber-400 font-bold text-sm">
                          {"★".repeat(ratingMeta.star_rating)}
                          <span className="text-muted-foreground">{"★".repeat(5 - ratingMeta.star_rating)}</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-xs font-bold text-foreground">
                        {displayEmail || "Anonymous"}
                      </span>
                      {row.student_name && (
                        <span className="text-[11px] text-muted-foreground ml-2">{row.student_name}</span>
                      )}
                    </div>

                    {row.question && (
                      <p className="text-[13px] text-foreground">
                        {row.question.length > 120 ? row.question.slice(0, 120) + "…" : row.question}
                      </p>
                    )}

                    {/* Context */}
                    {(isRating && ratingMeta?.topic_name) ? (
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
                    <RespondByBadge respondByAt={row.respond_by_at} responded={row.responded} />

                    {displayEmail && (
                      <a
                        href={`mailto:${displayEmail}?subject=${mailtoSubject}`}
                        className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap"
                      >
                        Reply via Email →
                      </a>
                    )}

                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!row.responded}
                        onChange={() => handleToggleResponded(row.id, !!row.responded)}
                        className="rounded"
                      />
                      {row.responded ? "Responded" : "Mark responded"}
                    </label>
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
