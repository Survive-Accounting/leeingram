import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import CampusChapterMeta from "@/components/CampusChapterMeta";
import ChapterCramTool from "./ChapterCramTool";

const COURSE_SLUG_MAP: Record<string, string> = {
  "intermediate-accounting-2": "44444444-4444-4444-4444-444444444444",
  "intermediate-accounting-1": "33333333-3333-3333-3333-333333333333",
  "intro-accounting-1": "11111111-1111-1111-1111-111111111111",
  "intro-accounting-2": "22222222-2222-2222-2222-222222222222",
};

const COURSE_NAMES: Record<string, string> = {
  "intermediate-accounting-2": "Intermediate Accounting 2",
  "intermediate-accounting-1": "Intermediate Accounting 1",
  "intro-accounting-1": "Introductory Accounting 1",
  "intro-accounting-2": "Introductory Accounting 2",
};

export default function CampusChapterPage() {
  const { campusSlug = "general", courseSlug = "intermediate-accounting-2", chapterNumber: chapterParam } = useParams();
  const chNum = parseInt(chapterParam?.replace("chapter-", "") || "0", 10);
  const courseId = COURSE_SLUG_MAP[courseSlug] || COURSE_SLUG_MAP["intermediate-accounting-2"];
  const courseName = COURSE_NAMES[courseSlug] || "Intermediate Accounting 2";

  const { data: campus } = useQuery({
    queryKey: ["campus-chapter-campus", campusSlug],
    enabled: campusSlug !== "general",
    queryFn: async () => {
      const { data } = await supabase
        .from("campuses")
        .select("id, name")
        .eq("slug", campusSlug)
        .maybeSingle();
      return data;
    },
  });

  const { data: chapter, isLoading } = useQuery({
    queryKey: ["campus-chapter-resolve", courseId, chNum],
    enabled: chNum > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", courseId)
        .eq("chapter_number", chNum)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const campusName = campus?.name || (campusSlug === "general" ? "Survive Accounting" : campusSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()));

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-foreground/60 text-sm">
        Loading...
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="flex min-h-screen items-center justify-center text-foreground/60 text-sm">
        Chapter not found.
      </div>
    );
  }

  return (
    <>
      <CampusChapterMeta
        campusName={campusName}
        campusSlug={campusSlug}
        courseName={courseName}
        courseSlug={courseSlug}
        chapterNumber={chapter.chapter_number}
        chapterName={chapter.chapter_name}
      />
      <ChapterCramTool
        overrideChapterId={chapter.id}
        campusContext={{ slug: campusSlug, courseSlug, name: campusName }}
      />
    </>
  );
}
