import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Upload, X, Image } from "lucide-react";
import { toast } from "sonner";

type QARecord = {
  id: string;
  teaching_asset_id: string;
  asset_name: string;
  chapter_id: string;
  course_id: string;
  qa_status: string;
  issue_description: string | null;
  screenshot_url: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

export default function SolutionsQAReview() {
  const qc = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [issueText, setIssueText] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed_issues" | "reviewed_clean">("all");
  const [chapterFilter, setChapterFilter] = useState<string>("all");

  // Seed IA2 records if none exist
  const seedMutation = useMutation({
    mutationFn: async () => {
      const { count } = await supabase
        .from("solutions_qa_reviews")
        .select("id", { count: "exact", head: true })
        .in("course_id", (await supabase.from("courses").select("id").ilike("course_name", "%Intermediate Accounting 2%")).data?.map(c => c.id) || []);

      if (count && count > 0) return;

      const { data: ia2Courses } = await supabase.from("courses").select("id").ilike("course_name", "%Intermediate Accounting 2%");
      if (!ia2Courses?.length) return;
      const courseId = ia2Courses[0].id;

      const { data: assets } = await supabase
        .from("teaching_assets")
        .select("id, asset_name, chapter_id, course_id")
        .eq("course_id", courseId);
      if (!assets?.length) return;

      const records = assets.map(a => ({
        teaching_asset_id: a.id,
        asset_name: a.asset_name,
        chapter_id: a.chapter_id,
        course_id: a.course_id,
        qa_status: "pending",
      }));

      // Insert in batches of 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error } = await supabase.from("solutions_qa_reviews").insert(batch as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-reviews"] }),
  });

  useEffect(() => { seedMutation.mutate(); }, []);

  // Fetch all QA records
  const { data: allRecords, isLoading } = useQuery({
    queryKey: ["qa-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solutions_qa_reviews")
        .select("*")
        .order("asset_name");
      if (error) throw error;
      return data as QARecord[];
    },
  });

  // Fetch chapters for filter
  const { data: chapters } = useQuery({
    queryKey: ["qa-chapters"],
    queryFn: async () => {
      const { data: ia2Courses } = await supabase.from("courses").select("id").ilike("course_name", "%Intermediate Accounting 2%");
      if (!ia2Courses?.length) return [];
      const { data, error } = await supabase
        .from("chapters")
        .select("id, chapter_number, chapter_name")
        .eq("course_id", ia2Courses[0].id)
        .order("chapter_number");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!allRecords) return [];
    let r = allRecords;
    if (filter !== "all") r = r.filter(rec => rec.qa_status === filter);
    if (chapterFilter !== "all") r = r.filter(rec => rec.chapter_id === chapterFilter);
    return r;
  }, [allRecords, filter, chapterFilter]);

  const current = filtered[currentIndex] ?? null;
  const totalReviewed = allRecords?.filter(r => r.qa_status !== "pending").length ?? 0;
  const totalAll = allRecords?.length ?? 0;
  const progress = totalAll > 0 ? (totalReviewed / totalAll) * 100 : 0;

  // Sync issue text when navigating
  useEffect(() => {
    setIssueText(current?.issue_description || "");
    setScreenshotUrl(current?.screenshot_url || null);
  }, [current?.id]);

  const handleUploadScreenshot = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `qa/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("qa-screenshots").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("qa-screenshots").getPublicUrl(path);
      setScreenshotUrl(urlData.publicUrl);
      toast.success("Screenshot uploaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const markReviewedMutation = useMutation({
    mutationFn: async (status: "reviewed_clean" | "reviewed_issues") => {
      if (!current) return;
      const update: any = {
        qa_status: status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: "VA",
      };
      if (status === "reviewed_issues") {
        update.issue_description = issueText;
        update.screenshot_url = screenshotUrl;
      }
      const { error } = await supabase
        .from("solutions_qa_reviews")
        .update(update)
        .eq("id", current.id);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ["qa-reviews"] });
      toast.success(status === "reviewed_clean" ? "Marked as clean ✓" : "Issue flagged ⚠");
      setIssueText("");
      setScreenshotUrl(null);
      // Auto-advance to next pending
      const nextPending = filtered.findIndex((r, i) => i > currentIndex && r.qa_status === "pending");
      if (nextPending >= 0) setCurrentIndex(nextPending);
      else if (currentIndex < filtered.length - 1) setCurrentIndex(i => i + 1);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusColor = (s: string) => {
    if (s === "pending") return "bg-muted text-muted-foreground";
    if (s === "reviewed_clean") return "bg-emerald-500/20 text-emerald-400";
    if (s === "reviewed_issues") return "bg-amber-500/20 text-amber-400";
    if (s === "fix_approved") return "bg-blue-500/20 text-blue-400";
    return "bg-muted text-muted-foreground";
  };

  // Extract source_ref from asset_name (e.g. "IA2_E13.1_V1" → "E13.1")
  const parseAssetName = (name: string) => {
    const parts = name.split("_");
    return { sourceRef: parts[1] || name, variant: parts[2] || "" };
  };

  return (
    <SurviveSidebarLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Solutions QA Review</h1>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {totalReviewed} of {totalAll} reviewed
          </span>
          <Progress value={progress} className="flex-1 h-2" />
          <span className="text-xs font-mono text-muted-foreground">{Math.round(progress)}%</span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "pending", "reviewed_issues", "reviewed_clean"] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="text-xs h-7"
              onClick={() => { setFilter(f); setCurrentIndex(0); }}
            >
              {f === "all" ? "All" : f === "pending" ? "Pending" : f === "reviewed_issues" ? "Issues" : "Clean"}
            </Button>
          ))}
          <Select value={chapterFilter} onValueChange={v => { setChapterFilter(v); setCurrentIndex(0); }}>
            <SelectTrigger className="h-7 text-xs w-40">
              <SelectValue placeholder="All chapters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All chapters</SelectItem>
              {chapters?.map(ch => (
                <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} assets</span>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-12">Loading QA records...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">No records match this filter.</div>
        ) : current ? (
          <div className="flex gap-4" style={{ height: "calc(100vh - 280px)" }}>
            {/* LEFT PANEL */}
            <div className="w-[40%] shrink-0 space-y-3 overflow-y-auto pr-2">
              {/* Asset info */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-foreground text-sm">{current.asset_name}</span>
                  <Badge className={`text-[10px] ${statusColor(current.qa_status)}`}>
                    {current.qa_status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {parseAssetName(current.asset_name).sourceRef} · {parseAssetName(current.asset_name).variant}
                </p>
              </div>

              {/* Instructions */}
              <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3">
                <p className="text-xs text-blue-300 leading-relaxed">
                  Review the solutions page on the right. If everything looks correct, click "Mark as Reviewed ✓".
                  If you spot a formatting issue, describe it below and optionally attach a screenshot.
                </p>
              </div>

              {/* Issue description */}
              <div>
                <Textarea
                  value={issueText}
                  onChange={e => setIssueText(e.target.value)}
                  placeholder="Describe the issue — e.g. 'Solution text has no line breaks between parts (a) and (b)' or 'Journal entry amounts are missing'"
                  className="text-xs min-h-[80px] resize-y"
                />
              </div>

              {/* Screenshot upload */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadScreenshot}
                      disabled={uploading}
                    />
                    <Button size="sm" variant="outline" className="text-xs h-7" asChild disabled={uploading}>
                      <span>
                        <Upload className="h-3 w-3 mr-1" />
                        {uploading ? "Uploading..." : "Attach Screenshot"}
                      </span>
                    </Button>
                  </label>
                </div>
                {screenshotUrl && (
                  <div className="relative inline-block">
                    <img src={screenshotUrl} alt="QA screenshot" className="max-h-24 rounded border border-border" />
                    <button
                      onClick={() => setScreenshotUrl(null)}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex-1"
                  onClick={() => markReviewedMutation.mutate("reviewed_clean")}
                  disabled={markReviewedMutation.isPending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark as Reviewed ✓
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs flex-1"
                  onClick={() => markReviewedMutation.mutate("reviewed_issues")}
                  disabled={markReviewedMutation.isPending || !issueText.trim()}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Flag Issue
                </Button>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  disabled={currentIndex <= 0}
                  onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1} of {filtered.length}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  disabled={currentIndex >= filtered.length - 1}
                  onClick={() => setCurrentIndex(i => Math.min(filtered.length - 1, i + 1))}
                >
                  Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>

            {/* RIGHT PANEL — iframe */}
            <div className="flex-1 rounded-lg overflow-hidden border border-border">
              <iframe
                key={current.asset_name}
                src={`/solutions/${current.asset_name}`}
                className="w-full h-full border-0"
                title={`Solutions: ${current.asset_name}`}
              />
            </div>
          </div>
        ) : null}
      </div>
    </SurviveSidebarLayout>
  );
}
