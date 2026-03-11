import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount, VA_ROLE_LABELS } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ArrowRight, CheckCircle2,
  Upload, Sparkles, Eye, BookOpen,
  HelpCircle, MessageSquare, ExternalLink, Library,
} from "lucide-react";

const PIPELINE_STAGES = [
  { key: "import", label: "Import", route: "/problem-bank", icon: Upload },
  { key: "generate", label: "Generate", route: "/content", icon: Sparkles },
  { key: "review", label: "Review", route: "/review", icon: Eye },
  { key: "assets", label: "Teaching Assets", route: "/assets-library", icon: Library },
] as const;

export default function VaDashboard() {
  const navigate = useNavigate();
  const { vaAccount, isVa, primaryRole, assignedChapterIds, isLoading } = useVaAccount();
  const { impersonating } = useImpersonation();
  const { workspace, setWorkspace } = useActiveWorkspace();

  const activeVa = impersonating || vaAccount;
  const activeIsVa = !!impersonating || isVa;
  const activeRole = impersonating?.role
    ? (impersonating.role === "va_test" ? "content_creation_va" : impersonating.role)
    : primaryRole;

  // Fetch assignments for impersonated VA
  const { data: impersonatedAssignments } = useQuery({
    queryKey: ["va-assignments-impersonated", impersonating?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("va_assignments")
        .select("chapter_id")
        .eq("va_account_id", impersonating!.id);
      if (error) throw error;
      return data?.map(a => a.chapter_id) ?? [];
    },
    enabled: !!impersonating?.id,
  });

  const isAdmin = !activeIsVa && !impersonating;
  const { data: allChapters } = useQuery({
    queryKey: ["all-chapter-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("id");
      return data?.map(c => c.id) ?? [];
    },
    enabled: isAdmin,
  });

  const effectiveChapterIds = impersonating
    ? (impersonatedAssignments ?? [])
    : isAdmin
      ? (allChapters ?? [])
      : assignedChapterIds;

  const displayChapterIds = impersonating ? (impersonatedAssignments ?? []) : assignedChapterIds;

  const { data: chapterDetails } = useQuery({
    queryKey: ["assigned-chapter-details", displayChapterIds],
    queryFn: async () => {
      if (!displayChapterIds.length) return [];
      const { data } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .in("id", displayChapterIds);
      return data ?? [];
    },
    enabled: displayChapterIds.length > 0,
  });

  const { data: courseDetails } = useQuery({
    queryKey: ["courses-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, code, course_name");
      return data ?? [];
    },
  });

  // Per-chapter pipeline counts
  const { data: perChapterCounts } = useQuery({
    queryKey: ["va-per-chapter-counts", effectiveChapterIds],
    queryFn: async () => {
      if (!effectiveChapterIds.length) return {};
      const { data } = await supabase
        .from("chapter_problems")
        .select("chapter_id, pipeline_status")
        .in("chapter_id", effectiveChapterIds);
      const counts: Record<string, { total: number; imported: number; generated: number; in_review: number; approved: number }> = {};
      effectiveChapterIds.forEach(id => {
        counts[id] = { total: 0, imported: 0, generated: 0, in_review: 0, approved: 0 };
      });
      data?.forEach(p => {
        if (!counts[p.chapter_id]) counts[p.chapter_id] = { total: 0, imported: 0, generated: 0, in_review: 0, approved: 0 };
        counts[p.chapter_id].total++;
        const status = p.pipeline_status as string;
        if (status === "imported") counts[p.chapter_id].imported++;
        else if (status === "generated") counts[p.chapter_id].generated++;
        else if (status === "in_review") counts[p.chapter_id].in_review++;
        else if (status === "approved") counts[p.chapter_id].approved++;
      });
      return counts;
    },
    enabled: effectiveChapterIds.length > 0,
  });

  // Teaching assets count per chapter
  const { data: assetCounts } = useQuery({
    queryKey: ["va-asset-counts", effectiveChapterIds],
    queryFn: async () => {
      if (!effectiveChapterIds.length) return {};
      const { data } = await supabase
        .from("teaching_assets")
        .select("chapter_id")
        .in("chapter_id", effectiveChapterIds);
      const counts: Record<string, number> = {};
      data?.forEach(a => {
        counts[a.chapter_id] = (counts[a.chapter_id] || 0) + 1;
      });
      return counts;
    },
    enabled: effectiveChapterIds.length > 0,
  });

  const getCourse = (id: string) => courseDetails?.find(c => c.id === id);

  const activeChapterId = workspace?.chapterId || (chapterDetails?.[0]?.id);
  const activeChapter = chapterDetails?.find(c => c.id === activeChapterId);
  const activeCourse = activeChapter ? getCourse(activeChapter.course_id) : null;

  // Build stage cards with sequential done logic
  const stageCounts = useMemo(() => {
    if (!activeChapterId || !perChapterCounts) return null;
    const ch = perChapterCounts[activeChapterId];
    if (!ch) return null;

    // Import is "done" when ≥80% of items have progressed past "imported"
    const importReadyPct = ch.total > 0 ? Math.round(((ch.total - ch.imported) / ch.total) * 100) : 0;
    const importDone = ch.total > 0 && importReadyPct >= 80;

    const generateRawDone = ch.generated === 0;
    const reviewRawDone = ch.in_review === 0;
    const assetsRawRemaining = ch.total > 0 ? Math.max(0, ch.total - ch.approved) : 0;
    const assetsRawDone = assetsRawRemaining === 0;

    // Sequential: each stage needs previous to be Done
    const generateDone = importDone && generateRawDone;
    const reviewDone = generateDone && reviewRawDone;
    const assetsDone = reviewDone && assetsRawDone;

    return [
      { ...PIPELINE_STAGES[0], remaining: ch.imported, isDone: importDone, pctLabel: `${importReadyPct}% ready` },
      { ...PIPELINE_STAGES[1], remaining: ch.generated, isDone: generateDone, pctLabel: null as string | null },
      { ...PIPELINE_STAGES[2], remaining: ch.in_review, isDone: reviewDone, pctLabel: null as string | null },
      { ...PIPELINE_STAGES[3], remaining: assetsRawRemaining, isDone: assetsDone, pctLabel: null as string | null },
    ];
  }, [activeChapterId, perChapterCounts, assetCounts]);

  // First incomplete stage
  const activeStageKey = stageCounts?.find(s => !s.isDone && s.remaining > 0)?.key;

  const handleSelectChapter = (ch: NonNullable<typeof chapterDetails>[number]) => {
    const co = getCourse(ch.course_id);
    setWorkspace({
      courseId: ch.course_id,
      courseName: co?.course_name || co?.code || "",
      chapterId: ch.id,
      chapterName: ch.chapter_name,
      chapterNumber: ch.chapter_number,
    });
  };

  if (isLoading) {
    return (
      <SurviveSidebarLayout>
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      </SurviveSidebarLayout>
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6 pb-8">
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-foreground">
            {activeVa ? activeVa.full_name : "VA Dashboard"}
          </h1>
          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">
            {VA_ROLE_LABELS[activeRole] || activeRole}
          </Badge>
        </div>

        <Tabs defaultValue="pipeline" className="w-full">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="pipeline" className="text-xs">Pipeline</TabsTrigger>
            <TabsTrigger value="help" className="text-xs">Help / SOP</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="space-y-6 mt-3">
            {/* ═══ ACTIVE CHAPTER ═══ */}
            {activeChapter && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">Active Chapter</span>
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {activeCourse?.code} — Ch {activeChapter.chapter_number}: {activeChapter.chapter_name}
                </h2>
              </div>
            )}

            {/* ═══ PIPELINE STAGE CARDS ═══ */}
            {stageCounts && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stageCounts.map(stage => {
                  const Icon = stage.icon;
                  const isDone = stage.isDone;
                  const isActive = stage.key === activeStageKey;
                  return (
                    <Card
                      key={stage.key}
                      className={`transition-all cursor-pointer group ${
                        isActive
                          ? "border-2 border-primary shadow-sm shadow-primary/10 bg-primary/5"
                          : isDone
                            ? "border-border/50 bg-card/60"
                            : "border-border hover:border-primary/30"
                      }`}
                      onClick={() => navigate(stage.route)}
                    >
                      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          isDone
                            ? "bg-green-500/10"
                            : isActive
                              ? "bg-primary/15"
                              : "bg-muted"
                        }`}>
                          {isDone ? (
                            <CheckCircle2 className="h-5 w-5 text-green-400" />
                          ) : (
                            <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                          )}
                        </div>
                        <p className={`text-sm font-semibold ${isDone ? "text-muted-foreground" : "text-foreground"}`}>
                          {stage.label}
                        </p>
                        {isDone ? (
                          <span className="text-xs text-green-400 font-medium">Done ✓</span>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-foreground tabular-nums">{stage.remaining}</p>
                            {stage.pctLabel && (
                              <p className="text-[10px] text-muted-foreground">{stage.pctLabel}</p>
                            )}
                            <Button size="sm" variant={isActive ? "default" : "outline"} className="text-[11px] h-7 gap-1 w-full">
                              Go <ArrowRight className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {!activeChapter && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No chapters assigned yet. Contact your team lead to get started.
              </div>
            )}

            {/* ═══ ASSIGNED CHAPTERS ═══ */}
            {chapterDetails && chapterDetails.length > 1 && (
              <div className="space-y-3">
                <div className="border-t border-border pt-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Your Chapters</h3>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {chapterDetails
                    .sort((a, b) => a.chapter_number - b.chapter_number)
                    .map(ch => {
                      const co = getCourse(ch.course_id);
                      const isActiveChapter = ch.id === activeChapterId;
                      const counts = perChapterCounts?.[ch.id];
                      const pct = counts && counts.total > 0 ? Math.round((counts.approved / counts.total) * 100) : 0;
                      return (
                        <Card
                          key={ch.id}
                          className={`cursor-pointer transition-all ${
                            isActiveChapter
                              ? "border-2 border-primary/60 bg-primary/5 shadow-sm shadow-primary/10"
                              : "border-border hover:border-primary/30"
                          }`}
                          onClick={() => handleSelectChapter(ch)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className={`text-sm font-semibold ${isActiveChapter ? "text-foreground" : "text-foreground/80"}`}>
                                  Ch {ch.chapter_number}: {ch.chapter_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{co?.code} — {co?.course_name}</p>
                              </div>
                              {isActiveChapter && (
                                <Badge className="text-[8px] bg-primary/15 text-primary border-0">Active</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                            </div>
                            {counts && (
                              <p className="text-[9px] text-muted-foreground mt-1">
                                {counts.approved} of {counts.total} approved
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══ HELP / SOP ═══ */}
          <TabsContent value="help" className="space-y-4 mt-3">
            <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" /> Your Workflow
              </h3>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li><span className="text-foreground font-medium">Import</span> — Add source problems from textbook & solutions screenshots</li>
                <li><span className="text-foreground font-medium">Generate</span> — AI creates variant problems + solutions</li>
                <li><span className="text-foreground font-medium">Review</span> — Check variant quality, fix issues</li>
                <li><span className="text-foreground font-medium">Approve</span> — Mark asset as ready for production (sheets are auto-created)</li>
              </ol>
              <p className="text-[10px] text-muted-foreground italic">
                Your role ends at Approve. Sheet prep and publishing are handled by other team members.
              </p>
            </div>
            <a
              href="https://app.slack.com/client/T0AKPHWTXLM/C0AKU2X25FU"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 p-4 hover:bg-secondary/40 transition-colors"
            >
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Go to Slack</p>
                <p className="text-[10px] text-muted-foreground">Ask questions, report issues, share updates</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
            </a>
          </TabsContent>
        </Tabs>
      </div>
    </SurviveSidebarLayout>
  );
}