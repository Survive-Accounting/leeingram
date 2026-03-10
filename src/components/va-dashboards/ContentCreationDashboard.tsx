import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, ExternalLink, DollarSign, HelpCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";

interface Props {
  chapterIds: string[];
  vaAccountId?: string;
}

const RATE_PER_ASSET = 0.40;
const WEEKLY_BUDGET = 40;

const STATUS_ORDER: Record<string, number> = {
  imported: 0,
  generated: 1,
  in_review: 2,
  approved: 3,
  sheets_created: 4,
};

const STATUS_COLORS: Record<string, string> = {
  imported: "border-blue-500/40 text-blue-400",
  generated: "border-amber-500/40 text-amber-400",
  in_review: "border-purple-500/40 text-purple-400",
  approved: "border-emerald-500/40 text-emerald-400",
  sheets_created: "border-cyan-500/40 text-cyan-400",
};

const NEXT_ACTIONS: Record<string, string> = {
  imported: "Generate",
  generated: "Review",
  in_review: "Approve",
  approved: "Create Sheets",
  sheets_created: "Done ✓",
};

export function ContentCreationDashboard({ chapterIds, vaAccountId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch assets
  const { data: assets, isLoading } = useQuery({
    queryKey: ["cc-va-work-queue", chapterIds],
    queryFn: async () => {
      if (!chapterIds.length) return [];
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("id, title, source_code, source_label, pipeline_status, chapter_id, course_id, created_at")
        .in("chapter_id", chapterIds)
        .in("pipeline_status", ["imported", "generated", "approved"])
        .order("source_code", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: chapterIds.length > 0,
  });

  // Fetch teaching assets for "sheets_created" tracking
  const { data: teachingAssets } = useQuery({
    queryKey: ["cc-va-teaching-assets", chapterIds],
    queryFn: async () => {
      if (!chapterIds.length) return [];
      const { data, error } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, source_ref, chapter_id, course_id, google_sheet_status, created_at, asset_approved_at")
        .in("chapter_id", chapterIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: chapterIds.length > 0,
  });

  // Completion log for weekly reporting
  const { data: completionLog } = useQuery({
    queryKey: ["va-completion-log", vaAccountId],
    queryFn: async () => {
      if (!vaAccountId) return [];
      const { data, error } = await supabase
        .from("va_completion_log")
        .select("*")
        .eq("va_account_id", vaAccountId)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!vaAccountId,
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name, course_id");
      return data ?? [];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["courses-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, code");
      return data ?? [];
    },
  });

  const getChapter = (id: string) => chapters?.find(c => c.id === id);
  const getCourse = (id: string) => courses?.find(c => c.id === id);

  // Merge source problems + teaching assets into unified rows
  const workQueue = useMemo(() => {
    const rows: Array<{
      id: string;
      sourceCode: string;
      title: string;
      courseCode: string;
      chapterId: string;
      chapterNum: number;
      status: string;
      nextAction: string;
      updatedAt: string;
    }> = [];

    // Source problems
    assets?.forEach(a => {
      const ch = getChapter(a.chapter_id);
      const co = getCourse(a.course_id);
      rows.push({
        id: a.id,
        sourceCode: a.source_code || a.source_label || "—",
        title: a.title || "—",
        courseCode: co?.code || "—",
        chapterId: a.chapter_id,
        chapterNum: ch?.chapter_number ?? 0,
        status: a.pipeline_status,
        nextAction: NEXT_ACTIONS[a.pipeline_status] || "—",
        updatedAt: a.created_at,
      });
    });

    // Teaching assets with sheets
    teachingAssets?.filter(ta => ta.google_sheet_status !== "none").forEach(ta => {
      const ch = getChapter(ta.chapter_id);
      const co = getCourse(ta.course_id);
      rows.push({
        id: ta.id,
        sourceCode: ta.source_ref || ta.asset_name || "—",
        title: ta.asset_name || "—",
        courseCode: co?.code || "—",
        chapterId: ta.chapter_id,
        chapterNum: ch?.chapter_number ?? 0,
        status: "sheets_created",
        nextAction: "Done ✓",
        updatedAt: ta.asset_approved_at || ta.created_at,
      });
    });

    return rows.sort((a, b) => a.sourceCode.localeCompare(b.sourceCode));
  }, [assets, teachingAssets, chapters, courses]);

  // Apply filters
  const filtered = useMemo(() => {
    return workQueue.filter(r => {
      if (courseFilter !== "all" && r.courseCode !== courseFilter) return false;
      if (chapterFilter !== "all" && r.chapterId !== chapterFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search && !r.sourceCode.toLowerCase().includes(search.toLowerCase()) && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [workQueue, courseFilter, chapterFilter, statusFilter, search]);

  // Unique values for filters
  const uniqueCourses = useMemo(() => [...new Set(workQueue.map(r => r.courseCode))].sort(), [workQueue]);
  const uniqueChapters = useMemo(() => {
    const chs = [...new Set(workQueue.map(r => r.chapterId))];
    return chs.map(id => ({ id, num: getChapter(id)?.chapter_number ?? 0, name: getChapter(id)?.chapter_name ?? "" })).sort((a, b) => a.num - b.num);
  }, [workQueue, chapters]);

  // Weekly stats
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const weeklyApproved = teachingAssets?.filter(ta =>
    ta.asset_approved_at && isWithinInterval(new Date(ta.asset_approved_at), { start: weekStart, end: weekEnd })
  ).length ?? 0;

  const weeklySheetsCreated = teachingAssets?.filter(ta =>
    ta.google_sheet_status !== "none" && ta.asset_approved_at && isWithinInterval(new Date(ta.asset_approved_at), { start: weekStart, end: weekEnd })
  ).length ?? 0;

  const estimatedPayout = weeklySheetsCreated * RATE_PER_ASSET;
  const remainingBudget = WEEKLY_BUDGET - estimatedPayout;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="queue" className="w-full">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="queue" className="text-xs">Work Queue</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs">Reports</TabsTrigger>
          <TabsTrigger value="help" className="text-xs">Help / SOP</TabsTrigger>
        </TabsList>

        {/* ═══ WORK QUEUE ═══ */}
        <TabsContent value="queue" className="space-y-3 mt-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search source code…"
                className="pl-8 h-8 text-xs w-48 bg-secondary/30 border-border"
              />
            </div>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-8 text-xs w-28 bg-secondary/30 border-border">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Courses</SelectItem>
                {uniqueCourses.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={chapterFilter} onValueChange={setChapterFilter}>
              <SelectTrigger className="h-8 text-xs w-36 bg-secondary/30 border-border">
                <SelectValue placeholder="Chapter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Chapters</SelectItem>
                {uniqueChapters.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">Ch {c.num} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-32 bg-secondary/30 border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                <SelectItem value="imported" className="text-xs">Imported</SelectItem>
                <SelectItem value="generated" className="text-xs">Generated</SelectItem>
                <SelectItem value="approved" className="text-xs">Approved</SelectItem>
                <SelectItem value="sheets_created" className="text-xs">Sheets Created</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {filtered.length} of {workQueue.length} items
            </span>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading work queue…
            </div>
          ) : !filtered.length ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No tasks match your filters.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-xs">Source Code</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Course</TableHead>
                    <TableHead className="text-xs">Chapter</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Next Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id} className="text-xs">
                      <TableCell className="font-mono text-foreground">{r.sourceCode}</TableCell>
                      <TableCell className="text-foreground max-w-[200px] truncate">{r.title}</TableCell>
                      <TableCell className="text-muted-foreground">{r.courseCode}</TableCell>
                      <TableCell className="text-muted-foreground">Ch {r.chapterNum}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[r.status] || ""}`}>
                          {r.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.nextAction === "Done ✓" ? (
                          <span className="text-[10px] text-emerald-400 font-medium">Done ✓</span>
                        ) : (
                          <Badge variant="outline" className="text-[9px] border-primary/40 text-primary cursor-pointer hover:bg-primary/10">
                            {r.nextAction}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ═══ REPORTS ═══ */}
        <TabsContent value="reports" className="space-y-4 mt-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Weekly Report</h3>
            <p className="text-[10px] text-muted-foreground">
              Week of {format(weekStart, "MMM d")} — {format(weekEnd, "MMM d, yyyy")}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">{weeklyApproved}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Approved This Week</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
              <p className="text-2xl font-bold text-cyan-400 tabular-nums">{weeklySheetsCreated}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sheets Created</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
              <p className="text-2xl font-bold text-primary tabular-nums flex items-center justify-center">
                <DollarSign className="h-4 w-4" />{estimatedPayout.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. Payout</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-center">
              <p className={`text-2xl font-bold tabular-nums flex items-center justify-center ${remainingBudget < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                <DollarSign className="h-4 w-4" />{remainingBudget.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget Remaining</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Rate:</span> ${RATE_PER_ASSET.toFixed(2)} per asset (sheets created)
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Weekly Budget Target:</span> ${WEEKLY_BUDGET.toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              This is internal tracking only. Paid status and payout history coming soon.
            </p>
          </div>
        </TabsContent>

        {/* ═══ HELP / SOP ═══ */}
        <TabsContent value="help" className="space-y-4 mt-3">
          <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" /> Your Workflow
            </h3>
            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li><span className="text-foreground font-medium">Import</span> — Add source problems from textbook screenshots</li>
              <li><span className="text-foreground font-medium">Generate</span> — AI creates variant problems + solutions</li>
              <li><span className="text-foreground font-medium">Review</span> — Check variant quality, fix issues</li>
              <li><span className="text-foreground font-medium">Approve</span> — Mark asset as ready for production</li>
              <li><span className="text-foreground font-medium">Create Sheets</span> — Generate Google Sheets (M/P/Pr)</li>
            </ol>
            <p className="text-[10px] text-muted-foreground italic">
              Your role ends once sheets are created. Sheet prep and publishing are handled by other team members.
            </p>
          </div>

          <a
            href="https://survive-accounting.slack.com/"
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
  );
}
