import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useChaptersWithCourses } from "@/hooks/useAdminDashboardData";
import { formatDistanceToNow } from "date-fns";

type InboxTab = "questions" | "issues" | "feedback";

export function StudentInbox() {
  const [inboxTab, setInboxTab] = useState<InboxTab>("questions");
  const [courseFilter, setCourseFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [newOnly, setNewOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data: chaptersData } = useChaptersWithCourses();
  const chapters = chaptersData?.chapters || [];
  const courses = chaptersData?.courses || [];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-student-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_questions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

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

  const filteredChapters = useMemo(() => {
    if (courseFilter === "all") return chapters;
    return chapters.filter((c: any) => c.course_id === courseFilter);
  }, [chapters, courseFilter]);

  const filtered = useMemo(() => {
    return rows.filter((r: any) => {
      if (r.issue_type !== inboxTab) return false;
      if (newOnly && r.status !== "new") return false;
      if (courseFilter !== "all") {
        const ch = chapterMap[r.chapter_id];
        if (!ch || ch.course_id !== courseFilter) return false;
      }
      if (chapterFilter !== "all" && r.chapter_id !== chapterFilter) return false;
      return true;
    });
  }, [rows, inboxTab, courseFilter, chapterFilter, newOnly, chapterMap]);

  const newQuestionCount = rows.filter((r: any) => r.issue_type === "question" && r.status === "new").length;
  const newIssueCount = rows.filter((r: any) => r.issue_type === "issue" && r.status === "new").length;
  const newFeedbackCount = rows.filter((r: any) => r.issue_type === "feedback" && r.status === "new").length;

  const handleMarkReplied = async (id: string) => {
    await supabase.from("chapter_questions").update({ status: "replied" } as any).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-student-inbox"] });
  };

  const tabConfig: { key: InboxTab; label: string; count: number }[] = [
    { key: "questions", label: "Questions", count: newQuestionCount },
    { key: "issues", label: "Issues", count: newIssueCount },
    { key: "feedback", label: "Feedback", count: newFeedbackCount },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {tabConfig.map(t => {
          const active = inboxTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setInboxTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={courseFilter}
          onChange={e => { setCourseFilter(e.target.value); setChapterFilter("all"); }}
          className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
        >
          <option value="all">All courses</option>
          {courses.map((c: any) => (
            <option key={c.id} value={c.id}>{c.code}</option>
          ))}
        </select>
        <select
          value={chapterFilter}
          onChange={e => setChapterFilter(e.target.value)}
          className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground"
        >
          <option value="all">All chapters</option>
          {filteredChapters.map((c: any) => (
            <option key={c.id} value={c.id}>Ch {c.chapter_number} — {c.chapter_name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={newOnly} onChange={e => setNewOnly(e.target.checked)} className="rounded" />
          New only
        </label>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">
          No {inboxTab} yet.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((row: any) => {
            const ch = chapterMap[row.chapter_id];
            const co = ch ? courseMap[ch.course_id] : null;
            const isNew = row.status === "new";
            const chapterLabel = ch ? `Ch ${ch.chapter_number} — ${ch.chapter_name}` : "";
            const mailtoSubject = encodeURIComponent(
              inboxTab === "feedback"
                ? `Re: your feedback on ${row.source_ref || row.asset_name || chapterLabel}`
                : `Re: your question about ${row.source_ref || chapterLabel}`
            );
            const displayName = row.student_name || row.student_email;
            const displayEmail = row.student_email === "anonymous" ? null : row.student_email;

            return (
              <div key={row.id} className="border border-border rounded-lg p-3 bg-card">
                {/* Top line */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${isNew ? "bg-destructive/15 text-destructive" : "bg-green-100 text-green-700"}`}>
                    {isNew ? "New" : "Replied"}
                  </span>
                  <span className="text-xs font-bold text-foreground">{displayName}</span>
                  {row.student_name && displayEmail && (
                    <span className="text-xs text-muted-foreground">{displayEmail}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                  </span>
                </div>

                {/* Asset context */}
                {(row.source_ref || row.asset_name || chapterLabel) && (
                  <p className="text-[11px] text-muted-foreground font-mono mt-1">
                    {row.source_ref || row.asset_name}{(row.source_ref || row.asset_name) && chapterLabel ? " — " : ""}{chapterLabel}
                    {co?.code ? ` · ${co.code}` : ""}
                  </p>
                )}

                {/* Message preview */}
                <p className="text-[13px] text-foreground mt-1.5">
                  {(row.question || "").length > 120
                    ? (row.question || "").slice(0, 120) + "…"
                    : row.question}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-2">
                  {isNew && (
                    <button
                      onClick={() => handleMarkReplied(row.id)}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Mark Replied
                    </button>
                  )}
                  {displayEmail && (
                    <a
                      href={`mailto:${displayEmail}?subject=${mailtoSubject}&body=${encodeURIComponent("Hi there,\n\n\n\n— Lee")}`}
                      className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Reply via Email →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
