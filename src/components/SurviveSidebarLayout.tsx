import { useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, LogOut, Settings, Workflow, PanelLeftClose, PanelLeft,
  Inbox, Factory, Library, FileCheck, Package, Video, GraduationCap,
  Rocket, LayoutDashboard,
} from "lucide-react";
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

// ── Phase 1: VA Production ─────────────────────────────────────────
const PHASE_1_ITEMS = [
  { label: "Pipeline Overview", path: "/pipeline", icon: LayoutDashboard, section: null },
  { label: "Problem Import", sub: "Screenshot intake", path: "/problem-bank", icon: Inbox, section: "INTAKE" },
  { label: "Variant Generator", sub: "Generate & review", path: "/content", icon: Factory, section: "ASSET PRODUCTION" },
  { label: "Approved Assets", sub: "Ready for banking", path: "/assets-library", icon: Library, section: "ASSET PRODUCTION" },
  { label: "Question Bank", sub: "MC review & approve", path: "/question-review", icon: FileCheck, section: "BANKED" },
];

// ── Phase 2: Instructor ────────────────────────────────────────────
const PHASE_2_ITEMS = [
  { label: "LW Exports", sub: "CSV bundles", path: "/export-sets", icon: Package, section: "EXPORT" },
  { label: "Video Queue", sub: "Record & deploy", path: "/filming", icon: Video, section: "VIDEO" },
  { label: "Deployment", sub: "VA checklist", path: "/deployment", icon: Rocket, section: "DEPLOY" },
  { label: "Tutoring", sub: "Pre-session review", path: "/tutoring/review", icon: GraduationCap, section: null },
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

  // ── Course / Chapter selectors ───────────────────────────────────
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

  // ── Pipeline badge counts ────────────────────────────────────────
  const { data: pipelineCounts } = useQuery({
    queryKey: ["pipeline-sidebar-counts", workspace?.chapterId],
    queryFn: async () => {
      const chId = workspace!.chapterId;
      // Chapter problems counts
      const { data: problems } = await supabase
        .from("chapter_problems")
        .select("id, pipeline_status")
        .eq("chapter_id", chId);

      const imported = problems?.filter(p => p.pipeline_status === "imported").length ?? 0;
      const generated = problems?.filter(p => ["generated", "approved", "banked", "deployed"].includes(p.pipeline_status)).length ?? 0;

      // Teaching assets count
      const { count: approvedCount } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", chId);

      // Banked questions count (global)
      const { count: bankedCount } = await supabase
        .from("banked_questions")
        .select("id", { count: "exact", head: true });

      return {
        imported,
        generated,
        approved: approvedCount ?? 0,
        banked: bankedCount ?? 0,
      };
    },
    enabled: !!workspace?.chapterId,
  });

  const getBadge = (path: string) => {
    if (!pipelineCounts) return null;
    if (path === "/problem-bank") return pipelineCounts.imported || null;
    if (path === "/content") return pipelineCounts.generated || null;
    if (path === "/assets-library") return pipelineCounts.approved || null;
    if (path === "/question-review") return pipelineCounts.banked || null;
    return null;
  };

  // ── Render nav section ───────────────────────────────────────────
  const renderNavItems = (items: typeof PHASE_1_ITEMS, dimmed = false) => {
    let lastSection: string | null = "__init__";
    return items.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.path);
      const badge = getBadge(item.path);
      const showHeader = item.section !== lastSection && item.section !== null;
      lastSection = item.section;

      return (
        <div key={item.path}>
          {showHeader && (
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 px-3 pt-3 pb-1">
              {item.section}
            </p>
          )}
          <Link
            to={item.path}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 transition-colors",
              active
                ? "bg-primary/20 text-foreground font-medium border border-primary/30"
                : dimmed
                  ? "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-sm block">{item.label}</span>
              {item.sub && <span className="text-[10px] text-muted-foreground block leading-tight">{item.sub}</span>}
            </div>
            {badge !== null && badge > 0 && (
              <span className="text-[10px] font-bold tabular-nums text-primary bg-primary/15 rounded px-1.5 py-0.5">
                {badge}
              </span>
            )}
          </Link>
        </div>
      );
    });
  };

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
              <Workflow className="mr-1 h-3.5 w-3.5" /> {workflowMode ? "Dashboard" : "Workflow"}
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <Link to="/style-guide">
                <Settings className="mr-1 h-3.5 w-3.5" /> Prefs
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground hover:bg-accent">
              <LogOut className="mr-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-3.5rem)]">
        {workflowMode && <WorkflowModePanel />}

        {!workflowMode && !sidebarCollapsed && (
          <nav
            className="w-56 shrink-0 border-r border-border py-3 px-2 flex flex-col overflow-y-auto"
            style={{ backdropFilter: "blur(16px)", background: "rgba(5,8,18,0.85)" }}
          >
            {/* Phase 1 */}
            <div className="mb-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70 px-3 pb-1.5">
                Phase 1 · VA Production
              </p>
              <div className="space-y-0.5">
                {renderNavItems(PHASE_1_ITEMS)}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border my-3" />

            {/* Phase 2 */}
            <div className="mb-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 px-3 pb-1.5">
                Phase 2 · Instructor
              </p>
              <div className="space-y-0.5">
                {renderNavItems(PHASE_2_ITEMS, true)}
              </div>
            </div>

            {/* Bottom links */}
            <div className="mt-auto pt-3 border-t border-border space-y-0.5">
              <Link
                to="/marketing"
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs transition-colors",
                  isActive("/marketing") ? "bg-primary/20 text-foreground font-medium border border-primary/30" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20"
                )}
              >
                Marketing
              </Link>
              <Link
                to="/ideas?domain=survive"
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-xs transition-colors",
                  location.pathname === "/ideas" ? "bg-primary/20 text-foreground font-medium border border-primary/30" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20"
                )}
              >
                Ideas
              </Link>
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
