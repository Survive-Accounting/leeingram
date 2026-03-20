import { useMemo, useState } from "react";
import { useTeachingAssets, useChaptersWithCourses, useAssetFlags } from "@/hooks/useAdminDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, CheckCircle2, Video, Upload, Rocket, AlertTriangle, FileText,
  ArrowRight, BookOpen, Layers, TrendingUp
} from "lucide-react";

/* ─── Metric Card ─── */
function MetricCard({ label, value, icon: Icon, accent, sub }: {
  label: string; value: number; icon?: any; accent?: string; sub?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {Icon && <div className={`p-2 rounded-lg bg-secondary ${accent || "text-primary"}`}><Icon className="h-4 w-4" /></div>}
          <div className="min-w-0">
            <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            {sub && <p className="text-[10px] text-muted-foreground/60">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Pipeline Stage Arrow ─── */
function PipelineStage({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex-1 text-center">
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <div className="mt-1 mx-auto w-full max-w-[80px]">
        <Progress value={pct} className="h-1" />
      </div>
      <p className="text-[9px] text-muted-foreground/60 tabular-nums">{pct}%</p>
    </div>
  );
}

export function ProductionOverview() {
  const { data: assets, isLoading: assetsLoading } = useTeachingAssets();
  const { data: chapCourses, isLoading: chapLoading } = useChaptersWithCourses();
  const { data: flags } = useAssetFlags();
  const [courseFilter, setCourseFilter] = useState("all");

  const metrics = useMemo(() => {
    if (!assets) return null;
    const total = assets.length;
    const approved = assets.filter(a => a.asset_approved_at).length;
    const sheetsCreated = assets.filter(a => (a as any).google_sheet_status === "created").length;
    const mcGenerated = assets.filter(a => a.banked_generation_status === "completed").length;
    const filmed = assets.filter(a => ["recorded", "editing", "edited", "ready"].includes(a.video_production_status)).length;
    const edited = assets.filter(a => ["edited", "ready"].includes(a.video_production_status)).length;
    const uploaded = assets.filter(a => a.video_production_status === "ready").length;
    const deployed = assets.filter(a => a.deployment_status === "completed").length;

    // Source types
    const sourceMap = new Map<string, number>();
    for (const a of assets) {
      const t = a.source_type || "Unknown";
      sourceMap.set(t, (sourceMap.get(t) || 0) + 1);
    }

    // Problem types
    const typeMap = new Map<string, number>();
    for (const a of assets) {
      const t = a.problem_type || "Unknown";
      typeMap.set(t, (typeMap.get(t) || 0) + 1);
    }

    return { total, approved, sheetsCreated, mcGenerated, filmed, edited, uploaded, deployed, sourceMap, typeMap };
  }, [assets]);

  const { chapterRows, courseRows } = useMemo(() => {
    if (!assets || !chapCourses) return { chapterRows: [], courseRows: [] };
    const { chapters, courses } = chapCourses;
    const courseMap = new Map(courses.map(c => [c.id, c]));

    const chRows = chapters.map(ch => {
      const chAssets = assets.filter(a => a.chapter_id === ch.id);
      if (chAssets.length === 0) return null;
      const approved = chAssets.filter(a => a.asset_approved_at).length;
      const mc = chAssets.filter(a => a.banked_generation_status === "completed").length;
      const filmed = chAssets.filter(a => ["recorded", "editing", "edited", "ready"].includes(a.video_production_status)).length;
      const deployed = chAssets.filter(a => a.deployment_status === "completed").length;
      const course = courseMap.get(ch.course_id);
      return {
        id: ch.id, courseId: ch.course_id, courseName: course?.course_name || "—",
        chapterNum: ch.chapter_number, chapterName: ch.chapter_name,
        total: chAssets.length, approved, mc, filmed, deployed,
        completionPct: Math.round((approved / chAssets.length) * 100),
      };
    }).filter(Boolean) as any[];

    const coRows = courses.map(co => {
      const coAssets = assets.filter(a => a.course_id === co.id);
      if (coAssets.length === 0) return null;
      const approved = coAssets.filter(a => a.asset_approved_at).length;
      const mc = coAssets.filter(a => a.banked_generation_status === "completed").length;
      const filmed = coAssets.filter(a => ["recorded", "editing", "edited", "ready"].includes(a.video_production_status)).length;
      const deployed = coAssets.filter(a => a.deployment_status === "completed").length;
      return { id: co.id, name: co.course_name, code: co.code, total: coAssets.length, approved, mc, filmed, deployed };
    }).filter(Boolean) as any[];

    return { chapterRows: chRows, courseRows: coRows };
  }, [assets, chapCourses]);

  const filteredChapters = useMemo(() => {
    if (courseFilter === "all") return chapterRows;
    return chapterRows.filter((r: any) => r.courseId === courseFilter);
  }, [chapterRows, courseFilter]);

  if (assetsLoading || chapLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading pipeline data…</div>;
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* ─── Pipeline Flow ─── */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Pipeline Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1">
            <PipelineStage label="Total Assets" value={metrics.total} total={metrics.total} color="text-foreground" />
            <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <PipelineStage label="Approved" value={metrics.approved} total={metrics.total} color="text-emerald-400" />
            <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <PipelineStage label="MC Generated" value={metrics.mcGenerated} total={metrics.total} color="text-blue-400" />
            <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <PipelineStage label="Filmed" value={metrics.filmed} total={metrics.total} color="text-purple-400" />
            <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <PipelineStage label="Edited" value={metrics.edited} total={metrics.total} color="text-indigo-400" />
            <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <PipelineStage label="Deployed" value={metrics.deployed} total={metrics.total} color="text-emerald-500" />
          </div>
        </CardContent>
      </Card>

      {/* ─── Key Metrics ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Total Assets" value={metrics.total} icon={Layers} />
        <MetricCard label="Approved" value={metrics.approved} icon={CheckCircle2} accent="text-emerald-400" sub={`${Math.round((metrics.approved / Math.max(metrics.total, 1)) * 100)}% of total`} />
        <MetricCard label="Videos Filmed" value={metrics.filmed} icon={Video} accent="text-purple-400" />
        <MetricCard label="Deployed to LW" value={metrics.deployed} icon={Rocket} accent="text-emerald-500" sub={metrics.deployed > 0 ? `${Math.round((metrics.deployed / Math.max(metrics.total, 1)) * 100)}% complete` : "Not started"} />
      </div>

      {/* ─── Asset Composition ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> By Problem Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {Array.from(metrics.typeMap.entries()).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="bg-secondary rounded-lg px-4 py-3 text-center flex-1">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{count}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{type}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> By Source Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {Array.from(metrics.sourceMap.entries()).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const labels: Record<string, string> = { E: "Exercise", BE: "Brief Exercise", P: "Problem" };
                return (
                  <div key={type} className="bg-secondary rounded-lg px-4 py-3 text-center flex-1">
                    <p className="text-2xl font-bold text-foreground tabular-nums">{count}</p>
                    <p className="text-[10px] text-muted-foreground">{labels[type] || type}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Course Progress ─── */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Course Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {courseRows.map((co: any) => {
            const approvedPct = co.total > 0 ? Math.round((co.approved / co.total) * 100) : 0;
            return (
              <div key={co.id} className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-foreground">{co.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{co.approved}/{co.total} approved</span>
                </div>
                <Progress value={approvedPct} className="h-2" />
                <div className="flex gap-4 text-[10px] text-muted-foreground">
                  <span>MC: {co.mc}</span>
                  <span>Filmed: {co.filmed}</span>
                  <span>Deployed: {co.deployed}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ─── Chapter Progress Table ─── */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Chapter Progress</CardTitle>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-7 text-xs w-48"><SelectValue placeholder="All Courses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courseRows.map((co: any) => <SelectItem key={co.id} value={co.id}>{co.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-2">Course</th>
                <th className="text-left py-2 pr-2">Chapter</th>
                <th className="text-right py-2 px-2">Assets</th>
                <th className="text-right py-2 px-2">Approved</th>
                <th className="text-right py-2 px-2">MC</th>
                <th className="text-right py-2 px-2">Filmed</th>
                <th className="text-right py-2 px-2">Deployed</th>
                <th className="text-center py-2 px-2 w-24">Progress</th>
              </tr>
            </thead>
            <tbody>
              {filteredChapters.map((r: any) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/50">
                  <td className="py-1.5 pr-2 text-muted-foreground text-[11px]">{r.courseName}</td>
                  <td className="py-1.5 pr-2 text-foreground font-medium">Ch {r.chapterNum} — {r.chapterName}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.total}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.approved}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.mc}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.filmed}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.deployed}</td>
                  <td className="py-1.5 px-2">
                    <div className="flex items-center gap-1.5">
                      <Progress value={r.completionPct} className="h-1.5 flex-1" />
                      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{r.completionPct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredChapters.length === 0 && <p className="text-center text-muted-foreground py-4 text-xs">No chapter data yet.</p>}
        </CardContent>
      </Card>

      {/* ─── Flagged Assets ─── */}
      {flags && flags.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Flagged Assets ({flags.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2">Asset</th>
                  <th className="text-left py-2">Reason</th>
                  <th className="text-left py-2">Notes</th>
                  <th className="text-left py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((f: any) => (
                  <tr key={f.id} className="border-b border-border/50">
                    <td className="py-1.5 text-foreground font-mono text-[11px]">{f.teaching_asset_id?.slice(0, 8)}…</td>
                    <td className="py-1.5 text-muted-foreground">{f.flag_reason || "—"}</td>
                    <td className="py-1.5 text-muted-foreground">{f.notes || "—"}</td>
                    <td className="py-1.5 text-muted-foreground tabular-nums">{new Date(f.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
