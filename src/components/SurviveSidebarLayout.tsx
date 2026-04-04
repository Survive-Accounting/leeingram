import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, LogOut, PanelLeftClose, PanelLeft,
  Inbox, Factory, Library, FileCheck, Package,
  Rocket, Globe, Users, CheckCircle2, Loader2, BarChart3,
  AlertTriangle, CheckSquare, MessageSquare, ExternalLink, LayoutDashboard, Wrench, Layers, Calculator, BookOpen, Search,
  ChevronRight, CreditCard, ClipboardCheck, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";
import { DualClock } from "@/components/DualClock";
import { PipelineProgressStrip } from "@/components/PipelineProgressStrip";
import { NextTaskBanner } from "@/components/NextTaskBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { recordVaLogin, logVaActivity } from "@/lib/vaActivityLogger";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Routes that should NOT show the pipeline progress strip ────────
const HIDE_PROGRESS_ROUTES = ["/dashboard", "/va-dashboard", "/va-admin", "/website-admin"];

// ── Sidebar Nav Items ──────────────────────────────────────────────
const PHASE_1_ITEMS = [
  { label: "Import", path: "/problem-bank", icon: Inbox },
  { label: "Generate", path: "/content", icon: Factory },
  { label: "Review", path: "/review", icon: FileCheck },
  { label: "Teaching Assets", altLabel: "Sheet Prep", path: "/assets-library", icon: Library },
];

const PHASE_2_ITEMS = [
  { label: "Topic Generator", path: "/phase2-review", icon: CheckCircle2, adminOnly: true },
  { label: "Quiz Queue", path: "/quiz-queue", icon: Package },
  { label: "Quiz Deployment", path: "/quizzes-ready", icon: Rocket },
];

const QC_ITEMS = [
  { label: "Asset Page QA", path: "/solutions-qa", icon: ClipboardCheck, adminOnly: false },
  { label: "QA Admin", path: "/solutions-qa-admin", icon: ClipboardCheck, adminOnly: true },
  { label: "Inbox", path: "/inbox", icon: Inbox, adminOnly: true },
];

