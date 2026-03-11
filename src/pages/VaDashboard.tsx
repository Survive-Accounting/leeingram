import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount, VA_ROLE_LABELS } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, ArrowRight, CheckCircle2, ChevronDown, ChevronRight,
  Upload, Sparkles, Eye, ThumbsUp, FileSpreadsheet, HelpCircle,
  MessageSquare, ExternalLink, BookOpen,
} from "lucide-react";

// Pipeline stages with routes and icons
const PIPELINE_STAGES = [
  { key: "imported", label: "Import", route: "/problem-bank", icon: Upload, description: "Paste textbook problem screenshots" },
  { key: "generated", label: "Generate", route: "/content", icon: Sparkles, description: "Generate variant problems" },
  { key: "in_review", label: "Review", route: "/review", icon: Eye, description: "Review generated variants" },
  { key: "approved", label: "Approve", route: "/review", icon: ThumbsUp, description: "Approve teaching assets" },
  { key: "sheets_created", label: "Sheets", route: "/assets-library", icon: FileSpreadsheet, description: "Google Sheets created" },
] as const;

const JOB_DESC_LINKS: Record<string, string> = {
  content_creation_va: "https://docs.google.com/document/d/1NFVw0i96s3USCwbbN0Xqr60P4RrbTQoV7p7kH52A0FY/edit?usp=sharing",
  sheet_prep_va: "https://docs.google.com/document/d/1Y_zjOWtl0u28vA9kKZIYsEfSA98YJjXHIgiqIi1RMUI/edit?usp=sharing",
  lead_va: "https://docs.google.com/document/d/16NnmFOqK0L2ig2fun2Z27SrU8g162kNoiu8WLb3TDUk/edit?usp=sharing",
};

