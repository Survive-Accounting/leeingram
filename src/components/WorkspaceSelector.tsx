import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function WorkspaceSelector() {
  const { workspace, setWorkspace, clearWorkspace } = useActiveWorkspace();

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("course_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters", workspace?.courseId],
    queryFn: async () => {
      if (!workspace?.courseId) return [];
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("course_id", workspace.courseId)
        .order("chapter_number");
      if (error) throw error;
      return data;
    },
    enabled: !!workspace?.courseId,
  });

  const handleCourseChange = (courseId: string) => {
    const course = courses?.find((c) => c.id === courseId);
    if (!course) return;
    // Set course, clear chapter
    setWorkspace({
      courseId: course.id,
      courseName: course.course_name,
      chapterId: "",
      chapterName: "",
      chapterNumber: 0,
    });
  };

  const handleChapterChange = (chapterId: string) => {
    const ch = chapters?.find((c) => c.id === chapterId);
    if (!ch || !workspace) return;
    setWorkspace({
      ...workspace,
      chapterId: ch.id,
      chapterName: ch.chapter_name,
      chapterNumber: ch.chapter_number,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={workspace?.courseId || ""} onValueChange={handleCourseChange}>
        <SelectTrigger className="h-7 text-[11px] w-40 bg-white/[0.07] border-white/10">
          <SelectValue placeholder="Course…" />
        </SelectTrigger>
        <SelectContent>
          {courses?.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-xs">{c.course_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={workspace?.chapterId || ""}
        onValueChange={handleChapterChange}
        disabled={!workspace?.courseId}
      >
        <SelectTrigger className="h-7 text-[11px] w-44 bg-white/[0.07] border-white/10">
          <SelectValue placeholder="Chapter…" />
        </SelectTrigger>
        <SelectContent>
          {chapters?.map((c) => (
            <SelectItem key={c.id} value={c.id} className="text-xs">
              Ch {c.chapter_number} — {c.chapter_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {workspace && (
        <button
          onClick={clearWorkspace}
          className="p-1 rounded text-muted-foreground/50 hover:text-muted-foreground"
          title="Clear workspace"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
