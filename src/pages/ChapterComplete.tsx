import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { useVaAccount } from "@/hooks/useVaAccount";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PartyPopper,
  FileInput,
  CheckCircle,
  Layers,
  Library,
  ArrowRight,
  LayoutDashboard,
  Flag,
  Loader2,
} from "lucide-react";

const REPORT_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfExample/viewform";

export default function ChapterComplete() {
  const navigate = useNavigate();
  const { workspace, setWorkspace } = useActiveWorkspace();
  const { vaAccount, assignments } = useVaAccount();
  const chapterId = workspace?.chapterId;
  const courseId = workspace?.courseId;

  // ── Stats queries ──
  const { data: importedCount = 0 } = useQuery({
    queryKey: ["cc-imported", chapterId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("chapter_problems")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", chapterId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!chapterId,
  });

  const { data: generatedCount = 0 } = useQuery({
    queryKey: ["cc-generated", chapterId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("problem_variants")
        .select("id", { count: "exact", head: true })
        .in(
          "base_problem_id",
          (
            await supabase
              .from("chapter_problems")
              .select("id")
              .eq("chapter_id", chapterId!)
          ).data?.map((p) => p.id) ?? []
        );
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!chapterId,
  });

  const { data: assetCount = 0 } = useQuery({
    queryKey: ["cc-assets", chapterId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", chapterId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!chapterId,
  });

  const { data: approvedCount = 0 } = useQuery({
    queryKey: ["cc-approved", chapterId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("chapter_problems")
        .select("id", { count: "exact", head: true })
        .eq("chapter_id", chapterId!)
        .eq("status", "approved");
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!chapterId,
  });

  // ── Next chapter logic ──
  const currentAssignmentIds = assignments?.map((a) => a.chapter_id) ?? [];

  const { data: nextChapter, isLoading: nextLoading } = useQuery({
    queryKey: ["cc-next-chapter", vaAccount?.id, chapterId],
    queryFn: async () => {
      if (!assignments || assignments.length === 0) return null;

      // Find an assigned chapter that isn't the current one
      const otherAssignments = assignments.filter(
        (a) => a.chapter_id !== chapterId && a.status !== "completed"
      );
      if (otherAssignments.length === 0) return null;

      const nextAssignment = otherAssignments[0];

      // Get chapter + course info
      const { data: ch } = await supabase
        .from("chapters")
        .select("*, courses(*)")
        .eq("id", nextAssignment.chapter_id)
        .single();

      return ch;
    },
    enabled: !!vaAccount?.id && !!chapterId,
  });

  const handleStartNext = () => {
    if (!nextChapter) return;
    const course = nextChapter.courses as any;
    setWorkspace({
      courseId: course.id,
      courseName: course.course_name,
      chapterId: nextChapter.id,
      chapterName: nextChapter.chapter_name,
      chapterNumber: nextChapter.chapter_number,
    });
    navigate("/problem-bank");
  };

  const stats = [
    { label: "Imported", value: importedCount, icon: FileInput },
    { label: "Variants", value: generatedCount, icon: Layers },
    { label: "Approved", value: approvedCount, icon: CheckCircle },
    { label: "Assets", value: assetCount, icon: Library },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8 text-center">
        {/* ── Celebration ── */}
        <div className="space-y-3">
          <PartyPopper className="h-16 w-16 mx-auto" style={{ color: "rgba(218,165,32,0.9)" }} />
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "rgba(218,165,32,0.9)" }}
          >
            Chapter Complete! 🎉
          </h1>
          {workspace && (
            <p className="text-base text-muted-foreground">
              {workspace.courseName} — Ch {workspace.chapterNumber}:{" "}
              {workspace.chapterName}
            </p>
          )}
          <p className="text-sm text-muted-foreground/80 max-w-md mx-auto">
            Great work. Your chapter is ready for Lee to review.
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="bg-card/60 border-border">
              <CardContent className="py-5 px-3 text-center space-y-1">
                <s.icon className="h-5 w-5 mx-auto text-muted-foreground" />
                <p className="text-2xl font-bold text-foreground tabular-nums">{s.value}</p>
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  {s.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Next Chapter CTA ── */}
        <div className="space-y-3 pt-2">
          {nextLoading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking next assignment…
            </div>
          ) : nextChapter ? (
            <>
              <Button
                size="lg"
                onClick={handleStartNext}
                className="h-12 px-8 text-base font-semibold shadow-sm"
                style={{
                  background: "linear-gradient(135deg, rgba(218,165,32,0.9), rgba(218,165,32,0.7))",
                  color: "#1a1a2e",
                }}
              >
                Start Next Chapter <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
              <p className="text-xs text-muted-foreground">
                {(nextChapter.courses as any)?.course_name} — Ch{" "}
                {nextChapter.chapter_number}: {nextChapter.chapter_name}
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card/40 p-6">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <p className="text-sm font-medium text-foreground">
                All chapters complete. You're done for now — great work!
              </p>
            </div>
          )}
        </div>

        {/* ── Secondary Actions ── */}
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            onClick={() => navigate("/va-dashboard")}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors inline-flex items-center gap-1"
          >
            <LayoutDashboard className="h-3 w-3" /> Return to Dashboard
          </button>
          <span className="text-border">·</span>
          <a
            href={REPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors inline-flex items-center gap-1"
          >
            <Flag className="h-3 w-3" /> Report an Issue
          </a>
        </div>
      </div>
    </div>
  );
}
