import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  TrendingDown, Wrench, RefreshCw, ThumbsDown, MessageSquare, Eye,
  Loader2, ChevronRight,
} from "lucide-react";

const NAVY = "#14213D";
const RED = "#CE1126";

export interface ChapterInsight {
  chapterId: string;
  chapterLabel: string;
  courseLabel: string | null;
  feedbackCount: number;
  thumbsDown: number;
  thumbsUp: number;
  helpfulnessRatio: number | null;
  problemReports: number;
  helperClicks: number;
  helperOpens: number;
  fullSolutionClicks: number;
  walkThroughClicks: number;
  fullVsWalkRatio: number;
  aiResponseDislikes: number;
  topIssueCategory: string | null;
  sampleQuotes: string[];
  confusionScore: number;
}

export interface ToolInsight {
  tool: string;
  toolLabel: string;
  opens: number;
  helperClicks: number;
  uniqueUsers: number;
  sessions: number;
  usagePerUser: number;
  thumbsUp: number;
  thumbsDown: number;
  helpfulnessRatio: number | null;
  cacheHitRate: number | null;
  cacheTotal: number;
  fullSolutionClicks: number;
  walkThroughClicks: number;
  topActions: Array<{ action: string; count: number }>;
}

interface Props {
  startDate: string;
  onViewChapterFeedback?: (chapterId: string, chapterLabel: string) => void;
}

export function InsightsSections({ startDate, onViewChapterFeedback }: Props) {
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<ChapterInsight[]>([]);
  const [tools, setTools] = useState<ToolInsight[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("beta-insights", {
        body: { startDate },
      });
      if (error) throw error;
      const payload = data as any;
      setChapters(payload?.chapterInsights ?? []);
      setTools(payload?.toolInsights ?? []);
    } catch (e: any) {
      toast.error(`Failed to load insights: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, [startDate]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <ConfusingChaptersCard
        loading={loading}
        chapters={chapters}
        onRefresh={load}
        onViewFeedback={onViewChapterFeedback}
      />
      <TopToolsCard loading={loading} tools={tools} onRefresh={load} />
    </div>
  );
}

function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${Math.round(n * 100)}%`;
}

function ConfusingChaptersCard({
  loading, chapters, onRefresh, onViewFeedback,
}: {
  loading: boolean;
  chapters: ChapterInsight[];
  onRefresh: () => void;
  onViewFeedback?: (chapterId: string, chapterLabel: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: NAVY }}>
              <TrendingDown className="h-5 w-5" style={{ color: RED }} /> Top Confusing Chapters
            </h2>
            <p className="text-xs text-muted-foreground">
              Ranked by a blend of thumbs-downs, written feedback, problem reports, AI dislikes, and full-solution vs walk-through behavior.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>

        <div className="border rounded-md overflow-hidden">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[80px]">Course</TableHead>
                  <TableHead>Chapter</TableHead>
                  <TableHead className="w-[80px] text-right">Feedback</TableHead>
                  <TableHead className="w-[80px] text-right">👎</TableHead>
                  <TableHead className="w-[100px] text-right">Helpful%</TableHead>
                  <TableHead className="w-[110px] text-right">Full / Walk</TableHead>
                  <TableHead className="w-[140px]">Top issue</TableHead>
                  <TableHead>Sample feedback</TableHead>
                  <TableHead className="w-[140px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-sm text-muted-foreground">Loading insights…</TableCell></TableRow>
                ) : chapters.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-sm text-muted-foreground italic">No chapter signals in this range.</TableCell></TableRow>
                ) : chapters.map(c => {
                  const lowHelp = c.helpfulnessRatio !== null && c.helpfulnessRatio < 0.5;
                  return (
                    <TableRow key={c.chapterId} className="align-top">
                      <TableCell className="text-xs">{c.courseLabel ?? "—"}</TableCell>
                      <TableCell className="text-xs font-medium">{c.chapterLabel}</TableCell>
                      <TableCell className="text-xs text-right">{c.feedbackCount}</TableCell>
                      <TableCell className="text-xs text-right">
                        {c.thumbsDown > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                            <ThumbsDown className="h-3 w-3" /> {c.thumbsDown}
                          </span>
                        ) : "0"}
                      </TableCell>
                      <TableCell className={`text-xs text-right ${lowHelp ? "text-red-600 font-medium" : ""}`}>
                        {pct(c.helpfulnessRatio)}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {c.fullSolutionClicks} / {c.walkThroughClicks}
                      </TableCell>
                      <TableCell>
                        {c.topIssueCategory ? (
                          <Badge variant="outline" className="text-[10px]">{c.topIssueCategory}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs max-w-[360px]">
                        {c.sampleQuotes.length === 0 ? (
                          <span className="text-muted-foreground italic">(no text)</span>
                        ) : (
                          <div className="italic line-clamp-3">"{c.sampleQuotes[0]}"</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => onViewFeedback?.(c.chapterId, c.chapterLabel)}
                        >
                          <Eye className="h-3 w-3 mr-1" /> View Feedback
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopToolsCard({
  loading, tools, onRefresh,
}: {
  loading: boolean; tools: ToolInsight[]; onRefresh: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: NAVY }}>
              <Wrench className="h-5 w-5" /> Top Used Tools
            </h2>
            <p className="text-xs text-muted-foreground">
              Ranked by total opens + helper clicks. Shows unique users, repeat usage, ratings, and cache hit rate.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        </div>

        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader className="bg-background">
              <TableRow>
                <TableHead>Tool</TableHead>
                <TableHead className="w-[80px] text-right">Opens</TableHead>
                <TableHead className="w-[100px] text-right">Helper clicks</TableHead>
                <TableHead className="w-[100px] text-right">Unique users</TableHead>
                <TableHead className="w-[100px] text-right">Avg / user</TableHead>
                <TableHead className="w-[110px] text-right">Helpful%</TableHead>
                <TableHead className="w-[100px] text-right">Cache hit%</TableHead>
                <TableHead className="w-[120px] text-right">Full / Walk</TableHead>
                <TableHead>Top actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-sm text-muted-foreground">Loading insights…</TableCell></TableRow>
              ) : tools.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-6 text-sm text-muted-foreground italic">No tool usage in this range.</TableCell></TableRow>
              ) : tools.map(t => {
                const lowHelp = t.helpfulnessRatio !== null && t.helpfulnessRatio < 0.5;
                return (
                  <TableRow key={t.tool} className="align-top">
                    <TableCell className="text-xs font-medium capitalize">{t.toolLabel}</TableCell>
                    <TableCell className="text-xs text-right">{t.opens}</TableCell>
                    <TableCell className="text-xs text-right">{t.helperClicks}</TableCell>
                    <TableCell className="text-xs text-right">{t.uniqueUsers}</TableCell>
                    <TableCell className="text-xs text-right">{t.usagePerUser.toFixed(1)}</TableCell>
                    <TableCell className={`text-xs text-right ${lowHelp ? "text-red-600 font-medium" : ""}`}>
                      {pct(t.helpfulnessRatio)}{t.thumbsUp + t.thumbsDown > 0 && (
                        <span className="text-muted-foreground"> ({t.thumbsUp + t.thumbsDown})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {pct(t.cacheHitRate)}{t.cacheTotal > 0 && (
                        <span className="text-muted-foreground"> ({t.cacheTotal})</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {t.fullSolutionClicks} / {t.walkThroughClicks}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.topActions.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : t.topActions.map(a => (
                          <Badge key={a.action} variant="outline" className="text-[10px]">
                            {a.action} <span className="ml-1 text-muted-foreground">×{a.count}</span>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
