import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RefreshCw, Lock, Unlock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { runValidation, hasFailures, type AnswerPackageData } from "@/lib/validation";
import { normalizeValidatePersistAnswerPackage, persistUnparseablePackage } from "@/lib/answerPackagePipeline";
import { JE_SYSTEM_PROMPT, buildJEUserPrompt } from "@/lib/jeSystemPrompt";

interface Props {
  sourceProblemId: string;
  latestPackage?: any;
  openRepairNotes?: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problemText?: string;
  solutionText?: string;
}

const OPENAI_MODELS = [
  { value: "gpt-4.1", label: "gpt-4.1 (accuracy)" },
  { value: "gpt-4o-mini", label: "gpt-4o-mini (cheap)" },
];

export function RegenerateDialog({ sourceProblemId, latestPackage, openRepairNotes, open, onOpenChange, problemText, solutionText }: Props) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<"lovable" | "openai">("lovable");
  const [model, setModel] = useState("gpt-4.1");
  const [temperature, setTemperature] = useState(0.2);
  const [lockProblemText, setLockProblemText] = useState(true);
  const [lockQuestionFormatting, setLockQuestionFormatting] = useState(true);
  const [lockAnswerChoices, setLockAnswerChoices] = useState(false);
  const [lockExplanations, setLockExplanations] = useState(false);

  const regenMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const repairNoteIds = openRepairNotes?.map((n) => n.id) ?? [];
      const lockFlags = {
        lock_problem_text: lockProblemText,
        lock_question_formatting: lockQuestionFormatting,
        lock_answer_choices: lockAnswerChoices,
        lock_explanations: lockExplanations,
      };

      // 1. Create generation job
      const { data: job, error: jobErr } = await supabase.from("generation_jobs").insert({
        source_problem_id: sourceProblemId,
        requested_by: user?.id ?? null,
        job_type: repairNoteIds.length > 0 ? "regenerate_with_repair_note" as any : "generate" as any,
        input_payload: {
          repair_note_ids: repairNoteIds,
          lock_flags: lockFlags,
          previous_package_id: latestPackage?.id ?? null,
          provider,
          model: provider === "openai" ? model : "google/gemini-2.5-flash",
        },
        status: "queued" as any,
      } as any).select("id").single();
      if (jobErr) throw jobErr;

      await logActivity({
        actor_type: "user",
        entity_type: "source_problem",
        entity_id: sourceProblemId,
        event_type: "REGEN_JOB_CREATED",
        payload_json: { job_id: job.id, provider, model: provider === "openai" ? model : "google/gemini-2.5-flash", lock_flags: lockFlags, repair_note_ids: repairNoteIds },
      });

      // 2. Mark job running
      await supabase.from("generation_jobs").update({ status: "running" as any } as any).eq("id", job.id);

      // 3. Call AI provider
      const repairNotesText = repairNoteIds.length > 0 && openRepairNotes
        ? openRepairNotes.map(n => `- ${n.what_was_wrong}: ${n.desired_fix}`).join("\n")
        : undefined;

      const userPrompt = buildJEUserPrompt({
        problemText: problemText || "",
        solutionText: solutionText || "",
        repairNotes: repairNotesText,
      });

      const { data: aiResult, error: aiErr } = await supabase.functions.invoke("generate-ai-output", {
        body: {
          provider,
          model: provider === "openai" ? model : "google/gemini-2.5-flash",
          temperature,
          max_output_tokens: 3000,
          source_problem_id: sourceProblemId,
          messages: [
            { role: "system", content: JE_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format_json_schema: provider === "openai" ? {
            name: "answer_package",
            strict: true,
            schema: {
              type: "object",
              properties: {
                final_answers: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"], additionalProperties: false } },
                teaching_aids: { type: "object", properties: { explanation: { type: "string" }, journal_entries: { type: "array", items: { type: "object", properties: { entry_date: { type: "string" }, lines: { type: "array", items: { type: "object", properties: { account_name: { type: "string" }, debit: { type: ["number", "null"] }, credit: { type: ["number", "null"] }, memo: { type: "string" }, indentation_level: { type: "number" } }, required: ["account_name", "debit", "credit", "memo", "indentation_level"], additionalProperties: false } } }, required: ["entry_date", "lines"], additionalProperties: false } } }, required: ["explanation", "journal_entries"], additionalProperties: false },
              },
              required: ["final_answers", "teaching_aids"],
              additionalProperties: false,
            },
          } : undefined,
        },
      });

      if (aiErr) throw aiErr;
      if (aiResult.error) throw new Error(aiResult.error);

      const parsed = aiResult.parsed;
      const nextVersion = (latestPackage?.version ?? 0) + 1;

      if (!parsed) {
        await persistUnparseablePackage(sourceProblemId, nextVersion, aiResult.raw, {
          extracted_inputs: latestPackage?.extracted_inputs ?? {},
          computed_values: latestPackage?.computed_values ?? {},
          output_type: latestPackage?.output_type ?? "mixed",
          provider,
          model: provider === "openai" ? model : "google/gemini-2.5-flash",
        });
        throw new Error("AI returned invalid JSON — saved as needs_review");
      }

      // Merge locked fields from previous version
      const newPayload = { ...parsed };
      const prevPayload = latestPackage?.answer_payload ?? {};
      if (lockAnswerChoices && prevPayload.final_answers) {
        newPayload.final_answers = prevPayload.final_answers;
      }
      if (lockExplanations && prevPayload.teaching_aids?.explanation) {
        newPayload.teaching_aids = { ...newPayload.teaching_aids, explanation: prevPayload.teaching_aids.explanation };
      }

      await normalizeValidatePersistAnswerPackage({
        source_problem_id: sourceProblemId,
        version: nextVersion,
        generator: "ai",
        answer_payload: newPayload,
        extracted_inputs: latestPackage?.extracted_inputs ?? {},
        computed_values: latestPackage?.computed_values ?? {},
        output_type: latestPackage?.output_type ?? "mixed",
        provider,
        model: provider === "openai" ? model : "google/gemini-2.5-flash",
        token_usage: aiResult.token_usage,
        generation_time_ms: aiResult.generation_time_ms,
        log_event_type: "ai_generation_test",
        log_extra_payload: { mode: "regen" },
      });

      // Mark repair notes resolved
      if (repairNoteIds.length > 0) {
        await supabase.from("repair_notes").update({
          status: "resolved" as any,
          resolved_at: new Date().toISOString(),
        } as any).in("id", repairNoteIds);
      }

      // Mark job done
      await supabase.from("generation_jobs").update({
        status: "done" as any,
        completed_at: new Date().toISOString(),
      } as any).eq("id", job.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["answer-packages"] });
      qc.invalidateQueries({ queryKey: ["repair-notes"] });
      qc.invalidateQueries({ queryKey: ["activity-log"] });
      onOpenChange(false);
      toast.success(`Regeneration complete (${provider}) — new version created`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const LockToggle = ({ label, locked, onChange }: { label: string; locked: boolean; onChange: (v: boolean) => void }) => (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        {locked ? <Lock className="h-3 w-3 text-muted-foreground" /> : <Unlock className="h-3 w-3 text-primary" />}
        <Label className="text-xs">{label}</Label>
      </div>
      <Switch checked={locked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Regenerate (This Problem Only)
          </DialogTitle>
          <DialogDescription>
            Creates a new answer package version. Locked fields are preserved from v{latestPackage?.version ?? "?"}.
            {openRepairNotes && openRepairNotes.length > 0 && (
              <span className="block mt-1 text-amber-400">{openRepairNotes.length} open repair note(s) will guide regeneration and auto-resolve.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Provider selection */}
        <div className="border border-border rounded-lg p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">AI Provider</p>
          <div className="flex gap-2">
            <Select value={provider} onValueChange={(v) => setProvider(v as any)}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">Lovable</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
            {provider === "openai" && (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-7 text-xs w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPENAI_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="border border-border rounded-lg p-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Lock Options</p>
          <LockToggle label="Problem Text" locked={lockProblemText} onChange={setLockProblemText} />
          <LockToggle label="Question Formatting" locked={lockQuestionFormatting} onChange={setLockQuestionFormatting} />
          <LockToggle label="Answer Choices" locked={lockAnswerChoices} onChange={setLockAnswerChoices} />
          <LockToggle label="Explanations" locked={lockExplanations} onChange={setLockExplanations} />
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={() => regenMutation.mutate()} disabled={regenMutation.isPending}>
            {regenMutation.isPending ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Regenerating…</>
            ) : (
              `Regenerate (${provider === "openai" ? `OpenAI/${model}` : "Lovable"})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
