import { useEffect, useState } from "react";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Package, Download, ExternalLink, ClipboardList, ListChecks,
  Sparkles, Eye, FileDown, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ──────── Types ──────── */

interface TopicRow {
  id: string;
  topic_name: string;
  topic_number: number | null;
  is_supplementary: boolean;
  is_active: boolean;
  questionCount: number;
  approvedCount: number;
  status: "not_generated" | "needs_review" | "ready";
}

/* ──────── VA Placeholder ──────── */

function VaPlaceholder({ heading, body }: { heading: string; body: string }) {
  return (
    <SurviveSidebarLayout>
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="max-w-md w-full rounded-xl p-8 text-center space-y-4" style={{ backgroundColor: "#14213D" }}>
          <h2 className="text-xl font-bold text-white">{heading}</h2>
          <p className="text-sm text-white/70 leading-relaxed">{body}</p>
          <p className="text-xs text-white/40 mt-4">— Lee Ingram</p>
        </div>
      </div>
    </SurviveSidebarLayout>
  );
}

/* ──────── Status Badge ──────── */

function QuizStatusBadge({ status }: { status: TopicRow["status"] }) {
  const map = {
    not_generated: { label: "Not Generated", cls: "bg-muted text-muted-foreground" },
    needs_review: { label: "Needs Review", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    ready: { label: "Ready", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  } as const;
  const { label, cls } = map[status];
  return <Badge variant="outline" className={cls}>{label}</Badge>;
}

/* ──────── Topic Quizzes Tab ──────── */

function TopicQuizzesTab({ chapterId }: { chapterId: string | undefined }) {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!chapterId) { setLoading(false); return; }

    async function load() {
      setLoading(true);

      // 1. Check if topics are locked
      const { data: ch } = await supabase
        .from("chapters")
        .select("topics_locked")
        .eq("id", chapterId!)
        .single();

      const isLocked = ch?.topics_locked ?? false;
      setLocked(isLocked);

      if (!isLocked) { setTopics([]); setLoading(false); return; }

      // 2. Load active topics
      const { data: topicsData } = await supabase
        .from("chapter_topics")
        .select("id, topic_name, topic_number, is_supplementary, is_active")
        .eq("chapter_id", chapterId!)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!topicsData?.length) { setTopics([]); setLoading(false); return; }

      // 3. Load question counts per topic
      const topicIds = topicsData.map((t) => t.id);
      const { data: questions } = await supabase
        .from("topic_quiz_questions")
        .select("topic_id, review_status")
        .in("topic_id", topicIds);

      const countMap: Record<string, { total: number; approved: number }> = {};
      (questions ?? []).forEach((q) => {
        if (!countMap[q.topic_id]) countMap[q.topic_id] = { total: 0, approved: 0 };
        countMap[q.topic_id].total++;
        if (q.review_status === "approved") countMap[q.topic_id].approved++;
      });

      const rows: TopicRow[] = topicsData.map((t) => {
        const c = countMap[t.id] ?? { total: 0, approved: 0 };
        let status: TopicRow["status"] = "not_generated";
        if (c.total > 0 && c.approved === c.total) status = "ready";
        else if (c.total > 0) status = "needs_review";
        return {
          ...t,
          questionCount: c.total,
          approvedCount: c.approved,
          status,
        };
      });

      // Sort: core topics first (by topic_number), supplementary last
      rows.sort((a, b) => {
        if (a.is_supplementary && !b.is_supplementary) return 1;
        if (!a.is_supplementary && b.is_supplementary) return -1;
        return (a.topic_number ?? 0) - (b.topic_number ?? 0);
      });

      setTopics(rows);
      setLoading(false);
    }

    load();
  }, [chapterId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground animate-pulse">Loading topics…</p>
        </CardContent>
      </Card>
    );
  }

  if (!chapterId) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Select a workspace chapter to view topic quizzes.</p>
        </CardContent>
      </Card>
    );
  }

  if (!locked) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h3 className="text-sm font-semibold text-foreground">No locked topics yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Lock topics in the Topic Generator before generating quizzes.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/phase2-review")}>
            Go to Topic Generator <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          Topic Quizzes · {topics.filter((t) => !t.is_supplementary).length} core topics
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Topic</TableHead>
              <TableHead className="w-[100px] text-center">Questions</TableHead>
              <TableHead className="w-[130px] text-center">Status</TableHead>
              <TableHead className="w-[200px] text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map((t) => (
              <TableRow
                key={t.id}
                className={t.is_supplementary ? "opacity-60" : ""}
              >
                <TableCell className="pl-6">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        t.is_supplementary
                          ? "bg-muted text-muted-foreground text-[10px] w-5 h-5 flex items-center justify-center p-0"
                          : "bg-primary/10 text-primary text-[10px] w-5 h-5 flex items-center justify-center p-0"
                      }
                    >
                      {t.is_supplementary ? "S" : t.topic_number}
                    </Badge>
                    <span className="font-medium text-sm">{t.topic_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">
                  {t.approvedCount} / {t.questionCount || "—"}
                </TableCell>
                <TableCell className="text-center">
                  <QuizStatusBadge status={t.status} />
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex items-center justify-end gap-1.5">
                    {t.status === "not_generated" && (
                      <Button size="sm" className="h-7 text-xs">
                        <Sparkles className="h-3 w-3 mr-1" /> Generate
                      </Button>
                    )}
                    {t.status === "needs_review" && (
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <Eye className="h-3 w-3 mr-1" /> Review
                      </Button>
                    )}
                    {t.status === "ready" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      >
                        <FileDown className="h-3 w-3 mr-1" /> Export CSV
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {topics.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                  No active topics found for this chapter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ──────── Main Page ──────── */

export default function QuizQueue() {
  const { isVa } = useVaAccount();
  const { impersonating } = useImpersonation();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const showPlaceholder = isVa || !!impersonating;

  if (showPlaceholder) {
    return (
      <VaPlaceholder
        heading="Quiz Queue"
        body="This Phase 2 step is where multiple choice questions are generated, reviewed, and exported for LearnWorlds quizzes. Tasks related to this step are coming soon! Thank you for your help building Survive Accounting."
      />
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Workspace header */}
        {workspace && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{workspace.courseName}</span>
            <span>·</span>
            <span>Ch {workspace.chapterNumber}: {workspace.chapterName}</span>
          </div>
        )}

        <div>
          <h1 className="text-lg font-bold text-foreground">Quiz Queue</h1>
          <p className="text-xs text-muted-foreground">Generate, review, and export quizzes for LearnWorlds.</p>
        </div>

        <Tabs defaultValue="topic-quizzes">
          <TabsList>
            <TabsTrigger value="topic-quizzes" className="text-xs">
              <ListChecks className="h-3.5 w-3.5 mr-1.5" /> Topic Quizzes
            </TabsTrigger>
            <TabsTrigger value="mc-generator" className="text-xs">
              <Package className="h-3.5 w-3.5 mr-1.5" /> MC Generator
            </TabsTrigger>
            <TabsTrigger value="export" className="text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSVs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topic-quizzes" className="mt-4">
            <TopicQuizzesTab chapterId={workspace?.chapterId} />
          </TabsContent>

          <TabsContent value="mc-generator" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">MC Generator content lives at its dedicated page.</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/question-review")}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open MC Generator
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="export" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">Quiz export tools live at their dedicated page.</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/quizzes-ready")}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open Export CSVs
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </SurviveSidebarLayout>
  );
}
