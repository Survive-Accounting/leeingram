import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link2, SkipForward, Merge, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  chapterId: string;
  courseId: string;
}

export function DependentProblemsQueue({ chapterId, courseId }: Props) {
  const qc = useQueryClient();

  const { data: dependentProblems, isLoading } = useQuery({
    queryKey: ["dependent-problems", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("id, source_label, title, ocr_detected_label, ocr_detected_title, ocr_extracted_problem_text, problem_text, dependency_type, dependency_status, detected_dependency_ref, status, pipeline_status")
        .eq("chapter_id", chapterId)
        .eq("dependency_type", "dependent_problem");
      if (error) throw error;
      return (data as any[]).sort((a, b) =>
        (a.source_label || "").localeCompare(b.source_label || "", undefined, { numeric: true, sensitivity: "base" })
      );
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (problemId: string) => {
      const { error } = await supabase
        .from("chapter_problems")
        .update({
          dependency_status: "skipped",
          dependency_type: "standalone",
        } as any)
        .eq("id", problemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dependent-problems", chapterId] });
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      toast.success("Problem marked as standalone — now eligible for generation.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertToCombinedMutation = useMutation({
    mutationFn: async (problemId: string) => {
      const { error } = await supabase
        .from("chapter_problems")
        .update({
          dependency_status: "combined",
        } as any)
        .eq("id", problemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dependent-problems", chapterId] });
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      toast.success("Marked for combined case — merge source material manually, then mark ready.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uncombineMutation = useMutation({
    mutationFn: async (problemId: string) => {
      const { error } = await supabase
        .from("chapter_problems")
        .update({
          dependency_type: "standalone",
          dependency_status: "none",
          combined_group_id: null,
        } as any)
        .eq("id", problemId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dependent-problems", chapterId] });
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      toast.success("Unlinked — problem is now standalone.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;

  const needsReview = dependentProblems?.filter(p => p.dependency_status === "needs_review") ?? [];
  const handled = dependentProblems?.filter(p => p.dependency_status !== "needs_review") ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-foreground">Dependent Problems Queue</h3>
        {needsReview.length > 0 && (
          <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
            {needsReview.length} need review
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        These problems reference other problems in the textbook. Review them to decide: skip (treat as standalone) or convert to a combined case asset.
      </p>

      {needsReview.length === 0 && handled.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No dependent problems detected in this chapter.</p>
      )}

      {needsReview.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Source</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[140px]">References</TableHead>
              <TableHead className="w-[200px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {needsReview.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.ocr_detected_label || p.source_label}</TableCell>
                <TableCell className="text-sm">{p.ocr_detected_title || p.title || "—"}</TableCell>
                <TableCell>
                  {p.detected_dependency_ref ? (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/20">
                      <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                      {p.detected_dependency_ref}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Previous problem</span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => convertToCombinedMutation.mutate(p.id)}
                    disabled={convertToCombinedMutation.isPending}
                  >
                    <Merge className="h-3 w-3 mr-1" /> Combined Case
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => skipMutation.mutate(p.id)}
                    disabled={skipMutation.isPending}
                  >
                    <SkipForward className="h-3 w-3 mr-1" /> Skip
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {handled.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Previously Handled</p>
          <div className="space-y-1">
            {handled.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/30">
                <span className="text-xs font-mono text-foreground/70">{p.ocr_detected_label || p.source_label}</span>
                <Badge variant="outline" className="text-[9px]">{p.dependency_status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
