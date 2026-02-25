import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, Factory, Inbox, Library, Package, Video, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const QUICK_NAV = [
  { label: "Asset Factory", path: "/content", icon: Factory },
  { label: "Problem Inbox", path: "/problem-bank", icon: Inbox },
  { label: "Assets Library", path: "/assets-library", icon: Library },
  { label: "Export Sets", path: "/export-sets", icon: Package },
  { label: "Filming", path: "/filming", icon: Video },
];

/* ── workflow phases ─────────────────────────────────────── */

interface Phase {
  title: string;
  steps: string[];
}

interface PhaseWithTooltip extends Phase {
  tooltip?: string;
}

const PHASES: PhaseWithTooltip[] = [
  {
    title: "SOURCE",
    steps: [
      "Upload textbook problem + solution pair",
      "Generate AI practice variant(s)",
      "Review draft versions",
    ],
  },
  {
    title: "APPROVED",
    tooltip: "Final Survive Accounting teaching version selected from AI/textbook drafts.",
    steps: [
      "Select final teaching version",
      "Edit problem text & solution",
      "Confirm ready for camera & tutoring",
    ],
  },
  {
    title: "LW READY",
    steps: [
      "Format question text for Question Bank",
      "Add answer choices & correct answer",
      "Add feedback / explanation",
      "Export CSV for import",
    ],
  },
  {
    title: "EBOOK LINKED",
    steps: [
      "Add video placeholder block in eBook",
      "Embed practice assessment in eBook",
      "Verify eBook section structure",
    ],
  },
  {
    title: "FILM READY",
    steps: [
      "Confirm walkthrough script / outline",
      "Queue for OBS recording session",
    ],
  },
  {
    title: "FILMED",
    steps: [
      "Record walkthrough video (OBS)",
      "Upload to LearnWorlds Video Library",
      "Replace video placeholder in eBook",
    ],
  },
  {
    title: "DEPLOYED",
    steps: [
      "Link into Topic Quiz",
      "Link into Practice Exam (if applicable)",
      "Verify assessment loads",
      "Mark problem as complete",
    ],
  },
];

const TOTAL_STEPS = PHASES.reduce((s, p) => s + p.steps.length, 0);

/* ── helpers ─────────────────────────────────────────────── */

function storageKey(chapterId: string) {
  return `wf-mode-${chapterId}`;
}