export default function VaDashboard() {
  const navigate = useNavigate();
  const { vaAccount, isVa, primaryRole, assignedChapterIds, isLoading } = useVaAccount();
  const { impersonating } = useImpersonation();
  const { workspace, setWorkspace } = useActiveWorkspace();
  const [showCompleted, setShowCompleted] = useState(false);
  const [showFullQueue, setShowFullQueue] = useState(false);

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

  // Fetch pipeline counts for effective chapters
  const { data: pipelineCounts } = useQuery({
    queryKey: ["va-pipeline-counts", effectiveChapterIds],
    queryFn: async () => {
      if (!effectiveChapterIds.length) return { imported: 0, generated: 0, in_review: 0, approved: 0, sheets_created: 0 };
      const [importedR, generatedR, approvedR] = await Promise.all([
        supabase.from("chapter_problems").select("id", { count: "exact", head: true }).in("chapter_id", effectiveChapterIds).eq("pipeline_status", "imported"),
        supabase.from("chapter_problems").select("id", { count: "exact", head: true }).in("chapter_id", effectiveChapterIds).eq("pipeline_status", "generated"),
        supabase.from("chapter_problems").select("id", { count: "exact", head: true }).in("chapter_id", effectiveChapterIds).eq("pipeline_status", "approved"),
      ]);
      const [sheetsR] = await Promise.all([
        supabase.from("teaching_assets").select("id", { count: "exact", head: true }).in("chapter_id", effectiveChapterIds).neq("google_sheet_status", "none").neq("google_sheet_status", "archived"),
      ]);
      return {
        imported: importedR.count ?? 0,
        generated: generatedR.count ?? 0,
        in_review: 0, // in_review tracked via generated needing review
        approved: approvedR.count ?? 0,
        sheets_created: sheetsR.count ?? 0,
      };
    },
    enabled: effectiveChapterIds.length > 0,
  });

  // Per-chapter pipeline counts for chapter cards
  const { data: perChapterCounts } = useQuery({
    queryKey: ["va-per-chapter-counts", effectiveChapterIds],
    queryFn: async () => {
      if (!effectiveChapterIds.length) return {};
      const { data } = await supabase
        .from("chapter_problems")
        .select("chapter_id, pipeline_status")
        .in("chapter_id", effectiveChapterIds);
      const counts: Record<string, { total: number; completed: number }> = {};
      effectiveChapterIds.forEach(id => { counts[id] = { total: 0, completed: 0 }; });
      data?.forEach(p => {
        if (!counts[p.chapter_id]) counts[p.chapter_id] = { total: 0, completed: 0 };
        counts[p.chapter_id].total++;
        if (p.pipeline_status === "approved") counts[p.chapter_id].completed++;
      });
      return counts;
    },
    enabled: effectiveChapterIds.length > 0,
  });

  const getCourse = (id: string) => courseDetails?.find(c => c.id === id);

  // Determine active chapter from workspace or first assigned
  const activeChapterId = workspace?.chapterId || (chapterDetails?.[0]?.id);
  const activeChapter = chapterDetails?.find(c => c.id === activeChapterId);
  const activeCourse = activeChapter ? getCourse(activeChapter.course_id) : null;

  // Build stage cards
  const stageCards = useMemo(() => {
    if (!pipelineCounts) return { todo: [] as Array<(typeof PIPELINE_STAGES)[number] & { count: number }>, completed: [] as Array<(typeof PIPELINE_STAGES)[number] & { count: number }> };
    const todo: Array<(typeof PIPELINE_STAGES)[number] & { count: number }> = [];
    const completed: Array<(typeof PIPELINE_STAGES)[number] & { count: number }> = [];

    PIPELINE_STAGES.forEach(stage => {
      const count = pipelineCounts[stage.key as keyof typeof pipelineCounts] ?? 0;
      if (count > 0) {
        todo.push({ ...stage, count });
      } else {
        completed.push({ ...stage, count: 0 });
      }
    });

    return { todo, completed };
  }, [pipelineCounts]);

  // Active task = first To Do stage
  const activeStage = stageCards.todo[0] || null;

  const handleNavigateToStage = (route: string) => {
    navigate(route);
  };

  const handleSelectChapter = (ch: NonNullable<typeof chapterDetails>[number]) => {
    const co = getCourse(ch.course_id);
    setWorkspace({
      courseId: ch.course_id,
      courseName: co?.course_name || co?.code || "",
      chapterId: ch.id,
      chapterName: ch.chapter_name,
      chapterNumber: ch.chapter_number,
    });
    // Navigate to the first incomplete stage if possible
    if (activeStage) {
      navigate(activeStage.route);
    }
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
      <div className="space-y-5 pb-8">
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-foreground">
            {activeVa ? activeVa.full_name : "VA Dashboard"}
          </h1>
          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">
            {VA_ROLE_LABELS[activeRole] || activeRole}
          </Badge>
        </div>

        {/* ═══ ACTIVE TASK BANNER ═══ */}
        {activeChapter && (
          <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-widest">Active Chapter</span>
            </div>
            <h2 className="text-xl font-bold text-foreground mb-0.5">
              {activeCourse?.code} — Ch {activeChapter.chapter_number}: {activeChapter.chapter_name}
            </h2>

            {activeStage ? (
              <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = activeStage.icon;
                    return <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>;
                  })()}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Your Current Task</p>
                    <p className="text-base font-semibold text-foreground">
                      {activeStage.label}
                      <span className="ml-2 text-muted-foreground font-normal">
                        — {activeStage.count} {activeStage.count === 1 ? "item" : "items"} remaining
                      </span>
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleNavigateToStage(activeStage.route)}
                  className="gap-2"
                >
                  Go to {activeStage.label}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">All stages complete for this chapter!</span>
              </div>
            )}
          </div>
        )}

        {/* ═══ TABS: To Do / Help ═══ */}
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
            <TabsTrigger value="help" className="text-xs">Help / SOP</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-5 mt-3">
            {/* ─── TO DO ─── */}
            {stageCards.todo.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">To Do</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {stageCards.todo.map(stage => {
                    const Icon = stage.icon;
                    return (
                      <Card
                        key={stage.key}
                        className="border-border hover:border-primary/40 transition-colors cursor-pointer group"
                        onClick={() => handleNavigateToStage(stage.route)}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                            <Icon className="h-4.5 w-4.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{stage.label}</p>
                            <p className="text-xs text-muted-foreground">{stage.description}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold text-foreground tabular-nums">{stage.count}</p>
                            <p className="text-[9px] text-muted-foreground">remaining</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── COMPLETED ─── */}
            {stageCards.completed.length > 0 && (
              <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                    {showCompleted ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    <span className="font-medium">Show Completed ({stageCards.completed.length})</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {stageCards.completed.map(stage => {
                      const Icon = stage.icon;
                      return (
                        <Card key={stage.key} className="border-border/50 bg-card/50 opacity-70">
                          <CardContent className="p-4 flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-muted-foreground">{stage.label}</p>
                              <p className="text-xs text-muted-foreground/70">{stage.description}</p>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-medium">Done ✓</span>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* ─── ASSIGNED CHAPTERS ─── */}
            {chapterDetails && chapterDetails.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Assigned Chapters</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {chapterDetails
                    .sort((a, b) => a.chapter_number - b.chapter_number)
                    .map(ch => {
                      const co = getCourse(ch.course_id);
                      const isActive = ch.id === activeChapterId;
                      const counts = perChapterCounts?.[ch.id];
                      const pct = counts && counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
                      return (
                        <Card
                          key={ch.id}
                          className={`cursor-pointer transition-all ${
                            isActive
                              ? "border-2 border-primary/60 bg-primary/5 shadow-sm shadow-primary/10"
                              : "border-border hover:border-primary/30"
                          }`}
                          onClick={() => handleSelectChapter(ch)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className={`text-sm font-semibold ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                                  Ch {ch.chapter_number}: {ch.chapter_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{co?.code}</p>
                              </div>
                              {isActive && (
                                <Badge className="text-[8px] bg-primary/15 text-primary border-0">Active</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="h-1.5 flex-1" />
                              <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                            </div>
                            {counts && (
                              <p className="text-[9px] text-muted-foreground mt-1">
                                {counts.completed} of {counts.total} approved
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}

            {/* ─── FULL WORK QUEUE (collapsible) ─── */}
            <Collapsible open={showFullQueue} onOpenChange={setShowFullQueue}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 mt-2">
                  {showFullQueue ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  <span className="font-medium">Full Work Queue</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                {activeRole === "content_creation_va" && (
                  <ContentCreationQueueInline chapterIds={effectiveChapterIds} vaAccountId={activeVa?.id} />
                )}
                {activeRole === "sheet_prep_va" && (
                  <SheetPrepQueueInline chapterIds={effectiveChapterIds} />
                )}
                {(activeRole === "lead_va" || activeRole === "admin") && (
                  <LeadVaQueueInline chapterIds={effectiveChapterIds} />
                )}
              </CollapsibleContent>
            </Collapsible>
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
              href={JOB_DESC_LINKS[activeRole] || JOB_DESC_LINKS.lead_va}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 p-4 hover:bg-secondary/40 transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Read Job Description</p>
                <p className="text-[10px] text-muted-foreground">Full instructions for your role</p>
              </div>
            </a>
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

// ─── Inline role-specific queue components (thin wrappers importing the originals) ───

import { ContentCreationDashboard } from "@/components/va-dashboards/ContentCreationDashboard";
import { SheetPrepDashboard } from "@/components/va-dashboards/SheetPrepDashboard";
import { LeadVaDashboard } from "@/components/va-dashboards/LeadVaDashboard";

function ContentCreationQueueInline({ chapterIds, vaAccountId }: { chapterIds: string[]; vaAccountId?: string }) {
  return <ContentCreationDashboard chapterIds={chapterIds} vaAccountId={vaAccountId} />;
}

function SheetPrepQueueInline({ chapterIds }: { chapterIds: string[] }) {
  return <SheetPrepDashboard chapterIds={chapterIds} />;
}

function LeadVaQueueInline({ chapterIds }: { chapterIds: string[] }) {
  return <LeadVaDashboard chapterIds={chapterIds} />;
}
