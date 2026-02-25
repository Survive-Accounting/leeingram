import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, Factory, Inbox, Library, Package, Video } from "lucide-react";
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

const PHASES: Phase[] = [
  {
    title: "Phase 1 — Problem Generation",
    steps: [
      "Select Chapter",
      "Upload Problem/Solution Source",
      "Generate Practice Problem",
      "Review Problem Text",
      "Confirm Journal Entry Required (if applicable)",
      "Save to Problem Bank",
    ],
  },
  {
    title: "Phase 2 — LearnWorlds Preparation",
    steps: [
      "Export Question CSV",
      "Export Worksheet PDF",
      "Confirm Naming Convention",
      "Assign Chapter + Exercise Ref",
      "Assign Concept Tag",
    ],
  },
  {
    title: "Phase 3 — LearnWorlds Import",
    steps: [
      "Upload to Question Bank",
      "Create 1Q Practice Assessment",
      "Add Problem Section to eBook",
      "Add Video Placeholder Block",
      "Embed Practice Assessment",
    ],
  },
  {
    title: "Phase 4 — Filming",
    steps: [
      "Film Micro Walkthrough (OBS)",
      "Upload Video to LW Video Library",
      "Replace Video Placeholder in eBook",
    ],
  },
  {
    title: "Phase 5 — Finalization",
    steps: [
      "Verify Assessment Loads",
      "Verify Video Plays",
      "Mark Problem as Complete",
      "Ready for Student Use",
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
  /* fetch chapters for the selector */
  const { data: chapters } = useQuery({
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

  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [openPhases, setOpenPhases] = useState<Record<number, boolean>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});

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
    if (!selectedChapter || !chapters) return "None selected";
    const ch = chapters.find((c) => c.id === selectedChapter);
    return ch ? `Ch ${ch.chapter_number} — ${ch.chapter_name}` : "None selected";
  }, [selectedChapter, chapters]);

  return (
    <aside
      className="w-72 shrink-0 border-r border-white/10 flex flex-col overflow-hidden"
      style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.35)" }}
    >
      {/* ── header ─────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Chapter Production Workflow
        </h2>

        {/* Chapter selector */}
        <Select value={selectedChapter} onValueChange={setSelectedChapter}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white text-xs h-8">
            <SelectValue placeholder="Select chapter…" />
          </SelectTrigger>
          <SelectContent>
            {(chapters ?? []).map((ch) => (
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
