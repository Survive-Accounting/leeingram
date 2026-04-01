/**
 * SurviveChapterAdmin — internal admin page to preview/test
 * "Survive This Chapter" hub pages for all courses and chapters.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ExternalLink, Copy } from "lucide-react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { toast } from "sonner";

export default function SurviveChapterAdmin() {
  const { data: courses } = useQuery({
    queryKey: ["survive-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, course_name, code").order("created_at");
      return data || [];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["survive-chapters"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id, topics_locked")
        .order("chapter_number");
      return data || [];
    },
  });

  // Count JE assets per chapter
  const { data: jeCounts } = useQuery({
    queryKey: ["survive-je-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("chapter_id")
        .not("supplementary_je_json", "is", null);
      const map: Record<string, number> = {};
      for (const row of data || []) {
        const cid = (row as any).chapter_id;
        if (cid) map[cid] = (map[cid] || 0) + 1;
      }
      return map;
    },
  });

  const grouped = useMemo(() => {
    if (!courses || !chapters) return [];
    return courses.map(course => ({
      ...course,
      chapters: chapters.filter(ch => ch.course_id === course.id),
    }));
  }, [courses, chapters]);

  const courseDisplayName = (code: string) => {
    const c = code?.toUpperCase();
    if (c === "IA2") return "Intermediate Accounting 2";
    if (c === "IA1") return "Intermediate Accounting 1";
    if (c === "MA2") return "Managerial Accounting";
    if (c === "FA1") return "Financial Accounting";
    return code;
  };

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Survive This Chapter</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Preview and test chapter hub pages across all courses. Each link opens the public student-facing page.
          </p>
        </div>

        {grouped.map(course => (
          <div key={course.id} className="space-y-2">
            <h2 className="text-sm font-bold text-foreground">{courseDisplayName(course.code)}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {course.chapters.map(ch => {
                const jeCount = jeCounts?.[ch.id] || 0;
                return (
                  <div
                    key={ch.id}
                    className="rounded-lg border border-border bg-card p-3 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        Ch {ch.chapter_number} — {ch.chapter_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{jeCount} JE asset{jeCount !== 1 ? "s" : ""}</span>
                        {ch.topics_locked && (
                          <span className="text-emerald-400 font-semibold">Topics locked</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link
                        to={`/cram/${ch.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> Full
                      </Link>
                      <Link
                        to={`/cram/${ch.id}?preview=true`}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" /> Preview
                      </Link>
                      <button
                        onClick={() => {
                          const html = `<iframe src="https://learn.surviveaccounting.com/legacy/NOTION_PAGE_ID?chapterId=${ch.id}" style="width:100%;height:600px;border:none;" frameborder="0"></iframe>`;
                          navigator.clipboard.writeText(html);
                          toast.success("Legacy iframe HTML copied — replace NOTION_PAGE_ID with the actual Notion page ID");
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                        title="Copy legacy iframe HTML"
                      >
                        <Copy className="h-3 w-3" /> Legacy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SurviveSidebarLayout>
  );
}
