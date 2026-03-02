import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Beaker, Loader2, ThumbsUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { runValidation, hasFailures, type AnswerPackageData, type ValidationResult } from "@/lib/validation";
import { logActivity } from "@/lib/activityLogger";
import { normalizeValidatePersistAnswerPackage, logUnparseableOutput } from "@/lib/answerPackagePipeline";
import { JE_SYSTEM_PROMPT, buildJEUserPrompt } from "@/lib/jeSystemPrompt";
import { GenerationLogger } from "@/lib/generationLogger";

interface Props {
  sourceProblemId: string;
  problemText: string;
  solutionText: string;
  latestPackage?: any;
}

function ValidationIcon({ status }: { status: string }) {
  if (status === "pass") return <CheckCircle2 className="h-3 w-3 text-green-400" />;
  if (status === "fail") return <XCircle className="h-3 w-3 text-destructive" />;
  return <AlertTriangle className="h-3 w-3 text-amber-400" />;
}

function flattenForDiff(obj: any, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (obj === null || obj === undefined) return result;
  if (typeof obj !== "object") { result[prefix] = String(obj); return result; }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => Object.assign(result, flattenForDiff(item, `${prefix}[${i}]`)));
    return result;
  }
  for (const key of Object.keys(obj))
    Object.assign(result, flattenForDiff(obj[key], prefix ? `${prefix}.${key}` : key));
  return result;
}

