import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, LogOut, PanelLeftClose, PanelLeft,
  Inbox, Factory, Library, FileCheck, Package,
  Rocket, Users, CheckCircle2, Loader2, BarChart3,
  AlertTriangle, CheckSquare, MessageSquare, LayoutDashboard, Wrench, Calculator, BookOpen,
  ChevronRight, CreditCard, ClipboardCheck, TrendingUp, Lock, Building2, Globe, Link as LinkIcon, Settings,
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

const HIDE_PROGRESS_ROUTES = ["/dashboard", "/va-dashboard", "/va-admin", "/accy304-admin"];

// ── Collapsible section hook with localStorage persistence ────────
function useNavSection(key: string, childPaths: string[], pathname: string) {
  const storageKey = `admin_nav_${key}_expanded`;
  const isChildActive = childPaths.some(p => pathname === p || pathname.startsWith(p + "/"));
  const [open, setOpen] = useState(() => {
    if (isChildActive) return true;
    return localStorage.getItem(storageKey) === "true";
  });
  useEffect(() => { if (isChildActive) setOpen(true); }, [pathname, isChildActive]);
  const toggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev;
      localStorage.setItem(storageKey, String(next));
      return next;
    });
  }, [storageKey]);
  return { open, toggle };
}

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

  // Collapsible nav sections
  const qcSection = useNavSection("qc", ["/solutions-qa", "/inbox", "/bulk-fix-tool", "/qa-costs"], location.pathname);
  const chapterWideSection = useNavSection("chapter_wide", ["/admin/chapter-qa", "/survive-chapter", "/chapter-je", "/chapter-formulas"], location.pathname);
  const quizzesSection = useNavSection("quizzes", ["/content", "/quiz-queue", "/quizzes-ready"], location.pathname);
  const settingsSection = useNavSection("settings", ["/asset-stats", "/admin/legacy-links"], location.pathname);

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

  const vaAssignedChapterIds = useMemo(
    () => vaAssignments?.map(a => a.chapter_id) ?? [],
    [vaAssignments]
  );

  const vaFilteredChapters = useMemo(
    () => (allChapters ?? []).filter(ch => vaAssignedChapterIds.includes(ch.id)),
    [allChapters, vaAssignedChapterIds]
  );

  const impersonatingId = impersonating?.id ?? null;
  useEffect(() => {
    if (!isVaOrImpersonating || !allChapters || !courses || !vaAssignments?.length) return;
    const currentIsAssigned = workspace?.chapterId && vaAssignedChapterIds.includes(workspace.chapterId);
    if (currentIsAssigned) return;
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

  // ── Role detection ──────────────────────────────────────────────
  const effectiveRole = impersonating?.role || (isVa ? vaAccount?.role : null);
  const isAdmin = !effectiveRole || effectiveRole === "admin";
  const isLeadVa = effectiveRole === "lead_va";
  const isAdminOrLead = isAdmin || isLeadVa;
  const isContentCreationVa = effectiveRole === "content_creation_va" || effectiveRole === "va_test";
  const isSheetPrepVa = effectiveRole === "sheet_prep_va";

  // ── Nav item renderer ──────────────────────────────────────────
  const renderItem = (label: string, path: string, Icon: any, opts?: { badge?: number | null; dimmed?: boolean; indent?: boolean }) => {
    const active = isActive(path);
    const badge = opts?.badge ?? getBadge(path);
    return (
      <Link
        key={path}
        to={path}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2.5 transition-colors",
          opts?.indent && "pl-7",
          active
            ? "bg-primary/20 text-white font-medium border border-primary/30"
            : opts?.dimmed
              ? "text-white/70 hover:text-white hover:bg-muted/30"
              : "text-white/90 hover:text-white hover:bg-muted/30"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!sidebarCollapsed && <span className="text-sm">{label}</span>}
        {!sidebarCollapsed && badge != null && badge > 0 && (
          <span className="ml-auto inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const renderSectionHeader = (label: string, section: { open: boolean; toggle: () => void }) => {
    if (sidebarCollapsed) return null;
    return (
      <button
        onClick={section.toggle}
        className="flex items-center gap-1 w-full text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 px-3 pb-1.5 pt-1 hover:text-white/80 transition-colors"
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform shrink-0", section.open && "rotate-90")} />
        {label}
      </button>
    );
  };

  const renderTopLabel = (label: string) => {
    if (sidebarCollapsed) return null;
    return (
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary px-3 pb-1.5 pt-1">{label}</p>
    );
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

          {/* Workspace Selectors */}
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

      {/* Mobile workspace selector */}
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
          {/* VA My Dashboard link */}
          {(isVa || impersonating) && !sidebarCollapsed && effectiveRole !== "sheet_prep_va" && (
            renderItem("My Dashboard", "/va-dashboard", LayoutDashboard)
          )}

          {/* Admin: My Dashboard */}
          {isAdmin && !isVa && !impersonating && !sidebarCollapsed && (
            renderItem("My Dashboard", "/dashboard", BarChart3)
          )}

          {/* ═══════ LAUNCH (admin only) ═══════ */}
          {isAdmin && !isVa && !impersonating && !sidebarCollapsed && (
            <>
              <div className="border-t border-border my-3" />
              {renderTopLabel("Launch")}
              <div className="space-y-0.5">
                {renderItem("Campus Landing Pages", "/admin/landing-pages", Globe)}
                {renderItem("Auth & Payments", "/admin/auth", Lock)}
                {renderItem("Greek Portal", "/admin/greek", Building2)}
                {renderItem("Launch Analytics", "/admin/analytics/launch", BarChart3)}
              </div>
            </>
          )}

          {/* ═══════ CONTENT ═══════ */}
          <>
            <div className="border-t border-border my-3" />
            {renderTopLabel("Content")}
            <div className="space-y-0.5">
              {renderItem("Problem Library", "/assets-library", Library)}

              {/* Content Analytics — admin only */}
              {isAdmin && !isVa && !impersonating && (
                renderItem("Content Analytics", "/admin/analytics/content", BarChart3)
              )}

              {/* Quality Control — collapsible */}
              {renderSectionHeader("Quality Control", qcSection)}
              {(sidebarCollapsed || qcSection.open) && (
                <div className="space-y-0.5">
                  {renderItem("Asset QA", "/solutions-qa", ClipboardCheck, { indent: true, badge: qaPendingCount || null })}
                  {renderItem("Fix Assets", "/inbox", Inbox, { indent: true, badge: openIssueCount || null })}
                  {isAdmin && !isVa && !impersonating && (
                    renderItem("QA Costs", "/qa-costs", TrendingUp, { indent: true })
                  )}
                </div>
              )}

              {/* Chapter Wide — admin only, collapsible */}
              {isAdmin && !isVa && !impersonating && (
                <>
                  {renderSectionHeader("Chapter Wide", chapterWideSection)}
                  {(sidebarCollapsed || chapterWideSection.open) && (
                    <div className="space-y-0.5">
                      {renderItem("Chapter QA", "/admin/chapter-qa", BookOpen, { indent: true })}
                      {renderItem("Chapter Content", "/survive-chapter", BookOpen, { indent: true })}
                    </div>
                  )}
                </>
              )}

              {/* Quizzes — collapsible */}
              {renderSectionHeader("Quizzes", quizzesSection)}
              {(sidebarCollapsed || quizzesSection.open) && (
                <div className="space-y-0.5">
                  {renderItem("Generate", "/content", Factory, { indent: true })}
                  {renderItem("Quiz Queue", "/quiz-queue", Package, { indent: true })}
                  {renderItem("Deployment", "/quizzes-ready", Rocket, { indent: true })}
                </div>
              )}
            </div>
          </>

          {/* ═══════ ADMIN ═══════ */}
          <>
            <div className="border-t border-border my-3" />
            {renderTopLabel("Admin")}
            <div className="space-y-0.5">
              {renderItem("VA Admin", "/va-admin", Users)}

              {/* Payment Links — admin only */}
              {isAdmin && !isVa && !impersonating && (
                renderItem("Payment Links", "/payment-links-admin", CreditCard)
              )}

              {/* Settings — admin only, collapsible */}
              {isAdmin && !isVa && !impersonating && (
                <>
                  {renderSectionHeader("Settings", settingsSection)}
                  {(sidebarCollapsed || settingsSection.open) && (
                    <div className="space-y-0.5">
                      {renderItem("Asset Stats", "/asset-stats", BarChart3, { indent: true })}
                      {renderItem("Legacy Links", "/admin/legacy-links", LinkIcon, { indent: true })}
                    </div>
                  )}
                </>
              )}
            </div>
          </>

          {/* VA Tools panel */}
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
              description="Try reloading this component without leaving the app shell."
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
