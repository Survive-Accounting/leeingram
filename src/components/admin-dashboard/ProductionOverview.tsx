import { useMemo } from "react";
import { useTeachingAssets, useChaptersWithCourses, useAssetFlags } from "@/hooks/useAdminDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Video, Upload, Rocket, AlertTriangle, FileText, Sheet } from "lucide-react";

function MetricCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon?: any; accent?: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 flex items-center gap-3">
        {Icon && <Icon className={`h-5 w-5 ${accent || "text-primary"}`} />}
        <div>
          <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TierBadge({ count }: { count: number }) {
  if (count >= 15) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[9px]">Gold</Badge>;
  if (count >= 10) return <Badge className="bg-gray-400/20 text-gray-300 border-gray-400/30 text-[9px]">Silver</Badge>;
  if (count >= 5) return <Badge className="bg-amber-700/20 text-amber-500 border-amber-700/30 text-[9px]">Bronze</Badge>;
  return <Badge variant="outline" className="text-[9px] text-muted-foreground">—</Badge>;
}

export function ProductionOverview() {
  const { data: assets, isLoading: assetsLoading } = useTeachingAssets();
  const { data: chapCourses, isLoading: chapLoading } = useChaptersWithCourses();
  const { data: flags } = useAssetFlags();

  const metrics = useMemo(() => {
    if (!assets) return null;
    const total = assets.length;
    const approved = assets.filter(a => a.asset_approved_at).length;
    const mcGenerated = assets.filter(a => a.banked_generation_status === "completed").length;
    const filmed = assets.filter(a => ["recorded", "editing", "edited", "ready"].includes(a.video_production_status)).length;
    const edited = assets.filter(a => ["edited", "ready"].includes(a.video_production_status)).length;
    const uploaded = assets.filter(a => a.video_production_status === "ready").length;
    const deployed = assets.filter(a => a.deployment_status === "completed").length;
    const fullyCompleted = assets.filter(a =>
      a.banked_generation_status === "completed" &&
      a.video_production_status === "ready" &&
      a.deployment_status === "completed"
    ).length;

    // Video pipeline
    const needVideos = assets.filter(a => a.banked_generation_status === "completed" && a.video_production_status === "not_started").length;
    const filmedNotEdited = assets.filter(a => a.video_production_status === "recorded").length;
    const editedNotUploaded = assets.filter(a => a.video_production_status === "edited").length;
    const uploadedNotDeployed = assets.filter(a => a.video_production_status === "ready" && a.deployment_status !== "completed").length;

    // Asset types
    const typeMap = new Map<string, number>();
    for (const a of assets) {
      const t = a.problem_type || "Unknown";
      typeMap.set(t, (typeMap.get(t) || 0) + 1);
    }

    return {
      total, approved, mcGenerated, filmed, edited, uploaded, deployed, fullyCompleted,
      needVideos, filmedNotEdited, editedNotUploaded, uploadedNotDeployed,
      typeMap,
    };
  }, [assets]);

  const chapterRows = useMemo(() => {
    if (!assets || !chapCourses) return [];
    const { chapters, courses } = chapCourses;
    const courseMap = new Map(courses.map(c => [c.id, c]));

    return chapters.map(ch => {
      const chAssets = assets.filter(a => a.chapter_id === ch.id);
      const approved = chAssets.filter(a => a.asset_approved_at).length;
      const mc = chAssets.filter(a => a.banked_generation_status === "completed").length;
      const filmed = chAssets.filter(a => ["recorded", "editing", "edited", "ready"].includes(a.video_production_status)).length;
      const deployed = chAssets.filter(a => a.deployment_status === "completed").length;
      const fullyCompleted = chAssets.filter(a =>
        a.banked_generation_status === "completed" &&
        a.video_production_status === "ready" &&
        a.deployment_status === "completed"
      ).length;
      const course = courseMap.get(ch.course_id);
      return {
        id: ch.id,
        courseName: course?.course_name || "—",
        chapterNum: ch.chapter_number,
        chapterName: ch.chapter_name,
        total: chAssets.length,
        approved, mc, filmed, deployed, fullyCompleted,
      };
    }).filter(r => r.total > 0);
  }, [assets, chapCourses]);

  const courseRows = useMemo(() => {
    if (!assets || !chapCourses) return [];
    const { courses } = chapCourses;
    return courses.map(co => {
      const coAssets = assets.filter(a => a.course_id === co.id);
      const total = coAssets.length;
      const approved = coAssets.filter(a => a.asset_approved_at).length;
      const mc = coAssets.filter(a => a.banked_generation_status === "completed").length;
      const filmed = coAssets.filter(a => ["recorded", "editing", "edited", "ready"].includes(a.video_production_status)).length;
      const deployed = coAssets.filter(a => a.deployment_status === "completed").length;
      return { id: co.id, name: co.course_name, total, approved, mc, filmed, deployed };
    }).filter(r => r.total > 0);
  }, [assets, chapCourses]);

  // Chapter-level metrics
  const chapterMetrics = useMemo(() => {
    if (!chapterRows.length) return { inProgress: 0, withVideo: 0, with10Plus: 0 };
    return {
      inProgress: chapterRows.filter(r => r.total > 0).length,
      withVideo: chapterRows.filter(r => r.filmed > 0).length,
      with10Plus: chapterRows.filter(r => r.total >= 10).length,
    };
  }, [chapterRows]);

  if (assetsLoading || chapLoading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading dashboard…</div>;
  }

  if (!metrics) return null;

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <MetricCard label="Fully Completed" value={metrics.fullyCompleted} icon={Rocket} accent="text-emerald-400" />
        <MetricCard label="Total Assets" value={metrics.total} icon={FileText} />
        <MetricCard label="Approved" value={metrics.approved} icon={CheckCircle2} accent="text-emerald-400" />
        <MetricCard label="MC Generated" value={metrics.mcGenerated} icon={FileText} accent="text-blue-400" />
        <MetricCard label="Videos Filmed" value={metrics.filmed} icon={Video} accent="text-purple-400" />
        <MetricCard label="Videos Edited" value={metrics.edited} icon={Video} accent="text-indigo-400" />
        <MetricCard label="Uploaded to Drive" value={metrics.uploaded} icon={Upload} accent="text-sky-400" />
        <MetricCard label="Deployed to LW" value={metrics.deployed} icon={Rocket} accent="text-emerald-400" />
        <MetricCard label="Chapters In Progress" value={chapterMetrics.inProgress} />
        <MetricCard label="Chapters w/ Video" value={chapterMetrics.withVideo} />
      </div>

      {/* Video Pipeline */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Video Pipeline Backlog</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-xs">
            <div><p className="text-xl font-bold text-foreground tabular-nums">{metrics.needVideos}</p><p className="text-muted-foreground">Need Videos</p></div>
            <div><p className="text-xl font-bold text-foreground tabular-nums">{metrics.filmedNotEdited}</p><p className="text-muted-foreground">Filmed, Not Edited</p></div>
            <div><p className="text-xl font-bold text-foreground tabular-nums">{metrics.editedNotUploaded}</p><p className="text-muted-foreground">Edited, Not Uploaded</p></div>
            <div><p className="text-xl font-bold text-foreground tabular-nums">{metrics.uploadedNotDeployed}</p><p className="text-muted-foreground">Uploaded, Not Deployed</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Asset Type Analytics */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Assets by Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Array.from(metrics.typeMap.entries()).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="bg-secondary rounded-lg px-3 py-2 text-center min-w-[100px]">
                <p className="text-lg font-bold text-foreground tabular-nums">{count}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{type.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chapter Progress */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Chapter Progress</CardTitle>
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
                <th className="text-center py-2 pl-2">Tier</th>
              </tr>
            </thead>
            <tbody>
              {chapterRows.map(r => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/50">
                  <td className="py-1.5 pr-2 text-muted-foreground">{r.courseName}</td>
                  <td className="py-1.5 pr-2 text-foreground font-medium">Ch {r.chapterNum} — {r.chapterName}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.total}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.approved}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.mc}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.filmed}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums">{r.deployed}</td>
                  <td className="py-1.5 pl-2 text-center"><TierBadge count={r.fullyCompleted} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {chapterRows.length === 0 && <p className="text-center text-muted-foreground py-4 text-xs">No chapter data yet.</p>}
        </CardContent>
      </Card>

      {/* Course Progress */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Course Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {courseRows.map(co => {
            const pct = co.total > 0 ? Math.round((co.deployed / co.total) * 100) : 0;
            return (
              <div key={co.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground font-medium">{co.name}</span>
                  <span className="text-muted-foreground tabular-nums">{co.deployed}/{co.total} deployed ({pct}%)</span>
                </div>
                <Progress value={pct} className="h-2" />
                <div className="flex gap-4 text-[10px] text-muted-foreground">
                  <span>Approved: {co.approved}</span>
                  <span>MC: {co.mc}</span>
                  <span>Filmed: {co.filmed}</span>
                </div>
              </div>
            );
          })}
          {courseRows.length === 0 && <p className="text-center text-muted-foreground py-4 text-xs">No course data yet.</p>}
        </CardContent>
      </Card>

      {/* Flagged Assets */}
      {flags && flags.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2">Asset</th>
                  <th className="text-left py-2">Reason</th>
                  <th className="text-left py-2">Notes</th>
                  <th className="text-left py-2">Flagged</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((f: any) => (
                  <tr key={f.id} className="border-b border-border/50">
                    <td className="py-1.5 text-foreground">{f.teaching_asset_id?.slice(0, 8)}…</td>
                    <td className="py-1.5 text-muted-foreground">{f.flag_reason || "—"}</td>
                    <td className="py-1.5 text-muted-foreground">{f.notes || "—"}</td>
                    <td className="py-1.5 text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</td>
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