function PackageCard({ label, pkg, badge }: { label: string; pkg: any; badge: string }) {
  const validation: ValidationResult[] = pkg?.validation_results ?? [];
  const failed = hasFailures(validation);
  const answers = pkg?.answer_payload?.final_answers ?? [];
  const je = pkg?.answer_payload?.teaching_aids?.journal_entries ?? [];

  return (
    <div className="flex-1 min-w-0 border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">{label}</span>
        <Badge variant="outline" className="text-[9px]">{badge}</Badge>
        <Badge variant="outline" className={cn("text-[9px]", failed ? "text-destructive border-destructive/30" : "text-green-400 border-green-500/30")}>
          {failed ? "Fail" : "Pass"}
        </Badge>
      </div>
      {/* Final Answers */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Final Answers</p>
        {answers.length > 0 ? answers.map((a: any, i: number) => (
          <div key={i} className="text-xs flex gap-2">
            <span className="text-muted-foreground">{a.label}:</span>
            <span className="font-mono">{a.value}</span>
          </div>
        )) : <p className="text-[10px] text-muted-foreground italic">None</p>}
      </div>
      {/* JE count */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Journal Entries</p>
        <p className="text-xs text-muted-foreground">{je.length} section(s)</p>
      </div>
      {/* Validation */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Validation</p>
        {validation.map((v, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px]">
            <ValidationIcon status={v.status} />
            <span className="font-mono text-muted-foreground truncate">{v.validator}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ANSWER_PACKAGE_SCHEMA = {
  name: "answer_package",
  strict: true,
  schema: {
    type: "object",
    properties: {
      final_answers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
          },
          required: ["label", "value"],
          additionalProperties: false,
        },
      },
      teaching_aids: {
        type: "object",
        properties: {
          explanation: { type: "string" },
          journal_entries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                entry_date: { type: "string" },
                lines: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      account_name: { type: "string" },
                      debit: { type: ["number", "null"] },
                      credit: { type: ["number", "null"] },
                      memo: { type: "string" },
                      indentation_level: { type: "number" },
                    },
                    required: ["account_name", "debit", "credit", "memo", "indentation_level"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["entry_date", "lines"],
              additionalProperties: false,
            },
          },
        },
        required: ["explanation", "journal_entries"],
        additionalProperties: false,
      },
    },
    required: ["final_answers", "teaching_aids"],
    additionalProperties: false,
  },
};

export function AIComparisonPanel({ sourceProblemId, problemText, solutionText, latestPackage }: Props) {
  const qc = useQueryClient();
  const [openaiPkg, setOpenaiPkg] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);

  const testMutation = useMutation({
    mutationFn: async () => {
      const logger = new GenerationLogger({
        source_problem_id: sourceProblemId,
        provider: "openai",
        model: "gpt-4.1",
      });
      await logger.start();
      await logger.info("frontend", "CLICK_GENERATE", "OpenAI A/B test started", {
        source_problem_id: sourceProblemId,
        problem_text_length: problemText?.length ?? 0,
      });

      const userPrompt = buildJEUserPrompt({
        problemText: problemText || "",
        solutionText: solutionText || "",
      });

      await logger.info("frontend", "REQUEST_START", "Calling generate-ai-output");

      const { data, error } = await supabase.functions.invoke("generate-ai-output", {
        body: {
          provider: "openai",
          model: "gpt-4.1",
          temperature: 0.2,
          max_output_tokens: 3000,
          source_problem_id: sourceProblemId,
          run_id: logger.runId,
          messages: [
            { role: "system", content: JE_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format_json_schema: ANSWER_PACKAGE_SCHEMA,
        },
      });

      await logger.info("frontend", "REQUEST_END", "Edge function returned", {
        has_error: !!error,
        has_parsed: !!data?.parsed,
        generation_time_ms: data?.generation_time_ms,
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Return both data and logger for onSuccess
      return { data, logger };
    },
    onSuccess: async ({ data, logger }) => {
      setMetadata({ provider: data.provider, model: data.model, token_usage: data.token_usage, generation_time_ms: data.generation_time_ms });

      const parsed = data.parsed;
      if (!parsed) {
        await logger.error("frontend", "PARSE_FAILED", "AI returned invalid JSON — nothing saved");
        await logger.finalize("failed", { error_summary: "JSON parse failed" });
        toast.error("AI returned invalid JSON — nothing saved. Click Regenerate.");
        const nextVersion = (latestPackage?.version ?? 0) + 1;
        await logUnparseableOutput(sourceProblemId, nextVersion, data.raw, {
          provider: data.provider,
          model: data.model,
          parse_error: data.parse_error ?? "JSON parse failed",
        });
        return;
      }

      const nextVersion = (latestPackage?.version ?? 0) + 1;

      await logger.info("validator", "RUN_VALIDATORS_START", "Running normalize+validate+persist pipeline");

      const result = await normalizeValidatePersistAnswerPackage({
        source_problem_id: sourceProblemId,
        version: nextVersion,
        generator: "ai",
        answer_payload: parsed,
        extracted_inputs: latestPackage?.extracted_inputs ?? {},
        computed_values: latestPackage?.computed_values ?? {},
        output_type: latestPackage?.output_type ?? "mixed",
        provider: data.provider,
        model: data.model,
        token_usage: data.token_usage,
        generation_time_ms: data.generation_time_ms,
        log_event_type: "ai_generation_test",
      });

      await logger.info("validator", "RUN_VALIDATORS_END", `Pipeline result: ${result.status}`, {
        status: result.status,
        rejected: result.rejected,
        validation_results: result.validation_results.map(v => ({ name: v.validator, status: v.status, message: v.message })),
      });

      if (result.rejected) {
        await logger.finalize("failed", { error_summary: result.rejection_reason });
      } else {
        await logger.finalize("success", { variant_id: result.package?.id });
      }

      setOpenaiPkg(result.package);
      qc.invalidateQueries({ queryKey: ["answer-packages"] });
      toast.success(`OpenAI test complete — v${nextVersion} created (${result.status})`);
    },
    onError: async (e: Error) => toast.error(`OpenAI test failed: ${e.message}`),
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      if (!openaiPkg) return;
      if (hasFailures(openaiPkg.validation_results ?? [])) throw new Error("Cannot approve with validation failures");
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("answer_packages").update({
        status: "approved" as any,
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      } as any).eq("id", openaiPkg.id);
      await logActivity({
        actor_type: "user",
        entity_type: "source_problem",
        entity_id: sourceProblemId,
        event_type: "answer_package_approved",
        payload_json: { package_id: openaiPkg.id, version: openaiPkg.version, from_openai_test: true },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["answer-packages"] });
      toast.success("OpenAI version promoted to approved");
      setOpenaiPkg(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Side-by-side diff
  const showComparison = openaiPkg && latestPackage;
  const leftFlat = latestPackage ? flattenForDiff(latestPackage.answer_payload) : {};
  const rightFlat = openaiPkg ? flattenForDiff(openaiPkg.answer_payload) : {};
  const allKeys = showComparison ? [...new Set([...Object.keys(leftFlat), ...Object.keys(rightFlat)])].sort() : [];

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <Beaker className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold">AI Provider Testing</span>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={() => testMutation.mutate()}
        disabled={testMutation.isPending || !problemText}
      >
        {testMutation.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Testing…</> : <><Beaker className="h-3 w-3 mr-1" /> Test with OpenAI (gpt-4.1)</>}
      </Button>

      {metadata && (
        <div className="flex gap-2 flex-wrap text-[10px]">
          <Badge variant="outline" className="text-[9px]">{metadata.provider}/{metadata.model}</Badge>
          <Badge variant="outline" className="text-[9px]">{metadata.generation_time_ms}ms</Badge>
          {metadata.token_usage?.total_tokens && (
            <Badge variant="outline" className="text-[9px]">{metadata.token_usage.total_tokens} tokens</Badge>
          )}
        </div>
      )}

      {showComparison && (
        <>
          {/* Validation failure banner */}
          {hasFailures(openaiPkg.validation_results ?? []) && (
            <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2">
              <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> OpenAI version has validation failures — cannot auto-approve
              </p>
            </div>
          )}

          {/* Side by side cards */}
          <div className="flex gap-3">
            <PackageCard label={`Current v${latestPackage.version}`} pkg={latestPackage} badge={latestPackage.generator} />
            <PackageCard label={`OpenAI v${openaiPkg.version}`} pkg={openaiPkg} badge="openai/gpt-4.1" />
          </div>

          {/* Diff table */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Value Differences</p>
            <div className="rounded border border-border overflow-hidden text-[10px] max-h-48 overflow-y-auto">
              <div className="grid grid-cols-3 bg-muted/30 px-2 py-1 border-b border-border font-semibold text-muted-foreground">
                <span>Key</span>
                <span>Current</span>
                <span>OpenAI</span>
              </div>
              {allKeys.filter(k => leftFlat[k] !== rightFlat[k]).map((key) => (
                <div key={key} className="grid grid-cols-3 px-2 py-0.5 border-b border-border/50 bg-amber-500/5">
                  <span className="font-mono truncate">{key}</span>
                  <span className="truncate text-destructive">{leftFlat[key] ?? "—"}</span>
                  <span className="truncate text-green-400">{rightFlat[key] ?? "—"}</span>
                </div>
              ))}
              {allKeys.filter(k => leftFlat[k] !== rightFlat[k]).length === 0 && (
                <div className="px-2 py-2 text-muted-foreground text-center">No differences found</div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {!hasFailures(openaiPkg.validation_results ?? []) && (
              <Button size="sm" className="h-7 text-xs" onClick={() => promoteMutation.mutate()} disabled={promoteMutation.isPending}>
                <ThumbsUp className="h-3 w-3 mr-1" /> Promote This Version
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setOpenaiPkg(null); setMetadata(null); }}>
              <Trash2 className="h-3 w-3 mr-1" /> Dismiss
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
