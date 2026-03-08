import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Inbox, Factory, Library, FileCheck, Package, Video, Rocket,
  ArrowRight, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";

type StageData = {
  key: string;
  label: string;
  icon: typeof Inbox;
  phase: 1 | 2;
  section: string;
  path: string;
  metrics: { label: string; value: number; variant?: "default" | "warning" | "success" }[];
};

export default function PipelineOverview() {
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const chId = workspace?.chapterId;

  // ── Fetch pipeline data ──────────────────────────────────────────
  const { data: problems } = useQuery({
    queryKey: ["pipeline-overview-problems", chId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("id, pipeline_status, status, import_status")
        .eq("chapter_id", chId!);
      if (error) throw error;
      return data;
    },
    enabled: !!chId,
  });

  const { data: assets } = useQuery({
    queryKey: ["pipeline-overview-assets", chId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, banked_generation_status, video_production_status, deployment_status")
        .eq("chapter_id", chId!);
      if (error) throw error;
      return data;
    },
    enabled: !!chId,
  });

  const { data: bankedQuestions } = useQuery({
    queryKey: ["pipeline-overview-banked"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banked_questions")
        .select("id, review_status");
      if (error) throw error;
      return data;
    },
  });

  // ── Compute counts ───────────────────────────────────────────────
  const imported = problems?.filter(p => p.pipeline_status === "imported").length ?? 0;
  const awaitingGeneration = problems?.filter(p => p.pipeline_status === "imported" && p.status !== "generating").length ?? 0;
  const generated = problems?.filter(p => p.pipeline_status === "generated").length ?? 0;
  const totalProblems = problems?.length ?? 0;

  const approvedAssets = assets?.length ?? 0;
  const readyForBanking = assets?.filter(a => a.banked_generation_status === "not_started").length ?? 0;
  const bankingComplete = assets?.filter(a => a.banked_generation_status === "complete").length ?? 0;

  const totalBanked = bankedQuestions?.length ?? 0;
  const pendingReview = bankedQuestions?.filter(q => q.review_status === "pending").length ?? 0;
  const approvedQuestions = bankedQuestions?.filter(q => q.review_status === "approved").length ?? 0;
  const rejectedQuestions = bankedQuestions?.filter(q => q.review_status === "rejected").length ?? 0;

  const videoPending = assets?.filter(a => a.video_production_status === "not_started").length ?? 0;
  const deployed = assets?.filter(a => a.deployment_status === "complete").length ?? 0;

  const stages: StageData[] = [
    {
      key: "intake", label: "Intake", icon: Inbox, phase: 1, section: "INTAKE", path: "/problem-bank",
      metrics: [
        { label: "Screenshots imported", value: totalProblems },
        { label: "Awaiting generation", value: awaitingGeneration, variant: awaitingGeneration > 0 ? "warning" : "default" },
      ],
    },
    {
      key: "production", label: "Asset Production", icon: Factory, phase: 1, section: "PRODUCTION", path: "/content",
      metrics: [
        { label: "Variants generated", value: generated },
        { label: "Assets approved", value: approvedAssets, variant: "success" },
        { label: "Ready for banking", value: readyForBanking, variant: readyForBanking > 0 ? "warning" : "default" },
      ],
    },
    {
      key: "banked", label: "Banked", icon: FileCheck, phase: 1, section: "BANKED", path: "/question-review",
      metrics: [
        { label: "Total MC questions", value: totalBanked },
        { label: "Pending review", value: pendingReview, variant: pendingReview > 0 ? "warning" : "default" },
        { label: "Approved", value: approvedQuestions, variant: "success" },
        { label: "Rejected (flagged)", value: rejectedQuestions },
      ],
    },
    {
      key: "export", label: "Export / LearnWorlds", icon: Package, phase: 2, section: "EXPORT", path: "/export-sets",
      metrics: [
        { label: "Export sets", value: 0 },
        { label: "Coming soon", value: 0 },
      ],
    },
    {
      key: "video", label: "Video Queue", icon: Video, phase: 2, section: "VIDEO", path: "/filming",
      metrics: [
        { label: "Videos pending", value: videoPending },
        { label: "Deployed", value: deployed, variant: "success" },
      ],
    },
    {
      key: "deploy", label: "Deployment", icon: Rocket, phase: 2, section: "DEPLOY", path: "/deployment",
      metrics: [
        { label: "Chapters deployed", value: deployed, variant: "success" },
      ],
    },
  ];

  const variantForMetric = (v?: "default" | "warning" | "success") => {
    if (v === "warning") return "text-amber-400";
    if (v === "success") return "text-emerald-400";
    return "text-foreground";
  };

  if (!chId) {
    return (
      <SurviveSidebarLayout>
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold text-foreground mb-2">Pipeline Overview</h2>
          <p className="text-muted-foreground text-sm">Select a course and chapter to view the production pipeline.</p>
        </div>
      </SurviveSidebarLayout>
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-white">Production Pipeline</h1>
          <p className="text-sm text-white/60 mt-0.5">
            {workspace?.courseName} · Ch {workspace?.chapterNumber} — {workspace?.chapterName}
          </p>
        </div>

        {/* Phase 1 */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-3">Phase 1 · VA Production</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {stages.filter(s => s.phase === 1).map((stage) => {
              const Icon = stage.icon;
              return (
                <button
                  key={stage.key}
                  onClick={() => navigate(stage.path)}
                  className="text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-4 group"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-white">{stage.label}</span>
                    <ArrowRight className="h-3 w-3 text-white/40 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="space-y-1.5">
                    {stage.metrics.map((m) => (
                      <div key={m.label} className="flex items-center justify-between">
                        <span className="text-xs text-white/50">{m.label}</span>
                        <span className={cn("text-sm font-bold tabular-nums", variantForMetric(m.variant))}>
                          {m.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Phase 2 */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-3">Phase 2 · Instructor</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {stages.filter(s => s.phase === 2).map((stage) => {
              const Icon = stage.icon;
              return (
                <button
                  key={stage.key}
                  onClick={() => navigate(stage.path)}
                  className="text-left rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-colors p-4 group"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-4 w-4 text-white/40" />
                    <span className="text-sm font-semibold text-white/60">{stage.label}</span>
                    <ArrowRight className="h-3 w-3 text-white/30 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="space-y-1.5">
                    {stage.metrics.map((m) => (
                      <div key={m.label} className="flex items-center justify-between">
                        <span className="text-xs text-white/40">{m.label}</span>
                        <span className={cn("text-sm font-bold tabular-nums", variantForMetric(m.variant))}>
                          {m.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Next actions summary */}
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" /> Next Actions
          </h3>
          <div className="space-y-2 text-sm">
            {awaitingGeneration > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-white/70">
                  <strong className="text-white">{awaitingGeneration}</strong> problems awaiting variant generation
                </span>
                <button onClick={() => navigate("/content")} className="text-primary text-xs hover:underline ml-auto shrink-0">Go →</button>
              </div>
            )}
            {generated > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-white/70">
                  <strong className="text-white">{generated}</strong> variants awaiting speed review
                </span>
                <button onClick={() => navigate("/content")} className="text-primary text-xs hover:underline ml-auto shrink-0">Go →</button>
              </div>
            )}
            {readyForBanking > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-white/70">
                  <strong className="text-white">{readyForBanking}</strong> approved assets ready for MC banking
                </span>
                <button onClick={() => navigate("/assets-library")} className="text-primary text-xs hover:underline ml-auto shrink-0">Go →</button>
              </div>
            )}
            {pendingReview > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-white/70">
                  <strong className="text-white">{pendingReview}</strong> banked questions pending instructor review
                </span>
                <button onClick={() => navigate("/question-review")} className="text-primary text-xs hover:underline ml-auto shrink-0">Go →</button>
              </div>
            )}
            {awaitingGeneration === 0 && generated === 0 && readyForBanking === 0 && pendingReview === 0 && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-white/70">All clear — no pending actions for this chapter</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </SurviveSidebarLayout>
  );
}
