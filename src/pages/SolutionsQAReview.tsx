import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Upload, X, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const SECTION_OPTIONS = [
  "Problem Text",
  "Instructions",
  "Reveal Solution",
  "Reveal How to Solve This",
  "Reveal Journal Entries",
  "Reveal Related Journal Entries",
  "Reveal Important Formulas",
  "Reveal Key Concepts",
  "Reveal Exam Traps",
  "General / Other",
];

type QAAsset = {
  id: string;
  teaching_asset_id: string;
  asset_name: string;
  chapter_id: string;
  course_id: string;
  qa_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type QAIssue = {
  id: string;
  qa_asset_id: string;
  asset_name: string;
  section: string;
  issue_description: string;
  suggested_fix: string | null;
  screenshot_url: string | null;
  fix_description: string | null;
  fix_status: string;
};

export default function SolutionsQAReview() {
  const qc = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [chapterFilter, setChapterFilter] = useState<string>("all");

  // Form state
  const [section, setSection] = useState("");
  const [issueDesc, setIssueDesc] = useState("");
  const [suggestedFix, setSuggestedFix] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const clearForm = () => {
    setSection("");
    setIssueDesc("");
    setSuggestedFix("");
    setScreenshotUrl(null);
  };

  // Seed IA2 records
  const seedMutation = useMutation({
    mutationFn: async () => {
      const { count } = await supabase
        .from("solutions_qa_assets" as any)
        .select("id", { count: "exact", head: true });
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

      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error } = await supabase.from("solutions_qa_assets" as any).insert(batch);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qa-assets"] }),
  });

  useEffect(() => { seedMutation.mutate(); }, []);

  // Fetch all QA asset records
  const { data: allAssets, isLoading } = useQuery({
    queryKey: ["qa-assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solutions_qa_assets" as any)
        .select("*")
        .order("asset_name");
      if (error) throw error;
      return (data as any[]) as QAAsset[];
    },
  });

  // Fetch chapters for filter
  const { data: chapters } = useQuery({
    queryKey: ["qa-chapters"],
    queryFn: async () => {
      const { data: ia2 } = await supabase.from("courses").select("id").ilike("course_name", "%Intermediate Accounting 2%");
      if (!ia2?.length) return [];
      const { data } = await supabase.from("chapters").select("id, chapter_number, chapter_name").eq("course_id", ia2[0].id).order("chapter_number");
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!allAssets) return [];
    let r = allAssets;
    if (chapterFilter !== "all") r = r.filter(rec => rec.chapter_id === chapterFilter);
    return r;
  }, [allAssets, chapterFilter]);

  const current = filtered[currentIndex] ?? null;
  const totalReviewed = allAssets?.filter(r => r.qa_status !== "pending").length ?? 0;
  const totalAll = allAssets?.length ?? 0;
  const progress = totalAll > 0 ? (totalReviewed / totalAll) * 100 : 0;

  // Fetch issues for current asset
  const { data: currentIssues } = useQuery({
    queryKey: ["qa-issues", current?.id],
    queryFn: async () => {
      if (!current) return [];
      const { data, error } = await supabase
        .from("solutions_qa_issues" as any)
        .select("*")
        .eq("qa_asset_id", current.id)
        .order("created_at");
      if (error) throw error;
      return (data as any[]) as QAIssue[];
    },
    enabled: !!current?.id,
  });

  // Close panel + clear form when navigating
  useEffect(() => {
    clearForm();
  }, [current?.id]);

  // Upload screenshot
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

  // Add issue mutation
  const addIssueMutation = useMutation({
    mutationFn: async () => {
      if (!current || !section || !issueDesc.trim()) return;
      const { error } = await supabase.from("solutions_qa_issues" as any).insert({
        qa_asset_id: current.id,
        asset_name: current.asset_name,
        section,
        issue_description: issueDesc.trim(),
        suggested_fix: suggestedFix.trim() || null,
        screenshot_url: screenshotUrl,
        fix_status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-issues", current?.id] });
      clearForm();
      toast.success("Issue added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Delete issue
  const deleteIssueMutation = useMutation({
    mutationFn: async (issueId: string) => {
      const { error } = await supabase.from("solutions_qa_issues" as any).delete().eq("id", issueId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-issues", current?.id] });
      toast.success("Issue removed");
    },
  });

  // Mark reviewed + advance
  const markAndAdvance = useCallback(async (status: "reviewed_clean" | "reviewed_issues") => {
    if (!current) return;

    // If form has content, save it first
    if (section && issueDesc.trim()) {
      await supabase.from("solutions_qa_issues" as any).insert({
        qa_asset_id: current.id,
        asset_name: current.asset_name,
        section,
        issue_description: issueDesc.trim(),
        suggested_fix: suggestedFix.trim() || null,
        screenshot_url: screenshotUrl,
        fix_status: "pending",
      });
      qc.invalidateQueries({ queryKey: ["qa-issues", current.id] });
    }

    // Determine correct status
    const { count } = await supabase
      .from("solutions_qa_issues" as any)
      .select("id", { count: "exact", head: true })
      .eq("qa_asset_id", current.id);
    const finalStatus = (count && count > 0) ? "reviewed_issues" : status;

    const { error } = await supabase
      .from("solutions_qa_assets" as any)
      .update({
        qa_status: finalStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: "VA",
      })
      .eq("id", current.id);
    if (error) { toast.error(error.message); return; }

    qc.invalidateQueries({ queryKey: ["qa-assets"] });
    qc.invalidateQueries({ queryKey: ["qa-pending-count"] });
    toast.success(finalStatus === "reviewed_clean" ? "Marked clean ✓" : "Issues flagged ⚠");
    clearForm();
    setPanelExpanded(false);

    // Advance to next pending
    const nextPending = filtered.findIndex((r, i) => i > currentIndex && r.qa_status === "pending");
    if (nextPending >= 0) setCurrentIndex(nextPending);
    else if (currentIndex < filtered.length - 1) setCurrentIndex(i => i + 1);
  }, [current, currentIndex, filtered, section, issueDesc, suggestedFix, screenshotUrl, qc]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "n") {
        e.preventDefault();
        setCurrentIndex(i => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "p") {
        e.preventDefault();
        setCurrentIndex(i => Math.max(0, i - 1));
      } else if (e.key === "c") {
        e.preventDefault();
        markAndAdvance("reviewed_clean");
      } else if (e.key === "i") {
        e.preventDefault();
        setPanelExpanded(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered.length, markAndAdvance]);

  const issueCount = currentIssues?.length ?? 0;

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-background text-muted-foreground text-sm">Loading QA records...</div>;
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-3">
        <p className="text-muted-foreground text-sm">No QA records found.</p>
        <Select value={chapterFilter} onValueChange={v => { setChapterFilter(v); setCurrentIndex(0); }}>
          <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Filter chapter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All chapters</SelectItem>
            {chapters?.map(ch => <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* COLLAPSIBLE REVIEW PANEL */}
      <div className="shrink-0 border-b border-border bg-card shadow-md z-10">
        {/* Collapsed bar — always visible */}
        <div className="flex items-center gap-3 px-4 py-2.5">
          {/* Back to dashboard */}
          <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="w-px h-5 bg-border shrink-0" />
          {/* Asset info */}
          <span className="font-mono font-bold text-foreground text-sm truncate max-w-[200px]">
            {current?.asset_name}
          </span>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {current?.qa_status.replace(/_/g, " ")}
          </Badge>
          {issueCount > 0 && (
            <Badge className="bg-amber-500/20 text-amber-500 text-[10px] shrink-0">
              {issueCount} issue{issueCount !== 1 ? "s" : ""}
            </Badge>
          )}

          {/* Progress */}
          <div className="hidden sm:flex items-center gap-2 ml-2">
            <Progress value={progress} className="w-24 h-1.5" />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {totalReviewed} / {totalAll}
            </span>
          </div>

          {/* Chapter filter */}
          <Select value={chapterFilter} onValueChange={v => { setChapterFilter(v); setCurrentIndex(0); }}>
            <SelectTrigger className="h-6 text-[10px] w-24 shrink-0">
              <SelectValue placeholder="Ch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {chapters?.map(ch => <SelectItem key={ch.id} value={ch.id}>Ch {ch.chapter_number}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {/* Actions */}
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-3"
            onClick={() => markAndAdvance("reviewed_clean")}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Clean
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10 text-xs h-7 px-3"
            onClick={() => setPanelExpanded(true)}
          >
            <AlertTriangle className="h-3 w-3 mr-1" /> Add Issue
          </Button>

          {/* Navigation */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={currentIndex <= 0}
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {currentIndex + 1}/{filtered.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={currentIndex >= filtered.length - 1}
            onClick={() => setCurrentIndex(i => Math.min(filtered.length - 1, i + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <button
            onClick={() => setPanelExpanded(!panelExpanded)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {panelExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Expanded panel */}
        {panelExpanded && (
          <div className="px-4 pb-4 pt-1 border-t border-border space-y-3 animate-in slide-in-from-top-2 duration-200">
            {/* Existing issues */}
            {issueCount > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Issues logged for this asset:
                </p>
                {currentIssues?.map(issue => (
                  <div key={issue.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                    <Badge variant="outline" className="text-[9px] shrink-0">{issue.section}</Badge>
                    <span className="truncate text-foreground">{issue.issue_description}</span>
                    <button
                      onClick={() => deleteIssueMutation.mutate(issue.id)}
                      className="ml-auto shrink-0 text-destructive hover:text-destructive/80"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add issue form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div>
                  <Label className="text-[10px]">Which section has the issue?</Label>
                  <Select value={section} onValueChange={setSection}>
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue placeholder="Select section..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTION_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Describe the issue</Label>
                  <Textarea
                    value={issueDesc}
                    onChange={e => setIssueDesc(e.target.value)}
                    placeholder="e.g. No line breaks between parts (a) and (b) in the solution text"
                    className="text-xs min-h-[60px] resize-y mt-1"
                    rows={3}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-[10px]">Suggest a fix (optional)</Label>
                  <Textarea
                    value={suggestedFix}
                    onChange={e => setSuggestedFix(e.target.value)}
                    placeholder="e.g. Add a blank line before each part header like (a), (b), (c)"
                    className="text-xs min-h-[44px] resize-y mt-1"
                    rows={2}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Attach screenshot (optional)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <label className="cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handleUploadScreenshot} disabled={uploading} />
                      <Button size="sm" variant="outline" className="text-xs h-7" asChild disabled={uploading}>
                        <span><Upload className="h-3 w-3 mr-1" />{uploading ? "Uploading..." : "Upload"}</span>
                      </Button>
                    </label>
                    {screenshotUrl && (
                      <div className="relative inline-block">
                        <img src={screenshotUrl} alt="QA screenshot" className="max-h-10 rounded border border-border" />
                        <button onClick={() => setScreenshotUrl(null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="text-xs h-7"
                disabled={!section || !issueDesc.trim() || addIssueMutation.isPending}
                onClick={() => addIssueMutation.mutate()}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Issue →
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => markAndAdvance("reviewed_issues")}
              >
                Done — Move to Next →
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7"
                onClick={() => { clearForm(); setPanelExpanded(false); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* IFRAME */}
      <div className="flex-1 min-h-0">
        {current && (
          <iframe
            key={current.asset_name}
            src={`https://learn.surviveaccounting.com/solutions/${current.asset_name}`}
            className="w-full h-full border-0"
            title={`Solutions: ${current.asset_name}`}
          />
        )}
      </div>
    </div>
  );
}
