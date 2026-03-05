import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Factory, Inbox, Library, Package, Video, GraduationCap, ChevronDown, ChevronRight, Rocket, FileCheck } from "lucide-react";
import { BuildTimerWidget } from "@/components/BuildTimerWidget";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PIPELINE_STAGES = [
  { key: "imported", label: "Imported", color: "bg-sky-500", path: "/problem-bank", icon: Inbox },
  { key: "generated", label: "Generated", color: "bg-violet-500", path: "/content", icon: Factory },
  { key: "approved", label: "Approved & Ready", color: "bg-amber-500", path: "/assets-library", icon: Library },
  { key: "banked", label: "Banked", color: "bg-blue-500", path: "/question-review", icon: FileCheck },
  { key: "deployed", label: "Deployed", color: "bg-emerald-500", path: "/filming", icon: Rocket },
] as const;

const NAV_LINKS = [
  { label: "Problem Import", path: "/problem-bank", icon: Inbox },
  { label: "Variant Generator", path: "/content", icon: Factory },
  { label: "Approved & Ready", path: "/assets-library", icon: Library },
  { label: "Question Bank", path: "/question-review", icon: FileCheck },
  { label: "LW Exports", path: "/export-sets", icon: Package },
  { label: "Deployment Queue", path: "/filming", icon: Video },
  { label: "Tutoring", path: "/tutoring/review", icon: GraduationCap },
];

type PipelineStatus = typeof PIPELINE_STAGES[number]["key"];

export function WorkflowModePanel() {
  const navigate = useNavigate();
  const { workspace, setWorkspace, clearWorkspace } = useActiveWorkspace();

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, course_name, slug").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: allChapters } = useQuery({
    queryKey: ["chapters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .order("chapter_number");
      if (error) throw error;
      return data;
    },
  });

  const selectedCourse = workspace?.courseId || "";
  const selectedChapter = workspace?.chapterId || "";

  const handleCourseChange = (courseId: string) => {
    const course = courses?.find((c) => c.id === courseId);
    if (!course) return;
    setWorkspace({
      courseId: course.id,
      courseName: course.course_name,
      chapterId: "",
      chapterName: "",
      chapterNumber: 0,
    });
  };

  const handleChapterChange = (chapterId: string) => {
    const ch = allChapters?.find((c) => c.id === chapterId);
    if (!ch || !workspace) return;
    setWorkspace({
      ...workspace,
      chapterId: ch.id,
      chapterName: ch.chapter_name,
      chapterNumber: ch.chapter_number,
    });
  };

  const filteredChapters = useMemo(
    () => (allChapters ?? []).filter((ch) => ch.course_id === selectedCourse),
    [allChapters, selectedCourse]
  );

  const { data: problems } = useQuery({
    queryKey: ["pipeline-problems", selectedChapter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("id, title, source_label, pipeline_status")
        .eq("chapter_id", selectedChapter);
      if (error) throw error;
      return data as { id: string; title: string; source_label: string; pipeline_status: PipelineStatus }[];
    },
    enabled: !!selectedChapter,
  });

  const total = problems?.length ?? 0;
  // Cumulative counts: each stage shows items at that stage OR any later stage
  const STAGE_ORDER: Record<string, number> = {
    imported: 0, generated: 1, approved: 2, banked: 3, deployed: 4,
  };

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PIPELINE_STAGES.forEach((s) => (counts[s.key] = 0));
    problems?.forEach((p) => {
      const problemOrder = STAGE_ORDER[p.pipeline_status];
      if (problemOrder === undefined) return;
      // Count this problem for its stage AND all earlier stages
      PIPELINE_STAGES.forEach((s) => {
        if (STAGE_ORDER[s.key] <= problemOrder) {
          counts[s.key]++;
        }
      });
    });
    return counts;
  }, [problems]);

  const approvedTotal = stageCounts.approved + stageCounts.banked + stageCounts.deployed;
  const progressPercent = approvedTotal > 0 ? (stageCounts.deployed / approvedTotal) * 100 : 0;

  const chapterLabel = useMemo(() => {
    if (!selectedChapter || !allChapters) return null;
    const ch = allChapters.find((c) => c.id === selectedChapter);
    return ch ? `Ch ${ch.chapter_number} — ${ch.chapter_name}` : null;
  }, [selectedChapter, allChapters]);

  return (
    <aside className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden bg-[hsl(220,20%,7%)] sticky top-0 h-screen">
      {/* Header with selectors */}
      <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Chapter Production Pipeline
        </h2>

        <Select value={selectedCourse} onValueChange={handleCourseChange}>
          <SelectTrigger className="bg-background border-border text-foreground text-xs h-8">
            <SelectValue placeholder="Select course…" />
          </SelectTrigger>
          <SelectContent>
            {(courses ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedChapter} onValueChange={handleChapterChange} disabled={!selectedCourse}>
          <SelectTrigger className="bg-background border-border text-foreground text-xs h-8">
            <SelectValue placeholder={selectedCourse ? "Select chapter…" : "Select a course first"} />
          </SelectTrigger>
          <SelectContent>
            {filteredChapters.map((ch) => (
              <SelectItem key={ch.id} value={ch.id}>
                Ch {ch.chapter_number} — {ch.chapter_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedChapter && chapterLabel && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className="text-foreground font-medium">{chapterLabel}</span>
              <span>{total} problems</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Deploy Progress</span>
                <span className="text-foreground font-medium">{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5 bg-muted" />
            </div>
          </div>
        )}
      </div>

      {/* Pipeline stages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {selectedChapter ? (
          PIPELINE_STAGES.map((stage) => {
            const count = stageCounts[stage.key];
            const Icon = stage.icon;
            return (
              <button
                key={stage.key}
                onClick={() => navigate(stage.path)}
                className="w-full rounded-lg border border-border bg-card hover:bg-accent/50 p-3 text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2.5 w-2.5 rounded-full", stage.color)} />
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{stage.label}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground tabular-nums">{count}</span>
                </div>
              </button>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">
            Select a course and chapter to view pipeline
          </p>
        )}
      </div>

      {/* Build Timer */}
      {selectedChapter && <BuildTimerWidget />}

      {/* Collapsible Navigation */}
      <NavToggle />
    </aside>
  );
}

function NavToggle() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Navigation</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-0.5">
          {NAV_LINKS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] transition-colors",
                  active
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
