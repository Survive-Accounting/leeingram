import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, RefreshCw, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { runValidation, hasFailures, type ValidationResult, type AnswerPackageData } from "@/lib/validation";
import { logActivity } from "@/lib/activityLogger";

interface Props {
  sourceProblemId: string;
}

const STATUS_STYLES: Record<string, string> = {
  drafted: "bg-muted text-muted-foreground",
  needs_review: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
};

function ValidationIcon({ status }: { status: string }) {
  if (status === "pass") return <CheckCircle2 className="h-3 w-3 text-green-400" />;
  if (status === "fail") return <XCircle className="h-3 w-3 text-destructive" />;
  return <AlertTriangle className="h-3 w-3 text-amber-400" />;
}

export function AnswerPackagePanel({ sourceProblemId }: Props) {
  const qc = useQueryClient();
  const [showWork, setShowWork] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);

  const { data: packages, isLoading } = useQuery({
    queryKey: ["answer-packages", sourceProblemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("answer_packages")
        .select("*")
        .eq("source_problem_id", sourceProblemId)
        .order("version", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!sourceProblemId,
  });

  const latest = packages?.[0];
  const olderVersions = packages?.slice(1) ?? [];
  const validationResults: ValidationResult[] = latest?.validation_results ?? [];
  const failed = hasFailures(validationResults);

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!latest) return;
      if (failed) throw new Error("Cannot approve with validation failures");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("answer_packages").update({
        status: "approved" as any,
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      } as any).eq("id", latest.id);
      if (error) throw error;
      await logActivity({
        actor_type: "user",
        entity_type: "source_problem",
        entity_id: sourceProblemId,
        event_type: "answer_package_approved",
        payload_json: { package_id: latest.id, version: latest.version },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["answer-packages"] });
      toast.success("Answer package approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revalidateMutation = useMutation({
    mutationFn: async () => {
      if (!latest) return;
      const pkg: AnswerPackageData = {
        answer_payload: latest.answer_payload ?? {},
        extracted_inputs: latest.extracted_inputs ?? {},
        computed_values: latest.computed_values ?? {},
      };
      const results = runValidation(pkg);
      const newStatus = hasFailures(results) ? "needs_review" : "drafted";
      const { error } = await supabase.from("answer_packages").update({
        validation_results: results as any,
        status: newStatus as any,
      } as any).eq("id", latest.id);
      if (error) throw error;
      await logActivity({
        actor_type: "system",
        entity_type: "source_problem",
        entity_id: sourceProblemId,
        event_type: "validation_rerun",
        payload_json: { package_id: latest.id, results },
        severity: hasFailures(results) ? "warn" : "info",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["answer-packages"] });
      toast.success("Validation re-run complete");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-xs text-muted-foreground">Loading answer packages…</p>;
  if (!latest) return <p className="text-xs text-muted-foreground">No answer packages generated yet.</p>;

  return (
    <div className="space-y-3">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">Answer Package v{latest.version}</span>
          <Badge variant="outline" className={cn("text-[10px]", STATUS_STYLES[latest.status])}>
            {latest.status === "needs_review" ? "Needs Review" : latest.status}
          </Badge>
          <Badge variant="outline" className="text-[10px]">{latest.generator}</Badge>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => revalidateMutation.mutate()} disabled={revalidateMutation.isPending}>
            <RefreshCw className="h-3 w-3 mr-1" /> Re-validate
          </Button>
          {!failed && latest.status !== "approved" && (
            <Button size="sm" className="h-6 text-[10px]" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
            </Button>
          )}
        </div>
      </div>

      {/* Validation results */}
      {failed && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2">
          <p className="text-xs font-semibold text-destructive flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> Validation Failures — Cannot Approve
          </p>
        </div>
      )}

      <div className="space-y-0.5">
        {validationResults.map((r, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1 text-xs">
            <ValidationIcon status={r.status} />
            <span className="font-mono text-muted-foreground w-44 truncate">{r.validator}</span>
            <span className={cn("truncate", r.status === "fail" ? "text-destructive" : "text-muted-foreground")}>{r.message}</span>
          </div>
        ))}
      </div>

      {/* Show Work */}
      <Collapsible open={showWork} onOpenChange={setShowWork}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
          <Eye className="h-3 w-3" /> Show Work
          <ChevronDown className={cn("h-3 w-3 transition-transform", showWork && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Extracted Inputs</p>
            <pre className="text-[10px] bg-muted/30 rounded p-2 overflow-x-auto max-h-32">{JSON.stringify(latest.extracted_inputs, null, 2)}</pre>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Computed Values</p>
            <pre className="text-[10px] bg-muted/30 rounded p-2 overflow-x-auto max-h-32">{JSON.stringify(latest.computed_values, null, 2)}</pre>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Answer Payload</p>
            <pre className="text-[10px] bg-muted/30 rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(latest.answer_payload, null, 2)}</pre>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Older versions */}
      {olderVersions.length > 0 && (
        <Collapsible open={showAllVersions} onOpenChange={setShowAllVersions}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ChevronDown className={cn("h-3 w-3 transition-transform", showAllVersions && "rotate-180")} />
            {olderVersions.length} older version(s)
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1">
            {olderVersions.map((pkg) => (
              <div key={pkg.id} className="flex items-center gap-2 px-2 py-1 text-xs border border-border rounded">
                <span>v{pkg.version}</span>
                <Badge variant="outline" className={cn("text-[9px]", STATUS_STYLES[pkg.status])}>{pkg.status}</Badge>
                <span className="text-muted-foreground">{pkg.generator}</span>
                <span className="text-muted-foreground ml-auto">{new Date(pkg.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
