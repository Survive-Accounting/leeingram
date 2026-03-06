import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Factory, Inbox, Library, Video, LogOut, Settings, Package, Workflow, GraduationCap, PanelLeftClose, PanelLeft, HelpCircle, FileCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";
import { WorkflowModePanel } from "@/components/WorkflowModePanel";
import { PipelineProgressStrip } from "@/components/PipelineProgressStrip";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

const PIPELINE_STAGE_ORDER: Record<string, number> = {
  imported: 0, generated: 1, approved: 2, banked: 3, deployed: 4,
};

const NAV_ITEMS = [
  { label: "Problem Import", sub: "Paste source screenshots", path: "/problem-bank", icon: Inbox, stageKey: "imported" },
  { label: "Variant Generator", sub: "Generate exam-style variants", path: "/content", icon: Factory, stageKey: "generated" },
  { label: "Approved & Ready", sub: "Approved problems vault", path: "/assets-library", icon: Library, stageKey: "approved" },
  { label: "Question Bank", sub: "Review banked questions", path: "/question-review", icon: FileCheck, stageKey: "banked" },
  { label: "LW Exports", sub: "Bundle for LearnWorlds CSV", path: "/export-sets", icon: Package, stageKey: null },
  { label: "Deployment Queue", sub: "Track deployment status", path: "/filming", icon: Video, stageKey: "deployed" },
  { label: "Tutoring", sub: "Pre-session review", path: "/tutoring/review", icon: GraduationCap, stageKey: null },
];

export function SurviveSidebarLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { workspace, setWorkspace } = useActiveWorkspace();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");
  const [workflowMode, setWorkflowMode] = useState(() => localStorage.getItem("wf-mode-active") !== "false");

  const toggleWorkflowMode = () => {
    setWorkflowMode((prev) => {
      const next = !prev;
      localStorage.setItem("wf-mode-active", String(next));
      return next;
    });
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  // --- Course / Chapter data for header selectors ---
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, course_name").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: allChapters } = useQuery({
    queryKey: ["chapters-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      if (error) throw error;
      return data;
    },
  });

  const filteredChapters = useMemo(
    () => (allChapters ?? []).filter((ch) => ch.course_id === workspace?.courseId),
    [allChapters, workspace?.courseId]
  );

  const handleCourseChange = (courseId: string) => {
    const course = courses?.find((c) => c.id === courseId);
    if (!course) return;
    setWorkspace({ courseId: course.id, courseName: course.course_name, chapterId: "", chapterName: "", chapterNumber: 0 });
  };

  const handleChapterChange = (chapterId: string) => {
    const ch = allChapters?.find((c) => c.id === chapterId);
    if (!ch || !workspace) return;
    setWorkspace({ ...workspace, chapterId: ch.id, chapterName: ch.chapter_name, chapterNumber: ch.chapter_number });
  };

  // --- Pipeline counts for nav badges ---
  const { data: pipelineProblems } = useQuery({
    queryKey: ["pipeline-counts-sidebar", workspace?.chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("id, pipeline_status")
        .eq("chapter_id", workspace!.chapterId);
      if (error) throw error;
      return data as { id: string; pipeline_status: string }[];
    },
    enabled: !!workspace?.chapterId,
  });

  // Banked questions count
  const { data: bankedCount } = useQuery({
    queryKey: ["banked-questions-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("banked_questions")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { imported: 0, generated: 0, approved: 0, banked: 0, deployed: 0 };
    pipelineProblems?.forEach((p) => {
      const order = PIPELINE_STAGE_ORDER[p.pipeline_status];
      if (order === undefined) return;
      Object.keys(counts).forEach((key) => {
        if (PIPELINE_STAGE_ORDER[key] <= order) counts[key]++;
      });
    });
    // Override banked count with actual banked_questions count
    if (bankedCount !== undefined) counts.banked = bankedCount;
    return counts;
  }, [pipelineProblems, bankedCount]);

  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${aorakiBg})` }} />
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40" />
      <NightSkyOverlay />

      {/* Header */}
      <header
        className="relative z-10 border-b border-border"
        style={{ backdropFilter: "blur(16px)", background: "rgba(5,8,18,0.85)" }}
      >
        <div className="flex h-14 items-center gap-3 px-4">
          <button
            onClick={() => navigate("/domains")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs uppercase tracking-widest"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </button>
          <span className="text-muted-foreground/30">|</span>
          <h1 className="font-semibold text-foreground text-sm">Survive Accounting</h1>

          {/* Workspace Selectors */}
          <span className="text-muted-foreground/30 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-2">
            <Select value={workspace?.courseId || ""} onValueChange={handleCourseChange}>
              <SelectTrigger className="h-7 text-[11px] w-36 bg-muted/50 border-border text-foreground">
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
              <SelectTrigger className="h-7 text-[11px] w-44 bg-muted/50 border-border text-foreground">
                <SelectValue placeholder="Chapter…" />
              </SelectTrigger>
              <SelectContent>
                {filteredChapters.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    Ch {c.chapter_number} — {c.chapter_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!workflowMode && (
              <Button variant="ghost" size="sm" onClick={toggleSidebar} className="text-muted-foreground hover:text-foreground hover:bg-accent" title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}>
                {sidebarCollapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={toggleWorkflowMode} className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <Workflow className="mr-1 h-3.5 w-3.5" /> {workflowMode ? "Dashboard View" : "Workflow View"}
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <Link to="/style-guide">
                <Settings className="mr-1 h-3.5 w-3.5" /> Preferences
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <LogOut className="mr-1 h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)]">
        {workflowMode && <WorkflowModePanel />}

        {!workflowMode && !sidebarCollapsed && (
          <nav
            className="w-56 shrink-0 border-r border-border py-4 px-2 space-y-1 flex flex-col"
            style={{ backdropFilter: "blur(16px)", background: "rgba(5,8,18,0.85)" }}
          >
            <div className="space-y-1 flex-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                const count = item.stageKey && workspace?.chapterId ? stageCounts[item.stageKey] : null;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
                      active
                        ? "bg-primary/20 text-foreground font-medium border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm block">{item.label}</span>
                      {item.sub && <span className="text-[10px] text-muted-foreground block leading-tight">{item.sub}</span>}
                    </div>
                    {count !== null && count > 0 && (
                      <span className="text-[10px] font-bold tabular-nums text-primary bg-primary/15 rounded px-1.5 py-0.5">
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}

              <div className="pt-4 mt-4 border-t border-border space-y-1">
                <Link
                  to="/marketing"
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors",
                    isActive("/marketing") ? "bg-primary/20 text-foreground font-medium border border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  Marketing
                </Link>
                <Link
                  to="/ideas?domain=survive"
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors",
                    location.pathname === "/ideas" ? "bg-primary/20 text-foreground font-medium border border-primary/30" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  Ideas
                </Link>
              </div>
            </div>
          </nav>
        )}

        <main className="flex-1 overflow-auto relative">
          <PipelineProgressStrip />
          <div
            className="mx-4 sm:mx-6 mb-6 mt-1 rounded-xl p-5"
            style={{
              background: "hsl(222 20% 7% / 0.92)",
              backdropFilter: "blur(24px)",
              border: "1px solid hsl(220 12% 18% / 0.6)",
              boxShadow: "0 4px 24px -4px rgba(0,0,0,0.3)",
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
