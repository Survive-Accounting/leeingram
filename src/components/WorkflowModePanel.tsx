import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Factory, Inbox, Library, Package, Video, GraduationCap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const QUICK_NAV = [
  { label: "Problem Import", path: "/problem-bank", icon: Inbox },
  { label: "Variant Generator", path: "/content", icon: Factory },
  { label: "Assets Library", path: "/assets-library", icon: Library },
  { label: "Export Sets", path: "/export-sets", icon: Package },
  { label: "Filming Queue", path: "/filming", icon: Video },
];

const PIPELINE_STAGES = [
  { key: "imported", label: "Imported", color: "bg-sky-500" },
  { key: "generated", label: "Generated", color: "bg-violet-500" },
  { key: "approved", label: "Approved", color: "bg-amber-500" },
  { key: "banked", label: "Banked", color: "bg-blue-500" },
  { key: "ready_to_film", label: "Ready to Film", color: "bg-orange-500" },
  { key: "deployed", label: "Deployed", color: "bg-emerald-500" },
] as const;

type PipelineStatus = typeof PIPELINE_STAGES[number]["key"];

export function WorkflowModePanel() {
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

  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [activeFilter, setActiveFilter] = useState<PipelineStatus | null>(null);

  const filteredChapters = useMemo(
    () => (allChapters ?? []).filter((ch) => ch.course_id === selectedCourse),
    [allChapters, selectedCourse]
  );

  useEffect(() => { setSelectedChapter(""); }, [selectedCourse]);

  // Fetch pipeline stats for selected chapter
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
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PIPELINE_STAGES.forEach((s) => (counts[s.key] = 0));
    problems?.forEach((p) => { if (counts[p.pipeline_status] !== undefined) counts[p.pipeline_status]++; });
    return counts;
  }, [problems]);

  const approvedTotal = stageCounts.approved + stageCounts.banked + stageCounts.ready_to_film + stageCounts.deployed;
  const progressPercent = approvedTotal > 0 ? (stageCounts.deployed / approvedTotal) * 100 : 0;

  const chapterLabel = useMemo(() => {
    if (!selectedChapter || !allChapters) return null;
    const ch = allChapters.find((c) => c.id === selectedChapter);
    return ch ? `Ch ${ch.chapter_number} — ${ch.chapter_name}` : null;
  }, [selectedChapter, allChapters]);

  const filteredProblems = useMemo(() => {
    if (!activeFilter || !problems) return [];
    return problems.filter((p) => p.pipeline_status === activeFilter);
  }, [problems, activeFilter]);

  return (
    <aside
      className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden bg-[hsl(220,20%,7%)]"
    >
      {/* Header with selectors */}
      <div className="px-4 pt-4 pb-3 border-b border-border space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Chapter Production Pipeline
        </h2>

        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="bg-background border-border text-foreground text-xs h-8">
            <SelectValue placeholder="Select course…" />
          </SelectTrigger>
          <SelectContent>
            {(courses ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedChapter} onValueChange={setSelectedChapter} disabled={!selectedCourse}>
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
          <>
            {PIPELINE_STAGES.map((stage) => {
              const count = stageCounts[stage.key];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const isActive = activeFilter === stage.key;
              return (
                <button
                  key={stage.key}
                  onClick={() => setActiveFilter(isActive ? null : stage.key)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-accent/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2.5 w-2.5 rounded-full", stage.color)} />
                      <span className="text-xs font-medium text-foreground">{stage.label}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground tabular-nums">{count}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", stage.color)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">{pct}%</span>
                  </div>
                </button>
              );
            })}

            {/* Filtered problem list */}
            {activeFilter && filteredProblems.length > 0 && (
              <div className="mt-3 border-t border-border pt-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  {PIPELINE_STAGES.find((s) => s.key === activeFilter)?.label} ({filteredProblems.length})
                </p>
                {filteredProblems.map((p) => (
                  <div key={p.id} className="rounded-md border border-border bg-card p-2">
                    <p className="text-xs text-foreground font-medium truncate">{p.title || p.source_label || "Untitled"}</p>
                    {p.source_label && p.title && (
                      <p className="text-[10px] text-muted-foreground truncate">{p.source_label}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {activeFilter && filteredProblems.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4 mt-3 border-t border-border">
                No problems in this stage
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">
            Select a course and chapter to view pipeline
          </p>
        )}
      </div>

      {/* Quick nav */}
      <QuickNav />
    </aside>
  );
}

function QuickNav() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="border-t border-border px-2 py-2 space-y-0.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 mb-1 block">Navigate</span>
      {QUICK_NAV.map((item) => {
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
  );
}