export function SurviveSidebarLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { workspace, setWorkspace } = useActiveWorkspace();
  const { vaAccount, isVa } = useVaAccount();
  const { impersonating } = useImpersonation();
  const qc = useQueryClient();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");
  const [completeOpen, setCompleteOpen] = useState(false);

  // Phase section collapse state — auto-expand if current route is inside that phase
  const phase1Paths = PHASE_1_ITEMS.map(i => i.path);
  const phase2Paths = PHASE_2_ITEMS.map(i => i.path);
  const qcPaths = QC_ITEMS.map(i => i.path);
  const phase3Paths = ["/survive-chapter"];

  const isInPhase = (paths: string[]) => paths.some(p => location.pathname === p || location.pathname.startsWith(p + "/"));

  const [phase1Open, setPhase1Open] = useState(() => isInPhase(PHASE_1_ITEMS.map(i => i.path)));
  const [phase2Open, setPhase2Open] = useState(() => isInPhase(PHASE_2_ITEMS.map(i => i.path)));
  const [qcOpen, setQcOpen] = useState(() => isInPhase(qcPaths));
  const [phase3Open, setPhase3Open] = useState(false);

  // Auto-expand active phase section on route change
  useEffect(() => {
    if (isInPhase(phase1Paths)) setPhase1Open(true);
    if (isInPhase(phase2Paths)) setPhase2Open(true);
    if (isInPhase(qcPaths)) setQcOpen(true);
    if (isInPhase(phase3Paths)) setPhase3Open(true);
  }, [location.pathname]);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  // ── VA: record login ──────────────────────────────────────────────
  useEffect(() => {
    if (!isVa) return;
    if (user?.id) recordVaLogin(user.id);
  }, [isVa, user?.id]);

  // Fetch courses & chapters for workspace selector
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("id, course_name").order("created_at");
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: allChapters } = useQuery({
    queryKey: ["chapters-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch assigned chapters for VA or impersonated VA
  const activeVaId = impersonating?.id || (isVa ? vaAccount?.id : null);
  const { data: vaAssignments } = useQuery({
    queryKey: ["va-assignments-sidebar", activeVaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_assignments")
        .select("chapter_id, course_id")
        .eq("va_account_id", activeVaId!);
      if (error) throw error;
      return data;
    },
    enabled: !!activeVaId,
    staleTime: 10 * 60 * 1000,
  });

  const isVaOrImpersonating = isVa || !!impersonating;

  // For VA/impersonation: filter chapters to assigned ones only
  const vaAssignedChapterIds = useMemo(
    () => vaAssignments?.map(a => a.chapter_id) ?? [],
    [vaAssignments]
  );

  const vaFilteredChapters = useMemo(
    () => (allChapters ?? []).filter(ch => vaAssignedChapterIds.includes(ch.id)),
    [allChapters, vaAssignedChapterIds]
  );

  // Auto-set workspace for VA/impersonation to first assigned chapter
  // Force reset when impersonation changes (so admin's workspace doesn't leak)
  const impersonatingId = impersonating?.id ?? null;
  useEffect(() => {
    if (!isVaOrImpersonating || !allChapters || !courses || !vaAssignments?.length) return;
    // If current workspace is in assigned list, keep it — BUT only if we're not just starting impersonation
    const currentIsAssigned = workspace?.chapterId && vaAssignedChapterIds.includes(workspace.chapterId);
    if (currentIsAssigned) return;
    // Set to first assigned chapter
    const firstAssignment = vaAssignments[0];
    const chapter = allChapters.find(c => c.id === firstAssignment.chapter_id);
    const course = courses.find(c => c.id === firstAssignment.course_id);
    if (chapter && course) {
      setWorkspace({
        courseId: course.id,
        courseName: course.course_name,
        chapterId: chapter.id,
        chapterName: chapter.chapter_name,
        chapterNumber: chapter.chapter_number,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVaOrImpersonating, impersonatingId, vaAssignments, vaAssignedChapterIds, allChapters, courses, setWorkspace]);

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

  // ── Badge counts ────────────────────────────────────────────────
  const { data: pipelineCounts } = useQuery({
    queryKey: ["pipeline-sidebar-counts", workspace?.chapterId],
    queryFn: async () => {
      const chId = workspace!.chapterId;
      const { data: problems } = await supabase.from("chapter_problems").select("id, pipeline_status").eq("chapter_id", chId);
      const imported = problems?.filter(p => p.pipeline_status === "imported").length ?? 0;
      const generated = problems?.filter(p => ["generated"].includes(p.pipeline_status)).length ?? 0;
      const { count: approvedCount } = await supabase.from("teaching_assets").select("id", { count: "exact", head: true }).eq("chapter_id", chId);
      const { count: bankedCount } = await supabase.from("teaching_assets").select("id", { count: "exact", head: true }).eq("chapter_id", chId).not("phase2_status", "is", null);
      return { imported, generated, approved: approvedCount ?? 0, banked: bankedCount ?? 0 };
    },
    enabled: !!workspace?.chapterId,
    staleTime: 30 * 1000,
  });

  // Open issue reports count (global)
  const { data: openIssueCount } = useQuery({
    queryKey: ["open-issue-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("asset_issue_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });

  // QA pending count
  const { data: qaPendingCount } = useQuery({
    queryKey: ["qa-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("solutions_qa_assets" as any)
        .select("id", { count: "exact", head: true })
        .eq("qa_status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });

  const getBadge = (path: string) => {
    if (!pipelineCounts) return null;
    if (path === "/problem-bank") return pipelineCounts.imported || null;
    if (path === "/content") return pipelineCounts.generated || null;
    if (path === "/assets-library") return pipelineCounts.approved || null;
    if (path === "/question-review") return pipelineCounts.banked || null;
    if (path === "/solutions-qa") return qaPendingCount || null;
    return null;
  };

  // ── Mark chapter complete mutation ───────────────────────────────
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!vaAccount || !user) return;
      const now = new Date().toISOString();
      await supabase.from("va_accounts").update({ completed_at: now } as any).eq("id", vaAccount.id);
      await logVaActivity({
        userId: user.id,
        chapterId: vaAccount.assigned_chapter_id || undefined,
        actionType: "chapter_marked_complete",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["va-account"] });
      toast.success("Chapter marked complete!");
      setCompleteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Render nav ──────────────────────────────────────────────────
  const effectiveRole = impersonating?.role || (isVa ? vaAccount?.role : null);
  const isSheetPrepRole = effectiveRole === "sheet_prep_va";

  const renderNavItems = (items: typeof PHASE_1_ITEMS, dimmed = false) =>
    items.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.path);
      const badge = getBadge(item.path);
      const displayLabel = isSheetPrepRole && (item as any).altLabel ? (item as any).altLabel : item.label;
      const issuesBadge = item.path === "/assets-library" && openIssueCount && openIssueCount > 0 ? openIssueCount : null;
      return (
        <Link
          key={item.path}
          to={item.path}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2.5 transition-colors",
            active
              ? "bg-primary/20 text-white font-medium border border-primary/30"
              : dimmed
                ? "text-white/70 hover:text-white hover:bg-muted/30"
                : "text-white/90 hover:text-white hover:bg-muted/30"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span className="text-sm">{displayLabel}</span>}
          {!sidebarCollapsed && badge && !issuesBadge && (
            <span className="ml-auto inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
              {badge}
            </span>
          )}
          {!sidebarCollapsed && issuesBadge && (
            <span className="ml-auto inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
              {issuesBadge}
            </span>
          )}
        </Link>
      );
    });

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
        style={{ backdropFilter: "blur(16px)", background: "rgba(2,4,12,0.95)" }}
      >
        <div className="flex h-12 items-center gap-3 px-4">
          {!isVa && !impersonating && (
            <>
              <button
                onClick={() => navigate("/domains")}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs uppercase tracking-widest"
              >
                <Home className="h-3.5 w-3.5" />
              </button>
              <span className="text-muted-foreground/30">|</span>
            </>
          )}
          <h1 className="font-semibold text-white text-sm">
            {isVa ? `${vaAccount?.full_name}` : "Survive"}
          </h1>

          {/* Workspace Selectors — admin sees all courses+chapters, VA/impersonation sees only assigned chapters */}
          {!isVaOrImpersonating ? (
            <div className="hidden sm:flex items-center gap-2 ml-2">
              <Select value={workspace?.courseId || ""} onValueChange={handleCourseChange}>
                <SelectTrigger className="h-7 text-[11px] w-32 bg-muted/50 border-border text-foreground">
                  <SelectValue placeholder="Course…" />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.course_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={workspace?.chapterId || ""} onValueChange={handleChapterChange} disabled={!workspace?.courseId}>
                <SelectTrigger className="h-7 text-[11px] w-40 bg-muted/50 border-border text-foreground">
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
          ) : (
            <div className="hidden sm:flex items-center gap-2 ml-2">
              {/* VA course selector — derived from assigned chapters */}
              {(() => {
                const assignedCourseIds = [...new Set(vaAssignments?.map(a => a.course_id) ?? [])];
                const vaCourses = courses?.filter(c => assignedCourseIds.includes(c.id)) ?? [];
                return vaCourses.length > 1 ? (
                  <Select value={workspace?.courseId || ""} onValueChange={(courseId) => {
                    const course = courses?.find(c => c.id === courseId);
                    if (!course) return;
                    // Find first assigned chapter in this course
                    const firstChapter = vaFilteredChapters.find(ch => ch.course_id === courseId);
                    if (firstChapter) {
                      setWorkspace({
                        courseId: course.id,
                        courseName: course.course_name,
                        chapterId: firstChapter.id,
                        chapterName: firstChapter.chapter_name,
                        chapterNumber: firstChapter.chapter_number,
                      });
                    } else {
                      setWorkspace({ courseId: course.id, courseName: course.course_name, chapterId: "", chapterName: "", chapterNumber: 0 });
                    }
                  }}>
                    <SelectTrigger className="h-7 text-[11px] w-36 bg-muted/50 border-border text-foreground">
                      <SelectValue placeholder="Course…" />
                    </SelectTrigger>
                    <SelectContent>
                      {vaCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.course_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null;
              })()}
              <Select value={workspace?.chapterId || ""} onValueChange={handleChapterChange}>
                <SelectTrigger className="h-7 text-[11px] w-52 bg-muted/50 border-border text-foreground">
                  <SelectValue placeholder="Select chapter…" />
                </SelectTrigger>
                <SelectContent>
                  {vaFilteredChapters
                    .filter(ch => !workspace?.courseId || ch.course_id === workspace.courseId)
                    .map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      Ch {c.chapter_number} — {c.chapter_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <DualClock />
            <Button variant="ghost" size="sm" onClick={toggleSidebar} className="text-muted-foreground hover:text-foreground h-7 w-7 p-0">
              {sidebarCollapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground h-7 w-7 p-0">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile workspace selector — visible only on small screens */}
      <div
        className="relative z-10 sm:hidden border-b border-border px-3 py-2 flex items-center gap-2"
        style={{ backdropFilter: "blur(16px)", background: "rgba(2,4,12,0.92)" }}
      >
        {!isVaOrImpersonating ? (
          <>
            <Select value={workspace?.courseId || ""} onValueChange={handleCourseChange}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-muted/50 border-border text-foreground">
                <SelectValue placeholder="Course…" />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.course_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={workspace?.chapterId || ""} onValueChange={handleChapterChange} disabled={!workspace?.courseId}>
              <SelectTrigger className="h-8 text-xs flex-[1.3] bg-muted/50 border-border text-foreground">
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
          </>
        ) : (
          <>
            {(() => {
              const assignedCourseIds = [...new Set(vaAssignments?.map(a => a.course_id) ?? [])];
              const vaCourses = courses?.filter(c => assignedCourseIds.includes(c.id)) ?? [];
              return vaCourses.length > 1 ? (
                <Select value={workspace?.courseId || ""} onValueChange={(courseId) => {
                  const course = courses?.find(c => c.id === courseId);
                  if (!course) return;
                  const firstChapter = vaFilteredChapters.find(ch => ch.course_id === courseId);
                  if (firstChapter) {
                    setWorkspace({
                      courseId: course.id,
                      courseName: course.course_name,
                      chapterId: firstChapter.id,
                      chapterName: firstChapter.chapter_name,
                      chapterNumber: firstChapter.chapter_number,
                    });
                  }
                }}>
                  <SelectTrigger className="h-8 text-xs flex-1 bg-muted/50 border-border text-foreground">
                    <SelectValue placeholder="Course…" />
                  </SelectTrigger>
                  <SelectContent>
                    {vaCourses.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{c.course_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null;
            })()}
            <Select value={workspace?.chapterId || ""} onValueChange={handleChapterChange}>
              <SelectTrigger className="h-8 text-xs flex-[1.3] bg-muted/50 border-border text-foreground">
                <SelectValue placeholder="Chapter…" />
              </SelectTrigger>
              <SelectContent>
                {vaFilteredChapters
                  .filter(ch => !workspace?.courseId || ch.course_id === workspace.courseId)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      Ch {c.chapter_number} — {c.chapter_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <div className="relative z-10 flex min-h-[calc(100vh-3rem)]">
        {/* Sidebar */}
        <nav
          className={cn(
            "shrink-0 border-r border-border py-3 px-2 flex flex-col overflow-y-auto transition-all",
            sidebarCollapsed ? "w-14" : "w-48"
          )}
          style={{ backdropFilter: "blur(16px)", background: "rgba(2,4,12,0.95)" }}
        >
          {/* VA My Dashboard link — hidden for sheet_prep_va */}
          {(isVa || impersonating) && !sidebarCollapsed && effectiveRole !== "sheet_prep_va" && (
            <Link
              to="/va-dashboard"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2.5 mb-2 transition-colors",
                isActive("/va-dashboard")
                  ? "bg-primary/20 text-white font-medium border border-primary/30"
                  : "text-white/90 hover:text-white hover:bg-muted/30"
              )}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span className="text-sm">My Dashboard</span>
            </Link>
          )}

          {/* Determine effective role for sidebar filtering */}
          {(() => {
            const effectiveRole = impersonating?.role || (isVa ? vaAccount?.role : null);
            const isContentCreationVa = effectiveRole === "content_creation_va" || effectiveRole === "va_test";
            const isSheetPrepVa = effectiveRole === "sheet_prep_va";
            const isLeadVa = effectiveRole === "lead_va";
            const isLeadVaOrAdmin = isLeadVa || effectiveRole === "admin" || !effectiveRole;

            // Content Creation VA: Import, Generate, Review, Teaching Assets
            const phase1Items = isSheetPrepVa
              ? PHASE_1_ITEMS.filter(i => i.path === "/assets-library")
              : PHASE_1_ITEMS;

            // Sheet Prep VA: only Teaching Assets + Deploy Checklist
            const showPhase2 = isLeadVaOrAdmin || isSheetPrepVa;
             const phase2Items = isSheetPrepVa
              ? PHASE_2_ITEMS.filter(i => i.path === "/deployment")
              : isLeadVaOrAdmin
                ? PHASE_2_ITEMS
                : PHASE_2_ITEMS.filter(i => !(i as any).adminOnly);

            return (
              <>
                {/* Admin: My Dashboard at top */}
                {isLeadVaOrAdmin && !isVa && !impersonating && !sidebarCollapsed && (
                  <Link
                    to="/dashboard"
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2.5 mb-3 transition-colors",
                      isActive("/dashboard")
                        ? "bg-primary/20 text-white font-medium border border-primary/30"
                        : "text-white/90 hover:text-white hover:bg-muted/30"
                    )}
                  >
                    <BarChart3 className="h-4 w-4 shrink-0" />
                    <span className="text-sm">My Dashboard</span>
                  </Link>
                )}

                {/* Phase 1 — collapsible (hidden for Content Creation VAs) */}
                {!isContentCreationVa && (
                  <>
                    {!sidebarCollapsed && (
                      <button
                        onClick={() => setPhase1Open(p => !p)}
                        className="flex items-center gap-1 w-full text-[9px] font-bold uppercase tracking-[0.2em] text-primary px-3 pb-1.5 hover:text-primary/80 transition-colors"
                      >
                        <ChevronRight className={cn("h-3 w-3 transition-transform shrink-0", phase1Open && "rotate-90")} />
                        Phase 1 · Teaching Asset Creation
                      </button>
                    )}
                    {(sidebarCollapsed || phase1Open) && (
                      <div className="space-y-0.5">{renderNavItems(phase1Items)}</div>
                    )}
                  </>
                )}

                {showPhase2 && (
                  <>
                    <div className="border-t border-border my-3" />
                    {!sidebarCollapsed && (
                      <button
                        onClick={() => setPhase2Open(p => !p)}
                        className="flex items-center gap-1 w-full text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 px-3 pb-1.5 hover:text-white/80 transition-colors"
                      >
                        <ChevronRight className={cn("h-3 w-3 transition-transform shrink-0", phase2Open && "rotate-90")} />
                        Phase 2 · Content Production
                      </button>
                    )}
                    {(sidebarCollapsed || phase2Open) && (
                      <div className="space-y-0.5">{renderNavItems(phase2Items, true)}</div>
                    )}
                  </>
                )}




                {/* Phase 3 · Study Tools — admin and lead_va */}
                {isLeadVaOrAdmin && !(isContentCreationVa || isSheetPrepVa) && (
                  <>
                    <div className="border-t border-border my-3" />
                    {!sidebarCollapsed && (
                      <button
                        onClick={() => setPhase3Open(p => !p)}
                        className="flex items-center gap-1 w-full text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 px-3 pb-1.5 hover:text-white/80 transition-colors"
                      >
                        <ChevronRight className={cn("h-3 w-3 transition-transform shrink-0", phase3Open && "rotate-90")} />
                        Phase 3 · Study Tools
                      </button>
                    )}
                    {(sidebarCollapsed || phase3Open) && (
                      <div className="space-y-0.5">
                        <Link
                          to="/survive-chapter"
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-3 py-2.5 transition-colors",
                            isActive("/survive-chapter")
                              ? "bg-primary/20 text-white font-medium border border-primary/30"
                              : "text-white/70 hover:text-white hover:bg-muted/30"
                          )}
                        >
                          <BookOpen className="h-4 w-4 shrink-0" />
                          {!sidebarCollapsed && <span className="text-sm">Survive This Chapter</span>}
                        </Link>
                      </div>
                    )}
                  </>
                )}

                {/* Quality Control section — visible to all roles */}
                {(showPhase2 || isContentCreationVa) && (
                  <>
                    <div className="border-t border-border my-3" />
                    {!sidebarCollapsed && (
                      <button
                        onClick={() => setQcOpen(p => !p)}
                        className="flex items-center gap-1 w-full text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 px-3 pb-1.5 hover:text-white/80 transition-colors"
                      >
                        <ChevronRight className={cn("h-3 w-3 transition-transform shrink-0", qcOpen && "rotate-90")} />
                        Quality Control
                      </button>
                    )}
                    {(sidebarCollapsed || qcOpen) && (
                      <div className="space-y-0.5">{renderNavItems(QC_ITEMS.filter(i => !i.adminOnly || isLeadVaOrAdmin))}</div>
                    )}
                  </>
                )}
              </>
            );
          })()}

          {/* VA Tools panel — show for actual VAs or when impersonating */}
          {(isVa || impersonating) && !sidebarCollapsed && (() => {
            const toolsRole = impersonating?.role || (isVa ? vaAccount?.role : null);
            const showSheetPrepDone = toolsRole === "sheet_prep_va";
            return (
              <>
                <div className="border-t border-border my-3" />
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary px-3 pb-1.5">
                  VA Tools
                </p>
                <div className="space-y-0.5">
                  <a
                    href="https://forms.gle/QnWFjHKc1DxaGVjMA"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-white/80 hover:text-white hover:bg-muted/30 transition-colors"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs">Report Issue</span>
                  </a>
                  {showSheetPrepDone && (
                    <a
                      href="https://forms.gle/7Dz2i8eKiRangmNs9"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-white/80 hover:text-white hover:bg-muted/30 transition-colors"
                    >
                      <CheckSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs">Sheet Prep Done</span>
                    </a>
                  )}
                  <a
                    href="https://forms.gle/QLCMqsV1YZMbkfSD8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-md px-3 py-2 text-white/80 hover:text-white hover:bg-muted/30 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs">Feedback / Idea</span>
                  </a>
                </div>
              </>
            );
          })()}

          {/* Bottom section */}
          <div className="mt-auto pt-3 border-t border-border space-y-1">
            {/* VA: Mark Complete button */}
            {isVa && !vaAccount?.completed_at && !sidebarCollapsed && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => setCompleteOpen(true)}
              >
                <CheckCircle2 className="h-3 w-3 mr-1.5" /> Mark Complete
              </Button>
            )}
            {isVa && vaAccount?.completed_at && !sidebarCollapsed && (
              <div className="text-[10px] text-emerald-400 text-center py-1.5">
                ✓ Chapter Complete
              </div>
            )}

            {/* Admin: VA Admin, Bulk Fix, QA Admin — admin only (not lead_va) */}
            {!isVa && !impersonating && !sidebarCollapsed && (
              <>
                <Link
                  to="/va-admin"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                    isActive("/va-admin")
                      ? "bg-primary/20 text-foreground font-medium border border-primary/30"
                      : "text-white/70 hover:text-white hover:bg-muted/30"
                  )}
                >
                  <Users className="h-3.5 w-3.5" /> VA Admin
                </Link>
                <Link
                  to="/bulk-fix-tool"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                    isActive("/bulk-fix-tool")
                      ? "bg-primary/20 text-foreground font-medium border border-primary/30"
                      : "text-white/70 hover:text-white hover:bg-muted/30"
                  )}
                >
                  <Wrench className="h-3.5 w-3.5" /> Bulk Fix Tool
                </Link>
                <Link
                  to="/solutions-qa-admin"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                    isActive("/solutions-qa-admin")
                      ? "bg-primary/20 text-foreground font-medium border border-primary/30"
                      : "text-white/70 hover:text-white hover:bg-muted/30"
                  )}
                >
                  <ClipboardCheck className="h-3.5 w-3.5" /> QA Admin
                </Link>
                <Link
                  to="/website-admin"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                    isActive("/website-admin")
                      ? "bg-primary/20 text-foreground font-medium border border-primary/30"
                      : "text-white/70 hover:text-white hover:bg-muted/30"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" /> Website
                </Link>
              </>
            )}
            {/* Settings — visible to admin and lead_va */}
            {(!isVa || effectiveRole === "lead_va") && !sidebarCollapsed && !(impersonating && impersonating.role !== "lead_va") && (
              <>
                <div className="border-t border-border my-2" />
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 px-3 pb-1">Settings</p>
                <Link
                  to="/payment-links-admin"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                    isActive("/payment-links-admin")
                      ? "bg-primary/20 text-foreground font-medium border border-primary/30"
                      : "text-white/70 hover:text-white hover:bg-muted/30"
                  )}
                >
                  <CreditCard className="h-3.5 w-3.5" /> Payment Links
                </Link>
                <Link
                  to="/asset-stats"
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                    isActive("/asset-stats")
                      ? "bg-primary/20 text-foreground font-medium border border-primary/30"
                      : "text-white/70 hover:text-white hover:bg-muted/30"
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" /> Asset Stats
                </Link>
              </>
            )}
          </div>
        </nav>

        <main className="flex-1 overflow-auto relative">
          {!HIDE_PROGRESS_ROUTES.some(r => location.pathname === r || location.pathname.startsWith(r + "/")) && (
            <PipelineProgressStrip />
          )}
          <NextTaskBanner />
          <div
            className="mx-4 sm:mx-6 mb-6 mt-1 rounded-xl p-5 bg-card border border-border"
            style={{
              boxShadow: "0 4px 24px -4px rgba(0,0,0,0.4)",
            }}
          >
            <ErrorBoundary
              resetKey={`${location.pathname}${location.search}`}
              title="This workspace panel hit a runtime error"
              description="Try reloading this component without losing the rest of the app shell."
            >
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Mark Complete confirmation dialog */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Chapter Complete?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will stamp your completion time. You can still access the chapter afterward for review.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCompleteOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
              Confirm Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
