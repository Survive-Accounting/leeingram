import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Library, FileSpreadsheet, Video, CheckCircle2, Package, Rocket } from "lucide-react";

interface Props {
  chapterIds: string[];
}

export function LeadVaDashboard({ chapterIds }: Props) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["lead-va-metrics", chapterIds],
    queryFn: async () => {
      if (!chapterIds.length) return null;

      const [assets, problems, sheets, banked] = await Promise.all([
        supabase.from("teaching_assets").select("id, google_sheet_status, video_production_status, deployment_status", { count: "exact" }).in("chapter_id", chapterIds),
        supabase.from("chapter_problems").select("id, pipeline_status").in("chapter_id", chapterIds),
        supabase.from("teaching_assets").select("id", { count: "exact", head: true }).in("chapter_id", chapterIds).not("sheet_master_url", "is", null),
        supabase.from("teaching_assets").select("id", { count: "exact", head: true }).in("chapter_id", chapterIds).eq("banked_generation_status", "completed"),
      ]);

      const assetData = assets.data ?? [];
      return {
        totalAssets: assetData.length,
        sheetsGenerated: sheets.count ?? 0,
        sheetsVerified: assetData.filter(a => a.google_sheet_status === "verified_by_va").length,
        videosPending: assetData.filter(a => a.video_production_status === "not_started").length,
        deployed: assetData.filter(a => a.deployment_status === "completed").length,
        mcGenerated: banked.count ?? 0,
        sourceProblems: problems.data?.length ?? 0,
        imported: problems.data?.filter(p => p.pipeline_status === "imported").length ?? 0,
        generated: problems.data?.filter(p => p.pipeline_status === "generated").length ?? 0,
      };
    },
    enabled: chapterIds.length > 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading dashboard…
      </div>
    );
  }

  const cards = [
    { label: "Total Assets", value: metrics?.totalAssets ?? 0, icon: Library, color: "text-foreground" },
    { label: "Sheets Generated", value: metrics?.sheetsGenerated ?? 0, icon: FileSpreadsheet, color: "text-blue-400" },
    { label: "Sheets Verified", value: metrics?.sheetsVerified ?? 0, icon: CheckCircle2, color: "text-emerald-400" },
    { label: "MC Generated", value: metrics?.mcGenerated ?? 0, icon: Package, color: "text-purple-400" },
    { label: "Videos Pending", value: metrics?.videosPending ?? 0, icon: Video, color: "text-amber-400" },
    { label: "Deployed", value: metrics?.deployed ?? 0, icon: Rocket, color: "text-primary" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Lead VA Dashboard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Full pipeline overview across your assigned chapters
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.label}</span>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${c.color}`}>{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Pipeline funnel */}
      <div className="rounded-lg border border-border bg-secondary/20 p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Source Problem Pipeline</p>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground tabular-nums">{metrics?.sourceProblems ?? 0}</p>
            <p className="text-[9px] text-muted-foreground">Total</p>
          </div>
          <span className="text-muted-foreground/30">→</span>
          <div className="text-center">
            <p className="text-lg font-bold text-blue-400 tabular-nums">{metrics?.imported ?? 0}</p>
            <p className="text-[9px] text-muted-foreground">Imported</p>
          </div>
          <span className="text-muted-foreground/30">→</span>
          <div className="text-center">
            <p className="text-lg font-bold text-amber-400 tabular-nums">{metrics?.generated ?? 0}</p>
            <p className="text-[9px] text-muted-foreground">Generated</p>
          </div>
          <span className="text-muted-foreground/30">→</span>
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{metrics?.totalAssets ?? 0}</p>
            <p className="text-[9px] text-muted-foreground">Assets</p>
          </div>
        </div>
      </div>
    </div>
  );
}
