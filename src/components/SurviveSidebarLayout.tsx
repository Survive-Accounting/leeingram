import { useState, useMemo, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, LogOut, PanelLeftClose, PanelLeft,
  Inbox, Factory, Library, FileCheck, Package, Video, VideoOff,
  Rocket, Users, CheckCircle2, Loader2, ClipboardList, Download, BarChart3,
  AlertTriangle, CheckSquare, MessageSquare, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import aorakiBg from "@/assets/aoraki-bg.jpg";
import { NightSkyOverlay } from "@/components/NightSkyOverlay";
import { PipelineProgressStrip } from "@/components/PipelineProgressStrip";
import { NextTaskBanner } from "@/components/NextTaskBanner";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useVaAccount } from "@/hooks/useVaAccount";
import { recordVaLogin, logVaActivity } from "@/lib/vaActivityLogger";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Sidebar Nav Items ──────────────────────────────────────────────
const PHASE_1_ITEMS = [
  { label: "Import", path: "/problem-bank", icon: Inbox },
  { label: "Generate", path: "/content", icon: Factory },
  { label: "Review", path: "/review", icon: FileCheck },
  { label: "Teaching Assets", path: "/assets-library", icon: Library },
];

const PHASE_2_ITEMS = [
  { label: "MC Generator", path: "/question-review", icon: Package },
  { label: "Quizzes Ready", path: "/quizzes-ready", icon: Download },
  { label: "Video Pending", path: "/video-pending", icon: VideoOff },
  { label: "Videos Ready", path: "/videos-ready", icon: Video },
  { label: "Deploy Checklist", path: "/deployment", icon: ClipboardList },
  { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
];

export function SurviveSidebarLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { workspace, setWorkspace } = useActiveWorkspace();
  const { vaAccount, isVa } = useVaAccount();
  const qc = useQueryClient();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "true");
  const [completeOpen, setCompleteOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  // ── VA: auto-lock workspace to assigned chapter ──────────────────
  useEffect(() => {
    if (!isVa || !vaAccount?.assigned_course_id || !vaAccount?.assigned_chapter_id) return;
    // Record login
    if (user?.id) recordVaLogin(user.id);
  }, [isVa, vaAccount, user?.id]);

  // Fetch courses & chapters for workspace selector
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

  // Auto-set workspace for VA users once data is loaded
  useEffect(() => {
    if (!isVa || !vaAccount?.assigned_course_id || !vaAccount?.assigned_chapter_id) return;
    if (!courses || !allChapters) return;
    // Already set to correct chapter?
    if (workspace?.chapterId === vaAccount.assigned_chapter_id) return;

    const course = courses.find(c => c.id === vaAccount.assigned_course_id);
    const chapter = allChapters.find(c => c.id === vaAccount.assigned_chapter_id);
    if (course && chapter) {
      setWorkspace({
        courseId: course.id,
        courseName: course.course_name,
        chapterId: chapter.id,
        chapterName: chapter.chapter_name,
        chapterNumber: chapter.chapter_number,
      });
    }
  }, [isVa, vaAccount, courses, allChapters, workspace?.chapterId, setWorkspace]);

  const filteredChapters = useMemo(
    () => (allChapters ?? []).filter((ch) => ch.course_id === workspace?.courseId),
    [allChapters, workspace?.courseId]
  );

  const handleCourseChange = (courseId: string) => {
    const course = courses?.find((c) => c.id === courseId);
    if (!course) return;
    setWorkspace({ courseId: course.id, courseName: course.course_name, chapterId: "", chapterName: "", chapterNumber: 0 });
  };

  const handleChapterChange = async (chapterId: string) => {
    const ch = allChapters?.find((c) => c.id === chapterId);
    if (!ch || !workspace) return;
    setWorkspace({ ...workspace, chapterId: ch.id, chapterName: ch.chapter_name, chapterNumber: ch.chapter_number });

    // Check if chapter has approved teaching assets → navigate to assets library, else import
    const { count } = await supabase
      .from("teaching_assets")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId);
    if (count && count > 0) {
      navigate("/assets-library");
    } else {
      navigate("/problem-bank");
    }
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
      const { count: bankedCount } = await supabase.from("banked_questions").select("id", { count: "exact", head: true });
      return { imported, generated, approved: approvedCount ?? 0, banked: bankedCount ?? 0 };
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
  const renderNavItems = (items: typeof PHASE_1_ITEMS, dimmed = false) =>
    items.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.path);
      const badge = getBadge(item.path);
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
          {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
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
          {!isVa && (
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
            {isVa ? `${vaAccount?.full_name} — VA Test` : "Survive"}
          </h1>

          {/* Workspace Selectors — hidden for VA users (locked to assigned chapter) */}
          {!isVa && (
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
          )}

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={toggleSidebar} className="text-muted-foreground hover:text-foreground h-7 w-7 p-0">
              {sidebarCollapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground h-7 w-7 p-0">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex min-h-[calc(100vh-3rem)]">
        {/* Sidebar */}
        <nav
          className={cn(
            "shrink-0 border-r border-border py-3 px-2 flex flex-col overflow-y-auto transition-all",
            sidebarCollapsed ? "w-14" : "w-48"
          )}
          style={{ backdropFilter: "blur(16px)", background: "rgba(2,4,12,0.95)" }}
        >
          {!sidebarCollapsed && (
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary px-3 pb-1.5">
              Phase 1 · Teaching Asset Creation
            </p>
          )}
          <div className="space-y-0.5">{renderNavItems(PHASE_1_ITEMS)}</div>

          {/* Phase 2 — hidden for VA test users */}
          {!isVa && (
            <>
              <div className="border-t border-border my-3" />
              {!sidebarCollapsed && (
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 px-3 pb-1.5">
                  Phase 2 · Content Production
                </p>
              )}
              <div className="space-y-0.5">{renderNavItems(PHASE_2_ITEMS, true)}</div>
            </>
          )}

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

            {/* Admin: VA Admin link */}
            {!isVa && !sidebarCollapsed && (
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
            )}
          </div>
        </nav>

        <main className="flex-1 overflow-auto relative">
          <PipelineProgressStrip />
          <NextTaskBanner />
          <div
            className="mx-4 sm:mx-6 mb-6 mt-1 rounded-xl p-5 bg-card border border-border"
            style={{
              boxShadow: "0 4px 24px -4px rgba(0,0,0,0.4)",
            }}
          >
            {children}
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
