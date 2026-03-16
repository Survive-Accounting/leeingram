import { useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StageCompletePanelProps {
  stage: "import" | "generate" | "review" | "assets";
  statLine: string;
  role?: string;
  assignedChapterIds?: string[];
}

const STAGE_CONFIG = {
  import: {
    headline: "Import Complete!",
    ctaLabel: "Go to Generate",
    ctaRoute: "/workspace",
  },
  generate: {
    headline: "Generation Complete!",
    ctaLabel: "Go to Review",
    ctaRoute: "/review",
  },
  review: {
    headline: "Review Complete!",
    ctaLabel: "Go to Teaching Assets",
    ctaRoute: "/assets-library",
  },
  assets: {
    headline: "Chapter Complete!",
    ctaLabel: "Chapter Complete — View Summary",
    ctaRoute: "/chapter-complete",
  },
};

export function StageCompletePanel({ stage, statLine, role, assignedChapterIds }: StageCompletePanelProps) {
  const navigate = useNavigate();
  const config = STAGE_CONFIG[stage];
  const { workspace, setWorkspace } = useActiveWorkspace();
  const isContentCreationVa = role === "content_creation_va";

  // Fetch chapter details for "next chapter" logic
  const { data: chapterDetails } = useQuery({
    queryKey: ["stage-complete-chapters", assignedChapterIds],
    queryFn: async () => {
      if (!assignedChapterIds?.length) return [];
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .in("id", assignedChapterIds)
        .order("chapter_number");
      return data ?? [];
    },
    enabled: isContentCreationVa && stage === "assets" && !!assignedChapterIds?.length,
  });

  const { data: courseDetails } = useQuery({
    queryKey: ["stage-complete-courses"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, code, course_name");
      return data ?? [];
    },
    enabled: isContentCreationVa && stage === "assets",
  });

  // Find next chapter (one after the current active chapter)
  const nextChapter = (() => {
    if (!chapterDetails || !workspace?.chapterId) return null;
    const sorted = [...chapterDetails].sort((a, b) => a.chapter_number - b.chapter_number);
    const currentIdx = sorted.findIndex(c => c.id === workspace.chapterId);
    if (currentIdx < 0 || currentIdx >= sorted.length - 1) return null;
    return sorted[currentIdx + 1];
  })();

  const handleNextChapter = () => {
    if (!nextChapter) return;
    const course = courseDetails?.find(c => c.id === nextChapter.course_id);
    setWorkspace({
      courseId: nextChapter.course_id,
      courseName: course?.course_name || course?.code || "",
      chapterId: nextChapter.id,
      chapterName: nextChapter.chapter_name,
      chapterNumber: nextChapter.chapter_number,
    });
    navigate("/problem-bank");
  };

  return (
    <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 flex items-center gap-4 mb-4">
      <CheckCircle className="h-8 w-8 text-green-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{config.headline}</h3>
        <p className="text-xs text-foreground/70 mt-0.5">{statLine}</p>
      </div>
      {isContentCreationVa && stage === "assets" ? (
        <div className="flex flex-col gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={() => window.open("https://app.slack.com/client/T0AKPHWTXLM/C0AKQURU02J", "_blank")}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            Message Lee on Slack →
          </Button>
          {nextChapter && (
            <Button size="sm" variant="outline" onClick={handleNextChapter} className="text-xs">
              Go to Next Chapter → <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      ) : config.ctaRoute ? (
        <Button size="sm" onClick={() => navigate(config.ctaRoute)} className="shrink-0">
          {config.ctaLabel} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      ) : null}
    </div>
  );
}