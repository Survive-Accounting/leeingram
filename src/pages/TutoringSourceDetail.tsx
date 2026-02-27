import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { JournalEntryTable } from "@/components/JournalEntryTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Copy, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { parseLegacyJEBlock } from "@/lib/journalEntryParser";

export default function TutoringSourceDetail() {
  const { problemId } = useParams<{ problemId: string }>();

  const { data: problem } = useQuery({
    queryKey: ["tutoring-source-problem", problemId],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapter_problems")
        .select("*, courses(code, course_name), chapters(chapter_name, chapter_number)")
        .eq("id", problemId!)
        .single();
      return data;
    },
    enabled: !!problemId,
  });

  const handleCopyProblem = () => {
    const text = problem?.problem_text || problem?.ocr_extracted_problem_text;
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Problem text copied");
  };

  const handleCopySolution = () => {
    const text = problem?.solution_text || problem?.ocr_extracted_solution_text;
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Solution text copied");
  };

  if (!problem) {
    return (
      <SurviveSidebarLayout>
        <p className="text-foreground/80 text-sm py-12 text-center">Loading...</p>
      </SurviveSidebarLayout>
    );
  }

  const problemText = problem.problem_text || problem.ocr_extracted_problem_text || "No problem text available.";
  const solutionText = problem.solution_text || problem.ocr_extracted_solution_text || "No solution text.";
  const hasJournalEntry = !!problem.journal_entry_text;

  // Parse journal entry from legacy text if available
  const parsedJE = hasJournalEntry ? parseLegacyJEBlock(problem.journal_entry_text!) : null;

  return (
    <SurviveSidebarLayout>
      <div className="flex items-center justify-between mb-5">
        <Link to="/tutoring/review" className="flex items-center gap-1.5 text-foreground/70 hover:text-foreground text-sm transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Review List
        </Link>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {problem.source_label && <span className="text-xs font-mono text-primary">{problem.source_label}</span>}
        {problem.title && <span className="text-xs font-medium text-foreground">{problem.title}</span>}
        <span className="text-[10px] text-foreground/70 uppercase">
          {(problem as any).courses?.code} • Ch {(problem as any).chapters?.chapter_number}: {(problem as any).chapters?.chapter_name}
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-foreground/80">
          {problem.problem_type}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-foreground/60">
          {problem.status}
        </Badge>
        {problem.difficulty_internal && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-foreground/80">
            {problem.difficulty_internal}
          </Badge>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT: Problem */}
        <div className="rounded-lg border border-border bg-background/95 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Problem</h2>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={handleCopyProblem}>
              <Copy className="h-3 w-3 mr-1" /> Copy Text
            </Button>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {problemText}
          </p>

          {/* Problem screenshots */}
          {problem.problem_screenshot_urls && problem.problem_screenshot_urls.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[10px] text-foreground/60 uppercase tracking-wider">Screenshots</p>
              <div className="grid grid-cols-2 gap-2">
                {problem.problem_screenshot_urls.map((url: string, i: number) => (
                  <img key={i} src={url} alt={`Problem screenshot ${i + 1}`} className="rounded border border-border w-full" />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Solution Panel */}
        <div className="rounded-lg border border-border bg-background/95 p-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Solution Panel</h2>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={handleCopySolution}>
              <Copy className="h-3 w-3 mr-1" /> Copy Solution
            </Button>
          </div>

          {/* Journal Entry */}
          {hasJournalEntry && (
            <CollapsibleSection title="Journal Entry">
              <JournalEntryTable
                legacyJEBlock={problem.journal_entry_text}
                mode="completed"
                showHeading={false}
              />
            </CollapsibleSection>
          )}

          {/* Solution Text */}
          <CollapsibleSection title="Full Solution">
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {solutionText}
            </p>
          </CollapsibleSection>

          {/* Solution screenshots */}
          {problem.solution_screenshot_urls && problem.solution_screenshot_urls.length > 0 && (
            <CollapsibleSection title="Solution Screenshots">
              <div className="grid grid-cols-2 gap-2">
                {problem.solution_screenshot_urls.map((url: string, i: number) => (
                  <img key={i} src={url} alt={`Solution screenshot ${i + 1}`} className="rounded border border-border w-full" />
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      </div>
    </SurviveSidebarLayout>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible className="rounded-md border border-border overflow-hidden">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors text-left">
        <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">{title}</span>
        <ChevronDown className="h-3.5 w-3.5 text-foreground/60 transition-transform [[data-state=open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
