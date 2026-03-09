import { useMemo } from "react";
import { useVaAccounts, useVaAssignments, useVaActivityLog, useVaQuestions, useChaptersWithCourses } from "@/hooks/useAdminDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, MessageCircle, Activity } from "lucide-react";

export function VaManagement() {
  const { data: vaAccounts, isLoading: vaLoading } = useVaAccounts();
  const { data: assignments } = useVaAssignments();
  const { data: activityLog } = useVaActivityLog();
  const { data: questions } = useVaQuestions();
  const { data: chapCourses } = useChaptersWithCourses();

  const vaMap = useMemo(() => {
    if (!vaAccounts) return new Map();
    return new Map(vaAccounts.map((va: any) => [va.id, va]));
  }, [vaAccounts]);

  const chapterMap = useMemo(() => {
    if (!chapCourses) return new Map();
    return new Map(chapCourses.chapters.map(ch => [ch.id, ch]));
  }, [chapCourses]);

  const courseMap = useMemo(() => {
    if (!chapCourses) return new Map();
    return new Map(chapCourses.courses.map(co => [co.id, co]));
  }, [chapCourses]);

  // VA Performance snapshot
  const performanceRows = useMemo(() => {
    if (!vaAccounts || !assignments || !activityLog) return [];
    return vaAccounts.map((va: any) => {
      const vaAssigns = assignments.filter((a: any) => a.va_account_id === va.id);
      const vaActions = activityLog.filter((a: any) => a.user_id === va.user_id);
      const approvedCount = vaActions.filter((a: any) => a.action_type === "approve_variant" || a.action_type === "approved_asset").length;
      const hoursLogged = vaAssigns.reduce((sum: number, a: any) => sum + (Number(a.hours_logged) || 0), 0);
      const assetsPerHour = hoursLogged > 0 ? (approvedCount / hoursLogged).toFixed(1) : "—";
      const flaggedCount = vaActions.filter((a: any) => a.action_type === "flag_asset").length;
      return {
        id: va.id,
        name: va.full_name,
        chaptersAssigned: vaAssigns.length,
        approved: approvedCount,
        hoursLogged: hoursLogged.toFixed(1),
        assetsPerHour,
        flagged: flaggedCount,
      };
    });
  }, [vaAccounts, assignments, activityLog]);

  if (vaLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading VA data…</div>;
  }

  return (
    <div className="space-y-6">
      {/* VA Performance Snapshot */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> VA Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2">VA Name</th>
                <th className="text-right py-2 px-2">Chapters</th>
                <th className="text-right py-2 px-2">Approved</th>
                <th className="text-right py-2 px-2">Hours</th>
                <th className="text-right py-2 px-2">Assets/Hr</th>
                <th className="text-right py-2 px-2">Flagged</th>
              </tr>
            </thead>
            <tbody>
              {performanceRows.map(r => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/50">
                  <td className="py-1.5 text-foreground font-medium">{r.name}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.chaptersAssigned}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.approved}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.hoursLogged}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.assetsPerHour}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.flagged}</td>
                </tr>
              ))}
              {performanceRows.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No VA accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Chapter Assignments */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Chapter Assignments</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2">VA</th>
                <th className="text-left py-2">Course</th>
                <th className="text-left py-2">Chapter</th>
                <th className="text-left py-2">Assigned</th>
                <th className="text-right py-2 px-2">Hours</th>
                <th className="text-center py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(assignments || []).map((a: any) => {
                const va = vaMap.get(a.va_account_id);
                const ch = chapterMap.get(a.chapter_id);
                const co = courseMap.get(a.course_id);
                return (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/50">
                    <td className="py-1.5 text-foreground">{va?.full_name || "—"}</td>
                    <td className="py-1.5 text-muted-foreground">{co?.course_name || "—"}</td>
                    <td className="py-1.5 text-foreground">Ch {ch?.chapter_number || "?"} — {ch?.chapter_name || "—"}</td>
                    <td className="py-1.5 text-muted-foreground">{new Date(a.assigned_at).toLocaleDateString()}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{Number(a.hours_logged || 0).toFixed(1)}</td>
                    <td className="py-1.5 text-center">
                      <Badge variant="outline" className="text-[9px] capitalize">{a.status?.replace(/_/g, " ")}</Badge>
                    </td>
                  </tr>
                );
              })}
              {(!assignments || assignments.length === 0) && (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No assignments yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {(activityLog || []).slice(0, 50).map((log: any) => {
              const va = Array.from(vaMap.values()).find((v: any) => v.user_id === log.user_id);
              return (
                <div key={log.id} className="flex items-center gap-3 text-xs py-1 border-b border-border/30">
                  <span className="text-muted-foreground min-w-[90px]">{new Date(log.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="text-foreground font-medium">{(va as any)?.full_name || log.user_id?.slice(0, 8)}</span>
                  <Badge variant="outline" className="text-[9px]">{log.action_type?.replace(/_/g, " ")}</Badge>
                </div>
              );
            })}
            {(!activityLog || activityLog.length === 0) && (
              <p className="text-center text-muted-foreground py-4 text-xs">No activity recorded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* VA Questions */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" /> VA Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(questions || []).map((q: any) => {
              const va = vaMap.get(q.va_account_id);
              const ch = chapterMap.get(q.chapter_id);
              return (
                <div key={q.id} className="p-2 rounded-lg bg-secondary/50 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{(va as any)?.full_name || "Unknown VA"}</span>
                    <Badge variant="outline" className={`text-[9px] ${q.status === "open" ? "border-yellow-500/40 text-yellow-400" : "border-emerald-500/40 text-emerald-400"}`}>
                      {q.status}
                    </Badge>
                  </div>
                  {ch && <p className="text-muted-foreground">Ch {ch.chapter_number} — {ch.chapter_name}</p>}
                  <p className="text-foreground">{q.question}</p>
                  <p className="text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</p>
                </div>
              );
            })}
            {(!questions || questions.length === 0) && (
              <p className="text-center text-muted-foreground py-4 text-xs">No questions submitted yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
