import { useMemo } from "react";
import { useVaAccounts, useVaAssignments, useVaActivityLog, useVaQuestions, useChaptersWithCourses } from "@/hooks/useAdminDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Users, MessageCircle, MapPin, Clock, BookOpen } from "lucide-react";

export function VaManagement() {
  const { data: vaAccounts, isLoading: vaLoading } = useVaAccounts();
  const { data: assignments } = useVaAssignments();
  const { data: activityLog } = useVaActivityLog();
  const { data: questions } = useVaQuestions();
  const { data: chapCourses } = useChaptersWithCourses();

  const chapterMap = useMemo(() => {
    if (!chapCourses) return new Map();
    return new Map(chapCourses.chapters.map(ch => [ch.id, ch]));
  }, [chapCourses]);

  const courseMap = useMemo(() => {
    if (!chapCourses) return new Map();
    return new Map(chapCourses.courses.map(co => [co.id, co]));
  }, [chapCourses]);

  const vaProfiles = useMemo(() => {
    if (!vaAccounts || !assignments) return [];
    return vaAccounts.map((va: any) => {
      const vaAssigns = assignments.filter((a: any) => a.va_account_id === va.id);
      const vaActions = activityLog?.filter((a: any) => a.user_id === va.user_id) || [];
      const approvedCount = vaActions.filter((a: any) =>
        a.action_type === "approve_variant" || a.action_type === "approved_asset"
      ).length;
      const flaggedCount = vaActions.filter((a: any) => a.action_type === "flag_asset").length;
      const hoursLogged = vaAssigns.reduce((sum: number, a: any) => sum + (Number(a.hours_logged) || 0), 0);

      // Chapter breakdown by course
      const courseChapters = new Map<string, string[]>();
      for (const a of vaAssigns) {
        const co = courseMap.get(a.course_id);
        const ch = chapterMap.get(a.chapter_id);
        const courseName = co?.course_name || "Unknown";
        if (!courseChapters.has(courseName)) courseChapters.set(courseName, []);
        courseChapters.get(courseName)!.push(`Ch ${ch?.chapter_number || "?"}`);
      }

      // Account age in days
      const daysSinceCreated = Math.floor((Date.now() - new Date(va.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const daysSinceLogin = va.first_login_at
        ? Math.floor((Date.now() - new Date(va.first_login_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const lastActive = va.last_action_at
        ? new Date(va.last_action_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : va.first_login_at
          ? new Date(va.first_login_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "Never";

      return {
        id: va.id,
        name: va.full_name,
        email: va.email,
        role: va.role,
        status: va.account_status,
        chaptersAssigned: vaAssigns.length,
        courseChapters,
        approved: approvedCount,
        flagged: flaggedCount,
        hoursLogged: hoursLogged.toFixed(1),
        assetsPerHour: hoursLogged > 0 ? (approvedCount / hoursLogged).toFixed(1) : "—",
        daysSinceCreated,
        daysSinceLogin,
        lastActive,
        firstLogin: va.first_login_at
          ? new Date(va.first_login_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "—",
      };
    });
  }, [vaAccounts, assignments, activityLog, chapterMap, courseMap]);

  const openQuestions = useMemo(() =>
    questions?.filter((q: any) => q.status === "open") || [],
  [questions]);

  const roleLabels: Record<string, string> = {
    content_creation_va: "Content Creation",
    sheet_prep_va: "Sheet Prep",
    lead_va: "Lead VA",
    admin: "Admin",
    va_test: "Test",
  };

  const roleBadgeColors: Record<string, string> = {
    content_creation_va: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    sheet_prep_va: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    lead_va: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    admin: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };

  if (vaLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading VA data…</div>;
  }

  return (
    <div className="space-y-6">
      {/* ─── Summary Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{vaProfiles.length}</p>
            <p className="text-[11px] text-muted-foreground">Active VAs</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{assignments?.length || 0}</p>
            <p className="text-[11px] text-muted-foreground">Total Assignments</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{vaProfiles.reduce((s, v) => s + v.approved, 0)}</p>
            <p className="text-[11px] text-muted-foreground">Assets Approved</p>
          </CardContent>
        </Card>
        <Card className={`border-border ${openQuestions.length > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-card"}`}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${openQuestions.length > 0 ? "text-amber-400" : "text-foreground"}`}>{openQuestions.length}</p>
            <p className="text-[11px] text-muted-foreground">Open Questions</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── VA Profile Cards ─── */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Team Members
        </h3>
        {vaProfiles.map(va => (
          <Card key={va.id} className="border-border">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground">
                    {va.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{va.name}</p>
                    <p className="text-[11px] text-muted-foreground">{va.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${roleBadgeColors[va.role] || "bg-muted text-muted-foreground"}`}>
                    {roleLabels[va.role] || va.role}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${va.status === "active" ? "border-emerald-500/40 text-emerald-400" : "border-destructive/40 text-destructive"}`}>
                    {va.status}
                  </Badge>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-secondary/50 rounded-lg py-2">
                  <p className="text-lg font-bold text-foreground tabular-nums">{va.chaptersAssigned}</p>
                  <p className="text-[10px] text-muted-foreground">Chapters</p>
                </div>
                <div className="bg-secondary/50 rounded-lg py-2">
                  <p className="text-lg font-bold text-foreground tabular-nums">{va.approved}</p>
                  <p className="text-[10px] text-muted-foreground">Approved</p>
                </div>
                <div className="bg-secondary/50 rounded-lg py-2">
                  <p className="text-lg font-bold text-foreground tabular-nums">{va.flagged}</p>
                  <p className="text-[10px] text-muted-foreground">Flagged</p>
                </div>
                <div className="bg-secondary/50 rounded-lg py-2">
                  <p className="text-lg font-bold text-foreground tabular-nums">{va.assetsPerHour}</p>
                  <p className="text-[10px] text-muted-foreground">Assets/Hr</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> First login: {va.firstLogin}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Last active: {va.lastActive}</span>
                <span>{va.daysSinceCreated}d since onboarded</span>
              </div>

              {/* Chapter Assignments Breakdown */}
              {va.courseChapters.size > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> Assigned Chapters
                  </p>
                  {Array.from(va.courseChapters.entries()).map(([course, chs]) => (
                    <div key={course} className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground min-w-[120px] truncate">{course}:</span>
                      <span className="text-foreground">{chs.sort((a, b) => parseInt(a.replace("Ch ", "")) - parseInt(b.replace("Ch ", ""))).join(", ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {vaProfiles.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-xs">No VA accounts found.</p>
        )}
      </div>

      {/* ─── Open Questions ─── */}
      {openQuestions.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-amber-400" /> Open Questions ({openQuestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openQuestions.map((q: any) => {
              const va = vaAccounts?.find((v: any) => v.id === q.va_account_id);
              const ch = chapterMap.get(q.chapter_id);
              return (
                <div key={q.id} className="p-3 rounded-lg bg-secondary/50 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{(va as any)?.full_name || "Unknown"}</span>
                    <span className="text-muted-foreground tabular-nums">{new Date(q.created_at).toLocaleDateString()}</span>
                  </div>
                  {ch && <p className="text-muted-foreground">Ch {ch.chapter_number} — {ch.chapter_name}</p>}
                  <p className="text-foreground">{q.question}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
