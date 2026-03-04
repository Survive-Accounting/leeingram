import { useState, useCallback, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImagePasteArea } from "@/components/content-factory/ImagePasteArea";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, SkipForward, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";

type QueueItem = {
  id: string;
  source_label: string;
  source_code: string;
  solution_text: string;
  import_status: string;
};

export default function ScreenshotCapture() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const qc = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [showSolution, setShowSolution] = useState(false);

  const { data: chapter } = useQuery({
    queryKey: ["chapter", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*, courses(*)")
        .eq("id", chapterId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!chapterId,
  });

  // Queue: sources needing problem screenshots
  const { data: queue, isLoading } = useQuery({
    queryKey: ["screenshot-queue", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("id, source_label, source_code, solution_text, import_status")
        .eq("chapter_id", chapterId!)
        .eq("import_status", "needs_problem_screenshot" as any)
        .order("source_label");
      if (error) throw error;
      return data as QueueItem[];
    },
    enabled: !!chapterId,
  });

  const current = queue?.[currentIndex] ?? null;
  const total = queue?.length ?? 0;

  const uploadFile = async (file: File): Promise<string> => {
    const ext = file.name?.split(".").pop() || "png";
    const path = `intake-problems/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("problem-assets").upload(path, file, { contentType: file.type });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("problem-assets").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!current || files.length === 0) throw new Error("No files to save");

      const urls = await Promise.all(files.map((f) => uploadFile(f)));

      const { error } = await supabase
        .from("chapter_problems")
        .update({
          problem_screenshot_url: urls[0],
          problem_screenshot_urls: urls,
          import_status: "ready_for_variants",
        } as any)
        .eq("id", current.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved — next");
      setFiles([]);
      setShowSolution(false);
      qc.invalidateQueries({ queryKey: ["screenshot-queue", chapterId] });
      // Auto-advance handled by queue refetch (current item leaves queue)
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Auto-save when files are added
  const handleAddFiles = useCallback(
    (newFiles: File[]) => {
      setFiles(newFiles);
    },
    []
  );

  // Auto-save effect: when files change and there's at least one, save immediately
  useEffect(() => {
    if (files.length > 0 && current && !saveMutation.isPending) {
      saveMutation.mutate();
    }
  }, [files]);

  const skipMutation = useMutation({
    mutationFn: async () => {
      if (!current) return;
      const { error } = await supabase
        .from("chapter_problems")
        .update({ import_status: "needs_review" } as any)
        .eq("id", current.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast("Skipped — marked for review");
      qc.invalidateQueries({ queryKey: ["screenshot-queue", chapterId] });
    },
  });

  const course = chapter?.courses as { course_name: string } | undefined;

  if (!chapter || !course) {
    return (
      <SurviveSidebarLayout>
        <div className="text-foreground/80">Loading...</div>
      </SurviveSidebarLayout>
    );
  }

  return (
    <SurviveSidebarLayout>
      <div className="mb-4">
        <Link
          to="/problem-bank"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Problem Import
        </Link>
      </div>

      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground">
          Screenshot Capture — Ch {chapter.chapter_number}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Paste problem screenshots. Auto-saves and advances to next source.
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-4">
        <Badge variant="outline" className="text-xs">
          {total === 0 ? "All done!" : `${total} remaining`}
        </Badge>
        {current && (
          <span className="text-xs text-muted-foreground">
            Current: <span className="font-mono font-medium text-foreground">{current.source_label || current.source_code}</span>
          </span>
        )}
      </div>

      {total === 0 && !isLoading ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Check className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-foreground">All sources have problem screenshots attached!</p>
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link to="/problem-bank">Back to Problem Import</Link>
            </Button>
          </CardContent>
        </Card>
      ) : current ? (
        <div className="space-y-4">
          {/* Current source card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-mono">
                  {current.source_label || current.source_code}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setShowSolution(!showSolution)}
                  >
                    {showSolution ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {showSolution ? "Hide" : "Show"} Solution
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => skipMutation.mutate()}
                    disabled={skipMutation.isPending}
                  >
                    <SkipForward className="h-3 w-3 mr-1" /> Skip
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Solution preview */}
              {showSolution && current.solution_text && (
                <div className="rounded-md border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">Solution Text</p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-mono">
                    {current.solution_text}
                  </pre>
                </div>
              )}

              {/* Screenshot paste area */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Paste or drop problem screenshot (auto-saves & advances)
                </p>
                <ImagePasteArea
                  label="Paste problem screenshot (Ctrl+V)"
                  files={files}
                  onAdd={(newFiles) => handleAddFiles(newFiles)}
                  onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} of {total}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={currentIndex >= total - 1}
              onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
            >
              Forward <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-8">Loading queue...</div>
      )}
    </SurviveSidebarLayout>
  );
}