function loadChecked(chapterId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(storageKey(chapterId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveChecked(chapterId: string, checked: Record<string, boolean>) {
  localStorage.setItem(storageKey(chapterId), JSON.stringify(checked));
}

/* ── component ───────────────────────────────────────────── */

export function WorkflowModePanel() {
  /* fetch courses */
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, course_name, slug").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  /* fetch chapters */
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

  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [openPhases, setOpenPhases] = useState<Record<number, boolean>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  /* filter chapters by selected course */
  const filteredChapters = useMemo(
    () => (allChapters ?? []).filter((ch) => ch.course_id === selectedCourse),
    [allChapters, selectedCourse]
  );

  /* reset chapter when course changes */
  useEffect(() => {
    setSelectedChapter("");
  }, [selectedCourse]);

  /* load persisted state when chapter changes */
  useEffect(() => {
    if (selectedChapter) {
      setChecked(loadChecked(selectedChapter));
    } else {
      setChecked({});
    }
  }, [selectedChapter]);

  /* persist on change */
  useEffect(() => {
    if (selectedChapter) saveChecked(selectedChapter, checked);
  }, [checked, selectedChapter]);

  const togglePhase = (idx: number) =>
    setOpenPhases((p) => ({ ...p, [idx]: !p[idx] }));

  const toggleCheck = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  /* stats */
  const completedCount = Object.values(checked).filter(Boolean).length;
  const remainingCount = TOTAL_STEPS - completedCount;
  const progressPercent = TOTAL_STEPS > 0 ? (completedCount / TOTAL_STEPS) * 100 : 0;

  const chapterLabel = useMemo(() => {
    if (!selectedChapter || !allChapters) return "None selected";
    const ch = allChapters.find((c) => c.id === selectedChapter);
    return ch ? `Ch ${ch.chapter_number} — ${ch.chapter_name}` : "None selected";
  }, [selectedChapter, allChapters]);

  return (
    <aside
      className="w-72 shrink-0 border-r border-white/10 flex flex-col overflow-hidden"
      style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.35)" }}
    >
      {/* ── header ─────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Chapter Production Pipeline
        </h2>

        {/* Course selector */}
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8">
            <SelectValue placeholder="Select course…" />
          </SelectTrigger>
          <SelectContent>
            {(courses ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.course_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Chapter selector */}
        <Select value={selectedChapter} onValueChange={setSelectedChapter} disabled={!selectedCourse}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8">
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

        {/* Stats row */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-white/40">
            <span>Chapter: <span className="text-white/70">{chapterLabel}</span></span>
          </div>
          <div className="flex justify-between text-[10px] text-white/40">
            <span>Completed: <span className="text-primary">{completedCount}</span></span>
            <span>Remaining: <span className="text-muted-foreground">{remainingCount}</span></span>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-white/40">Chapter Production Progress</span>
            <Progress value={progressPercent} className="h-1.5 bg-white/10" />
          </div>
        </div>
      </div>

      {/* ── phases ─────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {PHASES.map((phase, pIdx) => {
          const isOpen = !!openPhases[pIdx];
          const phaseDone = phase.steps.filter((_, sIdx) => checked[`${pIdx}-${sIdx}`]).length;

          return (
            <div
              key={pIdx}
              className="rounded-lg border border-white/8 bg-white/[0.03] overflow-hidden"
            >
              {/* phase header */}
              <button
                onClick={() => togglePhase(pIdx)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-white/40 shrink-0" />
                )}
                <span className="text-xs font-medium text-white/80 flex-1">{phase.title}</span>
                {(phase as PhaseWithTooltip).tooltip && (
                  <span className="relative group">
                    <Info className="h-3 w-3 text-white/30 hover:text-white/60 transition-colors cursor-help" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 text-[10px] text-white/80 bg-black/90 border border-white/10 rounded-md px-2 py-1.5 z-50 text-center">
                      {(phase as PhaseWithTooltip).tooltip}
                    </span>
                  </span>
                )}
                <span className="text-[10px] tabular-nums text-white/30">
                  {phaseDone}/{phase.steps.length}
                </span>
              </button>

              {/* mini progress */}
              <div className="h-0.5 bg-white/5">
                <div
                  className="h-0.5 bg-primary/60 transition-all duration-300"
                  style={{ width: `${(phaseDone / phase.steps.length) * 100}%` }}
                />
              </div>

              {/* steps */}
              {isOpen && (
                <div className="px-2 py-2 space-y-0.5">
                  {phase.steps.map((step, sIdx) => {
                    const key = `${pIdx}-${sIdx}`;
                    const done = !!checked[key];
                    return (
                      <label
                        key={sIdx}
                        className={cn(
                          "flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors hover:bg-white/5",
                          done && "opacity-40"
                        )}
                      >
                        <Checkbox
                          checked={done}
                          onCheckedChange={() => toggleCheck(key)}
                          className="mt-0.5 shrink-0"
                        />
                        <span
                          className={cn(
                            "text-xs leading-relaxed",
                            done ? "line-through text-white/40" : "text-white/70"
                          )}
                        >
                          {sIdx + 1}. {step}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── quick nav ─────────────────────── */}
      <QuickNav />
    </aside>
  );
}

function QuickNav() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="border-t border-white/10 px-2 py-2 space-y-0.5">
      <span className="text-[10px] uppercase tracking-widest text-white/30 px-2 mb-1 block">Navigate</span>
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
                ? "bg-white/15 text-white font-medium"
                : "text-white/45 hover:text-white hover:bg-white/8"
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
