import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { JournalEntryTable } from "@/components/JournalEntryTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, CheckCircle2, Copy, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { JournalEntryGroup } from "@/lib/journalEntryParser";

// Detail view for a generated teaching asset
export default function TutoringReviewDetail() {
  const { problemId } = useParams<{ problemId: string }>();

  const { data: asset, refetch } = useQuery({
    queryKey: ["tutoring-asset", problemId],
    queryFn: async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("*, courses(code, course_name), chapters(chapter_name, chapter_number)")
        .eq("id", problemId!)
        .single();
      return data;
    },
    enabled: !!problemId,
  });

  const handleMarkUsed = async () => {
    if (!asset) return;
    const { error } = await supabase
      .from("teaching_assets")
      .update({ last_tutored_at: new Date().toISOString(), times_used: (asset.times_used ?? 0) + 1 })
      .eq("id", asset.id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success("Marked as used in tutoring");
    refetch();
  };

  const handleCopyProblem = () => {
    if (!asset?.survive_problem_text) return;
    navigator.clipboard.writeText(asset.survive_problem_text);
    toast.success("Problem text copied");
  };

  if (!asset) {
    return (
      <SurviveSidebarLayout>
        <p className="text-foreground/80 text-sm py-12 text-center">Loading...</p>
      </SurviveSidebarLayout>
    );
  }

  const solutionSteps = asset.survive_solution_text
    ? asset.survive_solution_text.split(/(?=Step\s+\d+)/gi).filter(Boolean)
    : [];

  return (
    <SurviveSidebarLayout>
      <div className="flex items-center justify-between mb-5">
        <Link to="/tutoring/review" className="flex items-center gap-1.5 text-foreground/70 hover:text-foreground text-sm transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Review List
        </Link>
        <Button size="sm" onClick={handleMarkUsed} className="h-8 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Used in Tutoring
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {asset.source_ref && <span className="text-xs font-mono text-primary">{asset.source_ref}</span>}
        <span className="text-[10px] text-foreground/70 uppercase">
          {(asset as any).courses?.code} • Ch {(asset as any).chapters?.chapter_number}: {(asset as any).chapters?.chapter_name}
        </span>
        {asset.difficulty && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-foreground/80">{asset.difficulty}</Badge>
        )}
        <span className="text-[10px] text-foreground/70">Used {asset.times_used ?? 0}×</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-lg border border-border bg-background/95 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Problem</h2>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={handleCopyProblem}>
              <Copy className="h-3 w-3 mr-1" /> Copy Text
            </Button>
          </div>
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {asset.survive_problem_text || "No problem text available."}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background/95 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">Solution Panel</h2>

          <CollapsibleSection title="Journal Entries (Completed)">
            <JournalEntryTable
              completedJson={asset.journal_entry_completed_json as unknown as JournalEntryGroup[] | null}
              legacyJEBlock={asset.journal_entry_block}
              mode="completed"
              showHeading={false}
            />
          </CollapsibleSection>

          <CollapsibleSection title="Journal Entry (Template)">
            <JournalEntryTable
              templateJson={asset.journal_entry_template_json as unknown as JournalEntryGroup[] | null}
              completedJson={asset.journal_entry_completed_json as unknown as JournalEntryGroup[] | null}
              legacyJEBlock={asset.journal_entry_block}
              mode="template"
              showHeading={false}
            />
          </CollapsibleSection>

          <CollapsibleSection title="Step-by-Step Solution">
            {solutionSteps.length > 0 ? (
              <div className="space-y-2">
                {solutionSteps.map((step, i) => {
                  const headerMatch = step.match(/^(Step\s+\d+[^:]*:?)/i);
                  const header = headerMatch?.[1] || "";
                  const body = step.replace(header, "").trim();
                  return (
                    <div key={i}>
                      {header && <p className="font-semibold text-sm text-foreground">{header}</p>}
                      {body && <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{body}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {asset.survive_solution_text || "No solution text."}
              </p>
            )}
          </CollapsibleSection>

          {asset.tags && asset.tags.length > 0 && (
            <CollapsibleSection title="Tags / Concepts">
              <div className="flex flex-wrap gap-1.5">
                {asset.tags.map((t: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-[10px] border-border text-foreground/80">{t}</Badge>
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
