import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Sparkles, Eye, Trash2, Loader2, ExternalLink, Check, X, ArrowLeft, ChevronDown, ChevronRight, AlertTriangle, ScanText, Pencil, RotateCw, ShieldAlert, Archive, Filter, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import { SourceProblemPreview } from "@/components/content-factory/SourceProblemPreview";
import { Progress } from "@/components/ui/progress";
import { JournalEntryTable } from "@/components/JournalEntryTable";
import { parseLegacyAnswerOnly, toTemplate } from "@/lib/journalEntryParser";
import { VariantReviewContent } from "@/components/content-factory/VariantReviewDrawer";
import { logActivity } from "@/lib/activityLogger";
import {
  normalizeCandidateJournalEntry,
  normalizeJournalEntryCompletedJson,
  buildJournalEntryTemplateFromCompleted,
  getJournalEntryCounts,
} from "@/lib/journalEntryCanonical";
import { detectAndSplitScenarios } from "@/lib/scenarioSegmentation";
import { GenerationLogger } from "@/lib/generationLogger";
import { detectRequiresJE } from "@/lib/legacyJENormalizer";
import { normalizeToParts, partsToLegacyFields } from "@/lib/variantParts";
import { useBuildRun } from "@/hooks/useBuildRun";

const REJECTION_REASONS = [
  "Too easy",
  "Too hard",
  "Off-topic",
  "Bad wording / unclear",
  "Incorrect accounting mechanics",
  "Too long",
  "Not aligned with exam style",
] as const;

/** Render worked-steps text with bold Step headers and spacing */
function FormatWorkedSteps({ text }: { text: string }) {
  if (!text) return <span className="text-foreground/50">—</span>;
  // Split on "Step N:" patterns, keeping the delimiter
  const parts = text.split(/(Step\s+\d+[^:\n]*:)/gi);
  return (
    <div className="text-sm text-foreground leading-relaxed space-y-3">
      {parts.map((part, i) => {
        if (/^Step\s+\d+/i.test(part)) {
          return <p key={i} className="font-bold text-base text-foreground mt-1 mb-0.5">{part}</p>;
        }
        if (!part.trim()) return null;
        return <p key={i} className="whitespace-pre-wrap">{part}</p>;
      })}
    </div>
  );
}

const DIFFICULTY_TOGGLES = [
  { id: "partial_period", label: "Partial Period / Stub Period" },
  { id: "missing_info", label: "Missing Information (requires inference)" },
  { id: "common_trap", label: "Common Trap (premium vs discount, debit vs credit reversal)" },
  { id: "multi_step_decoy", label: "Multi-Step with Decoy Step" },
  { id: "je_direction_trap", label: "Journal Entry Direction Trap (account known, debit/credit uncertain)" },
  { id: "numerical_decoys", label: "Numerical Decoys (misleading but irrelevant values)" },
] as const;

interface Props {
  chapterId: string;
  chapterNumber: number;
  courseId: string;
}

/* Legacy parseJournalEntry removed — now using shared JournalEntryTable component */

/** Normalize candidate JE into canonical persisted fields */
function normalizeCandidateJE(c: any): any {
  return normalizeCandidateJournalEntry(c);
}

function getCandidateJEPersistence(candidate: any) {
  const normalizedCandidate = normalizeCandidateJournalEntry(candidate);
  const completed = normalizedCandidate.journal_entry_completed_json;
  const template = normalizedCandidate.journal_entry_template_json;
  return {
    normalizedCandidate,
    completed,
    template,
    counts: getJournalEntryCounts(completed),
  };
}

type ChapterProblem = {
  id: string;
  course_id: string;
  chapter_id: string;
  problem_type: "exercise" | "problem" | "custom";
  source_label: string;
  title: string;
  problem_text: string;
  solution_text: string;
  journal_entry_text: string | null;
  difficulty_internal: "easy" | "medium" | "hard" | "tricky" | null;
  status: string;
  created_at: string;
  contains_no_journal_entries?: boolean;
  problem_screenshot_url?: string | null;
  solution_screenshot_url?: string | null;
  problem_screenshot_urls?: string[];
  solution_screenshot_urls?: string[];
  ocr_extracted_problem_text?: string;
  ocr_extracted_solution_text?: string;
  ocr_detected_label?: string;
  ocr_detected_lo?: string;
  ocr_detected_title?: string;
  ocr_detected_type?: string;
  ocr_confidence?: string;
  ocr_confidence_notes?: string;
  ocr_status?: string;
};

export function ProblemBankTab({ chapterId, chapterNumber, courseId }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { recomputeProgress } = useBuildRun();
  const [addOpen, setAddOpen] = useState(false);
  const [viewingProblem, setViewingProblem] = useState<ChapterProblem | null>(null);
  const [previewProblem, setPreviewProblem] = useState<ChapterProblem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Add form
  const [formType, setFormType] = useState<"exercise" | "problem" | "custom">("exercise");
  const [formLabel, setFormLabel] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formProblem, setFormProblem] = useState("");
  const [formSolution, setFormSolution] = useState("");
  const [formJE, setFormJE] = useState("");
  const [formNoJE, setFormNoJE] = useState(false);

  // Generate state
  const [afNotes, setAfNotes] = useState("");
  const [afRequiresJE, setAfRequiresJE] = useState(false);
  const [activeDiffToggles, setActiveDiffToggles] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [expandedVariantIdx, setExpandedVariantIdx] = useState<number | null>(null);
  const variantRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [generatedAssetId, setGeneratedAssetId] = useState<string | null>(null);
  const [expandedSolutions, setExpandedSolutions] = useState<Set<number>>(new Set());
  const [genProvider, setGenProvider] = useState<"lovable" | "openai">("lovable");
  const [genModel, setGenModel] = useState("gpt-4.1");
  const [lastGenError, setLastGenError] = useState<{ message: string; runId?: string; problemId?: string; provider?: string; model?: string } | null>(null);

  // Rejection feedback state
  const [rejectingIndex, setRejectingIndex] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  // OCR editing state (for manual corrections)
  const [ocrEditing, setOcrEditing] = useState(false);
  const [ocrEditProblem, setOcrEditProblem] = useState("");
  const [ocrEditSolution, setOcrEditSolution] = useState("");

  // Batch generate state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchForceRegen, setBatchForceRegen] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCompleted, setBatchCompleted] = useState(0);
  const [batchCurrentLabel, setBatchCurrentLabel] = useState("");
  const [batchErrors, setBatchErrors] = useState<string[]>([]);
  const [launchingBatch, setLaunchingBatch] = useState(false);

  // Review queue state
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewCandidates, setReviewCandidates] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [variantStatusFilter, setVariantStatusFilter] = useState<string>("active");
  const [showArchived, setShowArchived] = useState(false);

  // Fetch user's variant count preference
  const { data: variantCount } = useQuery({
    queryKey: ["variant-count-setting"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 3;
      const { data } = await supabase
        .from("variant_generation_settings")
        .select("variants_per_request")
        .eq("user_id", user.id)
        .maybeSingle();
      return data?.variants_per_request ?? 3;
    },
  });
  const vCount = variantCount ?? 3;

  const { data: problems, isLoading } = useQuery({
    queryKey: ["chapter-problems", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_problems")
        .select("*")
        .eq("chapter_id", chapterId);
      if (error) throw error;
      return (data as ChapterProblem[]).sort((a, b) =>
        (a.source_label || "").localeCompare(b.source_label || "", undefined, { numeric: true, sensitivity: "base" })
      );
    },
  });

  // Fetch topics and rules for auto-assignment
  const { data: chapterTopics } = useQuery({
    queryKey: ["chapter-topics", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_topics")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: course } = useQuery({
    queryKey: ["course-for-rules", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("code").eq("id", courseId).single();
      if (error) throw error;
      return data;
    },
  });

  // je_only_mode removed — universal problem type detection is now handled by the backend

  const { data: topicRules } = useQuery({
    queryKey: ["topic-rules", course?.code, chapterNumber],
    queryFn: async () => {
      if (!course?.code) return [];
      const { data, error } = await supabase
        .from("topic_rules")
        .select("*")
        .eq("course_short", course.code)
        .eq("chapter_number", chapterNumber)
        .order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!course?.code,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formLabel.trim()) throw new Error("Source label is required");
      const { data: inserted, error } = await supabase.from("chapter_problems").insert({
        course_id: courseId,
        chapter_id: chapterId,
        problem_type: formType,
        source_label: formLabel.trim(),
        title: formTitle.trim(),
        problem_text: formProblem,
        solution_text: formSolution,
        journal_entry_text: formJE || null,
        contains_no_journal_entries: formNoJE,
        status: "imported",
      }).select("id, source_label").single();
      if (error) throw error;

      // Auto-create 4 default LW items with topic assignment
      const label = formLabel.trim();
      const lwItemDefs = [
        { item_key: `${label}_CX1`, item_label: "Calc X" },
        { item_key: `${label}_CY1`, item_label: "Calc Y" },
        { item_key: `${label}_JE1`, item_label: "JE/Entry" },
        { item_key: `${label}_C1`, item_label: "Concept" },
      ];

      const { assignTopicByRules } = await import("@/lib/topicAssignment");
      const activeTopics = (chapterTopics ?? []).filter(t => t.is_active);
      const rules = (topicRules ?? []) as any[];
      const context = {
        problem_text: formProblem,
        problem_title: formTitle.trim(),
        lw_question_text: "",
      };

      const inserts = lwItemDefs.map(lw => {
        const { topicId, usedFallback } = assignTopicByRules(rules, activeTopics, context, lw.item_label);
        return {
          source_problem_id: inserted.id,
          chapter_id: chapterId,
          course_id: courseId,
          item_key: lw.item_key,
          item_label: lw.item_label,
          topic_id: topicId,
          needs_topic_review: usedFallback,
        };
      });

      await supabase.from("lw_items").insert(inserts);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      qc.invalidateQueries({ queryKey: ["lw-items", chapterId] });
      toast.success("Source problem added with 4 LW items (topics auto-assigned)");
      resetForm();
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapter_problems").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      setDeleteId(null);
      toast.success("Problem deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateMutation = useMutation({
    mutationFn: async ({
      problem,
      provider,
      model,
    }: {
      problem: ChapterProblem;
      provider?: "lovable" | "openai";
      model?: string;
    }) => {
      const selectedProvider = provider ?? genProvider;
      const selectedModel = selectedProvider === "openai" ? (model ?? genModel) : undefined;
      setLastGenError(null);

      // Universal mode — no JE-only gating, backend auto-detects problem type

      const logger = new GenerationLogger({
        course_id: problem.course_id,
        chapter_id: problem.chapter_id,
        source_problem_id: problem.id,
        provider: selectedProvider,
        model: selectedModel,
      });

      await logger.start();
      await logger.info("frontend", "CLICK_GENERATE", `Generate variants for ${problem.source_label || problem.id}`, {
        course_id: problem.course_id,
        chapter_id: problem.chapter_id,
        source_problem_id: problem.id,
        ui_provider_selected: selectedProvider,
        ui_settings: {
          variant_count: vCount,
          difficulty_toggles: activeDiffToggles,
          requires_je_forced: afRequiresJE,
          notes_present: !!afNotes?.trim(),
        },
      });

      try {
        // Use OCR-extracted text as primary grounding input when available
        const useProblemText = problem.ocr_extracted_problem_text || problem.problem_text;
        const useSolutionText = problem.ocr_extracted_solution_text || problem.solution_text;
        const useLabel = problem.ocr_detected_label || problem.source_label;
        const useTitle = problem.ocr_detected_title || problem.title;

        // ── Scenario Segmentation ──
        const scenarioResult = detectAndSplitScenarios(useProblemText);
        const scenarioBlocks = scenarioResult.is_multi_scenario ? scenarioResult.scenario_blocks : undefined;

        const requestStart = Date.now();
        await logger.info("frontend", "REQUEST_START", "Calling convert-to-asset edge function", {
          problem_text_length: useProblemText?.length ?? 0,
          solution_text_length: useSolutionText?.length ?? 0,
          has_scenarios: !!scenarioBlocks?.length,
        });

        // 60-second timeout for edge function
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        let data: any;
        let error: any;
        try {
          const result = await supabase.functions.invoke("convert-to-asset", {
            body: {
              mode: "candidates",
              problemId: problem.id,
              courseId: problem.course_id,
              chapterId: problem.chapter_id,
              sourceLabel: useLabel,
              title: useTitle,
              problemText: useProblemText,
              solutionText: useSolutionText,
              journalEntryText: problem.journal_entry_text,
              notes: afNotes,
              provider: selectedProvider,
              model: selectedModel,
              scenarioBlocks,
              difficultyToggles: activeDiffToggles.length > 0
                ? activeDiffToggles.map(id => DIFFICULTY_TOGGLES.find(t => t.id === id)?.label).filter(Boolean)
                : undefined,
              run_id: logger.runId,
              course_id: problem.course_id,
              chapter_id: problem.chapter_id,
              source_problem_id: problem.id,
              ui_provider_selected: selectedProvider,
              ui_settings: {
                variant_count: vCount,
                difficulty_toggles: activeDiffToggles,
                notes_present: !!afNotes?.trim(),
              },
            },
          });
          data = result.data;
          error = result.error;
        } catch (abortErr: any) {
          clearTimeout(timeoutId);
          await logger.error("frontend", "REQUEST_TIMEOUT", "Generation timed out after 60s");
          await logger.finalize("failed", { error_summary: "Request timed out" });
          const err = new Error("Generation timed out. Please try again.");
          setLastGenError({ message: err.message, runId: logger.runId ?? undefined, problemId: problem.id, provider: selectedProvider, model: selectedModel });
          throw err;
        }
        clearTimeout(timeoutId);

        await logger.info("frontend", "REQUEST_END", "Edge function returned", {
          duration_ms: Date.now() - requestStart,
          has_error: !!error,
          has_data_error: !!data?.error,
          has_ok_false: data?.ok === false,
          candidate_count: data?.candidates?.length ?? 0,
        });

        // Handle all error shapes
        if (error) {
          setLastGenError({ message: typeof error === "string" ? error : error?.message || "Edge function error", runId: logger.runId ?? undefined, problemId: problem.id, provider: selectedProvider, model: selectedModel });
          throw typeof error === "string" ? new Error(error) : error;
        }
        if (data?.ok === false) {
          const msg = data.message || data.error_code || "AI generation failed";
          setLastGenError({ message: msg, runId: logger.runId ?? undefined, problemId: problem.id, provider: selectedProvider, model: selectedModel });
          throw new Error(msg);
        }
        if (data?.error) {
          setLastGenError({ message: data.error, runId: logger.runId ?? undefined, problemId: problem.id, provider: selectedProvider, model: selectedModel });
          throw new Error(data.error);
        }
        // Validate expected candidates array
        if (!data?.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
          const msg = "AI returned empty or missing candidates array. Try again or switch providers.";
          setLastGenError({ message: msg, runId: logger.runId ?? undefined, problemId: problem.id, provider: selectedProvider, model: selectedModel });
          await logger.error("frontend", "EMPTY_CANDIDATES", msg);
          await logger.finalize("failed", { error_summary: msg });
          throw new Error(msg);
        }

        return { data, logger, selectedProvider, selectedModel, problem };
      } catch (err: any) {
        // Always log REQUEST_END on failure
        await logger.info("frontend", "REQUEST_END", "Edge function failed", {
          error: err?.message,
        }).catch(() => {});
        await logger.error("frontend", "GENERATION_ERROR", err?.message || "Variant generation failed", {
          stack: err?.stack?.slice(0, 500),
        });
        await logger.finalize("failed", { error_summary: err?.message });
        // Ensure error state is set (may already be set above)
        if (!lastGenError) {
          setLastGenError({ message: err?.message || "Variant generation failed", problemId: problem.id, provider: selectedProvider, model: selectedModel });
        }
        throw err;
      }
    },
    onSuccess: async ({ data, logger, selectedProvider, selectedModel, problem }) => {
      try {
        const newCandidates = (data.candidates || []).map(normalizeCandidateJE);

        await logger.info("db", "SAVE_VARIANT_START", `Persisting ${newCandidates.length} variants`, {
          candidate_count: newCandidates.length,
        });

        setCandidates((prev) => [...prev, ...newCandidates]);

        let firstVariantId: string | null = null;
        const allVariantIds: string[] = [];

        for (let ci = 0; ci < newCandidates.length; ci++) {
          const c = newCandidates[ci];
          const { normalizedCandidate, completed, template, counts } = getCandidateJEPersistence(c);
          const isNonJE = c._generation_mode === "text_only" || c._generation_mode === "NON_JE" || !!c.answer_parts;
          
          // Use parts directly from AI output if available, otherwise normalize from legacy fields
          let parts: any[] | null = null;
          if (Array.isArray(c.parts) && c.parts.length > 0) {
            // AI returned parts directly — use as-is
            parts = c.parts;
          } else {
            // Fallback: build parts from legacy fields
            const candidateForParts = {
              ...normalizedCandidate,
              journal_entry_completed_json: isNonJE ? null : completed,
              answer_parts_json: isNonJE && c.answer_parts ? c.answer_parts : null,
            };
            const normalized = normalizeToParts(candidateForParts);
            parts = normalized.length > 0 ? normalized : null;
          }
          
          const variantPayload: Record<string, any> = {
            base_problem_id: problem.id,
            variant_label: `Variant ${String.fromCharCode(65 + ci)}`,
            variant_problem_text: normalizedCandidate.survive_problem_text || "",
            variant_solution_text: normalizedCandidate.survive_solution_text || "",
            candidate_data: normalizedCandidate,
            journal_entry_completed_json: isNonJE ? null : completed,
            journal_entry_template_json: isNonJE ? null : template,
            ...(isNonJE && c.answer_parts ? { answer_parts_json: c.answer_parts } : {}),
            parts_json: parts,
          };

          const { data: insertedVariant, error: insertVariantError } = await supabase
            .from("problem_variants")
            .insert(variantPayload as any)
            .select("id")
            .single();

          if (insertVariantError) throw insertVariantError;
          const vid = (insertedVariant as any)?.id;
          if (vid) {
            allVariantIds.push(vid);
            if (!firstVariantId) firstVariantId = vid;
          }

          await logActivity({
            actor_type: "system",
            entity_type: "source_problem",
            entity_id: problem.id,
            event_type: "variant_je_persisted",
            severity: "info",
            message: completed ? "journal_entry_completed_json persisted" : "journal_entry_completed_json missing",
            payload_json: {
              variant_id: vid,
              persisted: !!completed,
              ...counts,
            },
          });
        }

        await supabase
          .from("chapter_problems")
          .update({ status: "generated", pipeline_status: "generated" } as any)
          .eq("id", problem.id);

        await logger.info("db", "SAVE_VARIANT_END", `${newCandidates.length} variants saved`, {
          base_problem_id: problem.id,
          provider: selectedProvider,
          model: selectedModel,
          first_variant_id: firstVariantId,
          variant_ids: allVariantIds,
        });
        await logger.finalize("success", { variant_id: firstVariantId || undefined });

        qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
        qc.invalidateQueries({ queryKey: ["chapter-activity-log", chapterId] });
        qc.invalidateQueries({ queryKey: ["generation-runs", chapterId] });

        setViewingProblem((prev) => (prev?.id === problem.id ? { ...prev, status: "generated" } : prev));

        const constraintsUsed = data.constraints_count || 0;
        const scenarioLabels = data.scenario_labels || [];
        const fixMsg = constraintsUsed > 0 ? ` (used ${constraintsUsed} recent constraints from edits)` : "";
        const scenarioMsg = scenarioLabels.length > 0 ? ` [${scenarioLabels.length} scenarios detected]` : "";
        toast.success(`Generated ${newCandidates.length} variants${fixMsg}${scenarioMsg}`);

        await logActivity({
          actor_type: "ai",
          entity_type: "source_problem",
          entity_id: problem.id,
          event_type: "variant_generation",
          severity: "info",
          payload_json: {
            provider: selectedProvider,
            model: selectedModel,
            variant_count: newCandidates.length,
            constraints_used: constraintsUsed,
            difficulty_toggles: activeDiffToggles,
            requires_je: afRequiresJE,
            generation_run_id: logger.runId,
          },
        });
      } catch (err: any) {
        await logger.error("db", "SAVE_VARIANT_ERROR", err?.message || "Failed to persist generated variants", {
          stack: err?.stack?.slice(0, 500),
        });
        await logger.finalize("failed", { error_summary: err?.message });
        qc.invalidateQueries({ queryKey: ["generation-runs", chapterId] });
        toast.error(err?.message || "Failed to save generated variants");
      }
    },
    onError: async (e: Error) => {
      qc.invalidateQueries({ queryKey: ["generation-runs", chapterId] });
      toast.error(e.message);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ candidate, problem }: { candidate: any; problem: ChapterProblem }) => {
      // Canonical JE source of truth for persistence
      let jeCompleted = normalizeJournalEntryCompletedJson(
        candidate.journal_entry_completed_json || candidate.je_structured || null
      );
      let jeTemplate = buildJournalEntryTemplateFromCompleted(jeCompleted);

      if (!jeCompleted && candidate.answer_only) {
        const parsed = parseLegacyAnswerOnly(candidate.answer_only);
        if (parsed.length > 0) {
          jeCompleted = parsed as any;
          jeTemplate = toTemplate(parsed) as any;
        }
      }

      const enrichedCandidate = {
        ...candidate,
        journal_entry_completed_json: jeCompleted,
        journal_entry_template_json: jeTemplate,
      };

      // Build parts from enriched candidate
      const parts = normalizeToParts(enrichedCandidate);

      const enrichedWithParts = {
        ...enrichedCandidate,
        parts_json: parts.length > 0 ? parts : null,
      };

      const { data, error } = await supabase.functions.invoke("convert-to-asset", {
        body: {
          mode: "save",
          problemId: problem.id,
          courseId: problem.course_id,
          chapterId: problem.chapter_id,
          candidate: enrichedWithParts,
          requiresJournalEntry: afRequiresJE,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      qc.invalidateQueries({ queryKey: ["teaching-assets"] });
      qc.invalidateQueries({ queryKey: ["chapter-activity-log", chapterId] });
      qc.invalidateQueries({ queryKey: ["pipeline-problems"] });
      qc.invalidateQueries({ queryKey: ["pipeline-strip-problems"] });
      setGeneratedAssetId(data.asset?.id ?? null);
      setSavingIndex(null);
      if (viewingProblem) {
        setViewingProblem({ ...viewingProblem, status: "approved" });
        await logActivity({
          actor_type: "user",
          entity_type: "source_problem",
          entity_id: viewingProblem.id,
          event_type: "variant_approved",
          severity: "info",
          payload_json: {
            asset_id: data.asset?.id,
            asset_name: data.asset?.asset_name,
          },
        });
      }
      toast.success("Variant approved & saved to Assets Library!");
      // Recompute build run progress
      recomputeProgress();
    },
    onError: (e: Error) => { setSavingIndex(null); toast.error(e.message); },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ candidate, problem, reason, note }: { candidate: any; problem: ChapterProblem; reason: string; note: string }) => {
      const { error } = await supabase.from("variant_feedback").insert({
        source_problem_id: problem.id,
        variant_data: candidate,
        rejection_reason: reason,
        free_text_note: note || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (rejectingIndex !== null) {
        setCandidates((prev) => prev.filter((_, i) => i !== rejectingIndex));
      }
      if (viewingProblem) {
        await logActivity({
          actor_type: "user",
          entity_type: "source_problem",
          entity_id: viewingProblem.id,
          event_type: "variant_rejected",
          severity: "warn",
          payload_json: { reason: rejectReason, note: rejectNote },
        });
      }
      setRejectingIndex(null);
      setRejectReason("");
      setRejectNote("");
      toast.success("Variant rejected — feedback saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setFormLabel(""); setFormTitle(""); setFormProblem(""); setFormSolution(""); setFormJE(""); setFormNoJE(false);
  };

  // Batch generate function
  const startBatchGenerate = async () => {
    if (!problems?.length) return;
    let eligible = problems.filter(p => p.status === "ready" && (p as any).dependency_type !== "dependent_problem");
    if (batchForceRegen) {
      eligible = problems.filter(p => (p.status === "ready" || p.status === "generated") && (p as any).dependency_type !== "dependent_problem");
    }

    // Universal mode — all problem types eligible for batch generation (except dependent problems)

    if (eligible.length === 0) {
      toast.info("No eligible problems to generate variants for.");
      return;
    }

    setBatchRunning(true);
    setBatchTotal(eligible.length);
    setBatchCompleted(0);
    setBatchErrors([]);

    for (let i = 0; i < eligible.length; i++) {
      const problem = eligible[i];
      setBatchCurrentLabel(problem.ocr_detected_label || problem.source_label || `Problem ${i + 1}`);

      const logger = new GenerationLogger({
        course_id: problem.course_id,
        chapter_id: problem.chapter_id,
        source_problem_id: problem.id,
        provider: "lovable",
        model: "google/gemini-3-flash-preview",
      });

      try {
        await logger.start();
        await logger.info("frontend", "CLICK_GENERATE", `Batch generate variant for ${problem.source_label || problem.id}`, {
          batch_index: i,
          batch_total: eligible.length,
          problem_id: problem.id,
          source_label: problem.source_label,
          has_je: !!problem.journal_entry_text,
        });

        const useProblemText = problem.ocr_extracted_problem_text || problem.problem_text;
        const useSolutionText = problem.ocr_extracted_solution_text || problem.solution_text;
        const useLabel = problem.ocr_detected_label || problem.source_label;
        const useTitle = problem.ocr_detected_title || problem.title;

        await logger.info("frontend", "REQUEST_START", "Calling convert-to-asset edge function", {
          problem_text_length: useProblemText?.length ?? 0,
          solution_text_length: useSolutionText?.length ?? 0,
        });

        const { data, error } = await supabase.functions.invoke("convert-to-asset", {
          body: {
            mode: "candidates",
            problemId: problem.id,
            courseId: problem.course_id,
            chapterId: problem.chapter_id,
            sourceLabel: useLabel,
            title: useTitle,
            problemText: useProblemText,
            solutionText: useSolutionText,
            journalEntryText: problem.journal_entry_text,
            notes: "",
            difficultyToggles: undefined,
            run_id: logger.runId,
            course_id: problem.course_id,
            chapter_id: problem.chapter_id,
            source_problem_id: problem.id,
            ui_provider_selected: "lovable",
            ui_settings: {
              variant_count: 1,
              difficulty_toggles: [],
            },
          },
        });

        await logger.info("frontend", "REQUEST_END", "Edge function returned", {
          has_error: !!error,
          has_data_error: !!data?.error,
          candidate_count: data?.candidates?.length ?? 0,
        });

        if (error) throw error;
        if (data?.ok === false) throw new Error(data.message || "AI generation failed");
        if (data?.error) throw new Error(data.error);

        const candidates = data.candidates || [];

        await logger.info("db", "SAVE_VARIANT_START", `Saving ${candidates.length} variants`, {
          candidate_count: candidates.length,
        });

        let firstVariantId: string | null = null;
        const allVariantIds: string[] = [];

        for (let ci = 0; ci < candidates.length; ci++) {
          const c = candidates[ci];
          const jeValid = c._je_valid !== false;
          const variantPayload: Record<string, any> = {
            base_problem_id: problem.id,
            variant_label: `Variant ${String.fromCharCode(65 + ci)}`,
            variant_problem_text: c.survive_problem_text || "",
            variant_solution_text: c.survive_solution_text || "",
            candidate_data: c,
          };
          const jeSource = c.je_structured || c.journal_entry_completed_json;
          if (jeSource && jeValid) {
            variantPayload.journal_entry_completed_json = jeSource;
            variantPayload.journal_entry_template_json = buildJournalEntryTemplateFromCompleted(jeSource);
          }
          const { data: insertedVariant, error: insertVariantError } = await supabase
            .from("problem_variants")
            .insert(variantPayload as any)
            .select("id")
            .single();

          if (insertVariantError) throw insertVariantError;
          const vid = (insertedVariant as any)?.id;
          if (vid) {
            allVariantIds.push(vid);
            if (!firstVariantId) firstVariantId = vid;
          }
        }

        await supabase.from("chapter_problems").update({ status: "generated", pipeline_status: "generated" } as any).eq("id", problem.id);

        await logger.info("db", "SAVE_VARIANT_END", `${candidates.length} variants saved`, { first_variant_id: firstVariantId, variant_ids: allVariantIds });
        await logger.finalize("success", { variant_id: firstVariantId || undefined });
      } catch (err: any) {
        const msg = `${problem.source_label}: ${err?.message || "Unknown error"}`;
        setBatchErrors(prev => [...prev, msg]);
        await logger.error("frontend", "GENERATION_ERROR", msg, { stack: err?.stack?.slice(0, 500) });
        await logger.finalize("failed", { error_summary: err?.message });
      }

      setBatchCompleted(i + 1);
    }

    setBatchRunning(false);
    setBatchCurrentLabel("");
    qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
    toast.success(`Batch generation complete: ${eligible.length} problems processed`);
  };

  // Re-run OCR mutation (only for failed/re-extract cases)
  const ocrMutation = useMutation({
    mutationFn: async (problem: ChapterProblem) => {
      const pUrls = problem.problem_screenshot_urls?.length
        ? problem.problem_screenshot_urls
        : problem.problem_screenshot_url ? [problem.problem_screenshot_url] : [];
      const sUrls = problem.solution_screenshot_urls?.length
        ? problem.solution_screenshot_urls
        : problem.solution_screenshot_url ? [problem.solution_screenshot_url] : [];

      if (pUrls.length === 0 && sUrls.length === 0) {
        throw new Error("No screenshots available for OCR extraction.");
      }

      const { data, error } = await supabase.functions.invoke("extract-ocr", {
        body: { problemId: problem.id, problemImageUrls: pUrls, solutionImageUrls: sUrls },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.ocr;
    },
    onSuccess: (ocr) => {
      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
      if (viewingProblem) {
        setViewingProblem({
          ...viewingProblem,
          ocr_status: "success",
          ocr_confidence: ocr.confidence,
          ocr_extracted_problem_text: ocr.extracted_problem_text,
          ocr_extracted_solution_text: ocr.extracted_solution_text,
          ocr_detected_label: ocr.detected_label,
          ocr_detected_lo: ocr.detected_lo,
          ocr_detected_title: ocr.detected_title,
          ocr_detected_type: ocr.detected_type,
          ocr_confidence_notes: ocr.confidence_notes,
        });
      }
      setOcrEditing(false);
      toast.success(`OCR extracted (${ocr.confidence} confidence)`);
    },
    onError: (e: Error) => {
      toast.error(`OCR failed: ${e.message}`);
    },
  });

  const openDetail = (p: ChapterProblem) => {
    setViewingProblem(p);
    setAfNotes("");
    setAfRequiresJE(!!p.journal_entry_text);
    setActiveDiffToggles([]);
    setCandidates([]);
    setSavingIndex(null);
    setGeneratedAssetId(null);
    setExpandedSolutions(new Set());
    setOcrEditing(false);
  };

  // Review queue helpers
  const generatedProblems = problems?.filter(p => p.status === "generated") ?? [];

  const startReviewQueue = async (startIdx = 0) => {
    if (generatedProblems.length === 0) {
      toast.info("No generated problems to review.");
      return;
    }
    setReviewMode(true);
    setReviewIndex(startIdx);
    await loadReviewCandidates(generatedProblems[startIdx].id);
  };

  const loadReviewCandidates = async (problemId: string) => {
    setReviewLoading(true);
    setReviewCandidates([]);
    const { data, error } = await supabase
      .from("problem_variants")
      .select("*")
      .eq("base_problem_id", problemId)
      .order("created_at", { ascending: true });
    if (!error && data) {
      setReviewCandidates(data.map((v: any) => {
        const cd = v.candidate_data || {};
        const jeCompleted = v.journal_entry_completed_json || cd.je_structured || cd.journal_entry_completed_json || null;
        const jeTemplate = v.journal_entry_template_json || cd.journal_entry_template_json || (jeCompleted ? buildJournalEntryTemplateFromCompleted(jeCompleted) : null);
        return {
          ...cd,
          _variantId: v.id,
          _variantStatus: v.variant_status || "draft",
          survive_problem_text: cd.survive_problem_text || v.variant_problem_text,
          survive_solution_text: cd.survive_solution_text || v.variant_solution_text,
          journal_entry_completed_json: jeCompleted,
          journal_entry_template_json: jeTemplate,
        };
      }));
    }
    setReviewLoading(false);
  };

  const navigateReview = async (direction: "next" | "prev") => {
    const newIdx = direction === "next" ? reviewIndex + 1 : reviewIndex - 1;
    if (newIdx < 0 || newIdx >= generatedProblems.length) return;
    setReviewIndex(newIdx);
    setCandidates([]);
    setSavingIndex(null);
    setGeneratedAssetId(null);
    await loadReviewCandidates(generatedProblems[newIdx].id);
  };

  const exitReview = () => {
    setReviewMode(false);
    setReviewCandidates([]);
    setCandidates([]);
    qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
  };

  const toggleDifficulty = (id: string) => {
    setActiveDiffToggles(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSolutionExpand = (idx: number) => {
    setExpandedSolutions(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const statusStyle = (status: string) => ({
    imported: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    raw: "bg-muted text-muted-foreground",
    ready: "bg-green-500/20 text-green-400 border-green-500/30",
    tagged: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    generated: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    approved: "bg-green-500/20 text-green-400 border-green-500/30",
    converted: "bg-green-500/20 text-green-400 border-green-500/30",
  }[status] ?? "bg-muted text-muted-foreground");

  const statusLabel = (status: string) => ({
    imported: "SOURCE", raw: "SOURCE", ready: "READY", tagged: "TAGGED", generated: "GENERATED", approved: "APPROVED", converted: "APPROVED",
  }[status] ?? status.toUpperCase());

  // ─── Review Queue Mode ───
  if (reviewMode && generatedProblems.length > 0) {
    const rp = generatedProblems[reviewIndex];
    if (!rp) { setReviewMode(false); }
    else {
      const allCandidates = reviewCandidates;
      return (
        <div className="space-y-5">
          {/* Nav Bar */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={exitReview} className="text-foreground/70 hover:text-foreground">
              <ArrowLeft className="h-3 w-3 mr-1" /> Exit Review
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/70 font-medium">
                {reviewIndex + 1} / {generatedProblems.length}
              </span>
              <Button size="sm" variant="outline" disabled={reviewIndex === 0} onClick={() => navigateReview("prev")} className="h-7 px-2">
                <ChevronRight className="h-3 w-3 rotate-180" />
              </Button>
              <Button size="sm" variant="outline" disabled={reviewIndex >= generatedProblems.length - 1} onClick={() => navigateReview("next")} className="h-7 px-2">
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Problem Header */}
          <div className="rounded-lg border border-border bg-background/95 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-foreground/70">{rp.ocr_detected_label || rp.source_label}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{rp.problem_type}</Badge>
              <Badge variant="outline" className={`text-[10px] ${statusStyle(rp.status)}`}>{statusLabel(rp.status)}</Badge>
            </div>
            <h2 className="text-lg font-bold text-foreground">{rp.ocr_detected_title || rp.title || rp.source_label}</h2>
            <p className="text-xs text-foreground/70 mt-1 line-clamp-2">{rp.ocr_extracted_problem_text || rp.problem_text || "No problem text"}</p>
          </div>

          {/* Source Reference Toggle */}
          <Collapsible className="rounded-lg border border-border bg-background/95 overflow-hidden">
            <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Source Reference</span>
              </div>
              <ChevronDown className="h-4 w-4 text-foreground/50 transition-transform [[data-state=open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-4">
                {/* Screenshots side by side */}
                {(rp.problem_screenshot_urls?.length > 0 || rp.solution_screenshot_urls?.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rp.problem_screenshot_urls?.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-foreground/60 mb-1.5">Problem Screenshots</p>
                        <div className="space-y-2">
                          {rp.problem_screenshot_urls.map((url: string, i: number) => (
                            <img key={i} src={url} alt={`Problem screenshot ${i + 1}`} className="w-full rounded-md border border-border bg-white" />
                          ))}
                        </div>
                      </div>
                    )}
                    {rp.solution_screenshot_urls?.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-foreground/60 mb-1.5">Solution Screenshots</p>
                        <div className="space-y-2">
                          {rp.solution_screenshot_urls.map((url: string, i: number) => (
                            <img key={i} src={url} alt={`Solution screenshot ${i + 1}`} className="w-full rounded-md border border-border bg-white" />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* OCR Extracted Text */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-foreground/60 mb-1.5">OCR — Problem Text</p>
                    <div className="rounded-md border border-border bg-muted/20 p-3 max-h-64 overflow-y-auto">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{rp.ocr_extracted_problem_text || rp.problem_text || "—"}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-foreground/60 mb-1.5">OCR — Solution Text</p>
                    <div className="rounded-md border border-border bg-muted/20 p-3 max-h-64 overflow-y-auto">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{rp.ocr_extracted_solution_text || rp.solution_text || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Variants to Review */}
          {reviewLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-foreground font-medium">
              <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading variants…
            </div>
          ) : allCandidates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/95 p-6 text-center space-y-3">
              <p className="text-sm text-foreground font-medium">No saved variants found for this problem.</p>
              <p className="text-xs text-foreground/70">This problem was generated before variants were saved to the database. Click below to re-generate and save for review.</p>
              <Button size="sm" onClick={async () => {
                setReviewLoading(true);
                const logger = new GenerationLogger({
                  course_id: rp.course_id,
                  chapter_id: rp.chapter_id,
                  source_problem_id: rp.id,
                  provider: "lovable",
                  model: "google/gemini-3-flash-preview",
                });

                try {
                  await logger.start();
                  await logger.info("frontend", "CLICK_GENERATE", `Generate & Review for ${rp.source_label || rp.id}`, {
                    course_id: rp.course_id,
                    chapter_id: rp.chapter_id,
                    source_problem_id: rp.id,
                    ui_provider_selected: "lovable",
                    ui_settings: {
                      variant_count: 1,
                      requires_je_forced: !!rp.journal_entry_text,
                    },
                  });

                  const useProblemText = rp.ocr_extracted_problem_text || rp.problem_text;
                  const useSolutionText = rp.ocr_extracted_solution_text || rp.solution_text;
                  const useLabel = rp.ocr_detected_label || rp.source_label;
                  const useTitle = rp.ocr_detected_title || rp.title;

                  await logger.info("frontend", "REQUEST_START", "Calling convert-to-asset edge function", {
                    problem_text_length: useProblemText?.length ?? 0,
                    solution_text_length: useSolutionText?.length ?? 0,
                  });

                  const { data, error } = await supabase.functions.invoke("convert-to-asset", {
                    body: {
                      mode: "candidates",
                      problemId: rp.id,
                      courseId: rp.course_id,
                      chapterId: rp.chapter_id,
                      sourceLabel: useLabel,
                      title: useTitle,
                      problemText: useProblemText,
                      solutionText: useSolutionText,
                      journalEntryText: rp.journal_entry_text,
                      notes: "",
                      run_id: logger.runId,
                      course_id: rp.course_id,
                      chapter_id: rp.chapter_id,
                      source_problem_id: rp.id,
                      ui_provider_selected: "lovable",
                      ui_settings: {
                        variant_count: 1,
                        difficulty_toggles: [],
                      },
                    },
                  });

                  await logger.info("frontend", "REQUEST_END", "Edge function returned", {
                    has_error: !!error,
                    has_data_error: !!data?.error,
                    candidate_count: data?.candidates?.length ?? 0,
                  });

                  if (error) throw error;
                  if (data?.ok === false) throw new Error(data.message || "AI generation failed");
                  if (data?.error) throw new Error(data.error);

                  const candidates = data.candidates || [];
                  await logger.info("db", "SAVE_VARIANT_START", `Saving ${candidates.length} variants`, {
                    candidate_count: candidates.length,
                  });

                  let firstVariantId: string | null = null;
                  const allVariantIds: string[] = [];
                  for (let ci = 0; ci < candidates.length; ci++) {
                    const c = candidates[ci];
                    const jeValid = c._je_valid !== false;
                    const variantPayload: Record<string, any> = {
                      base_problem_id: rp.id,
                      variant_label: `Variant ${String.fromCharCode(65 + ci)}`,
                      variant_problem_text: c.survive_problem_text || "",
                      variant_solution_text: c.survive_solution_text || "",
                      candidate_data: c,
                    };
                    if (c.je_structured && jeValid) {
                      variantPayload.journal_entry_completed_json = c.je_structured;
                    }
                    const { data: insertedVariant, error: insertVariantError } = await supabase
                      .from("problem_variants")
                      .insert(variantPayload as any)
                      .select("id")
                      .single();

                    if (insertVariantError) throw insertVariantError;
                    const vid = (insertedVariant as any)?.id;
                    if (vid) {
                      allVariantIds.push(vid);
                      if (!firstVariantId) firstVariantId = vid;
                    }
                  }

                  await logger.info("db", "SAVE_VARIANT_END", `${candidates.length} variants saved`, {
                    first_variant_id: firstVariantId,
                    variant_ids: allVariantIds,
                  });
                  await logger.finalize("success", { variant_id: firstVariantId || undefined });

                  await loadReviewCandidates(rp.id);
                  toast.success(`Generated ${candidates.length} variants for review`);
                } catch (err: any) {
                  await logger.error("frontend", "GENERATION_ERROR", err?.message || "Generate & Review failed", {
                    stack: err?.stack?.slice(0, 500),
                  });
                  await logger.finalize("failed", { error_summary: err?.message });
                  toast.error(err?.message || "Generation failed");
                } finally {
                  qc.invalidateQueries({ queryKey: ["generation-runs", chapterId] });
                  setReviewLoading(false);
                }
              }} disabled={reviewLoading}>
                {reviewLoading ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="h-3 w-3 mr-1" /> Generate & Review</>
                )}
              </Button>
              <div className="flex items-center justify-center gap-2 pt-2">
                {reviewIndex < generatedProblems.length - 1 && (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigateReview("next")}>
                    Skip to Next <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Variant status filter + bulk actions */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                    {allCandidates.length} Variant{allCandidates.length !== 1 ? "s" : ""}
                  </h4>
                  <Select value={variantStatusFilter} onValueChange={setVariantStatusFilter}>
                    <SelectTrigger className="h-7 w-[120px] text-[10px]">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="banked">Banked</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="sm" className="h-7 text-[10px]"
                    onClick={async () => {
                      if (!rp) return;
                      const sorted = [...allCandidates].sort((a, b) =>
                        (b._variantId || "").localeCompare(a._variantId || "")
                      );
                      const toArchive = sorted.slice(1).filter((c: any) => c._variantStatus !== "archived");
                      if (toArchive.length === 0) { toast("Nothing to archive"); return; }
                      for (const c of toArchive) {
                        await supabase.from("problem_variants").update({ variant_status: "archived" } as any).eq("id", c._variantId);
                      }
                      await logActivity({
                        actor_type: "user", entity_type: "source_problem",
                        entity_id: rp.id,
                        event_type: "BULK_ARCHIVE_VARIANTS",
                        payload_json: { count: toArchive.length, kept: sorted[0]?._variantId },
                      });
                      await loadReviewCandidates(rp.id);
                      toast.success(`Archived ${toArchive.length} variant(s)`);
                    }}
                  >
                    <Archive className="h-3 w-3 mr-0.5" /> Archive except newest
                  </Button>
                  <Button
                    variant="outline" size="sm" className="h-7 text-[10px]"
                    onClick={async () => {
                      if (!rp) return;
                      const drafts = allCandidates.filter((c: any) => c._variantStatus === "draft");
                      if (drafts.length === 0) { toast("No drafts to archive"); return; }
                      for (const c of drafts) {
                        await supabase.from("problem_variants").update({ variant_status: "archived" } as any).eq("id", c._variantId);
                      }
                      await logActivity({
                        actor_type: "user", entity_type: "source_problem",
                        entity_id: rp.id,
                        event_type: "BULK_ARCHIVE_DRAFTS",
                        payload_json: { count: drafts.length },
                      });
                      await loadReviewCandidates(rp.id);
                      toast.success(`Archived ${drafts.length} draft(s)`);
                    }}
                  >
                    <Archive className="h-3 w-3 mr-0.5" /> Archive all drafts
                  </Button>
                </div>
              </div>

              {(() => {
                const filtered = allCandidates.filter((c: any) => {
                  const st = c._variantStatus || "draft";
                  if (variantStatusFilter === "active") return st !== "archived";
                  if (variantStatusFilter === "all") return true;
                  return st === variantStatusFilter;
                });
                if (filtered.length === 0) {
                  return <p className="text-xs text-muted-foreground text-center py-6">No variants match this filter.</p>;
                }
                return filtered.map((c: any, idx: number) => {
                const summaryLine = c.survive_problem_text?.split(/[.\n]/)?.[0]?.trim() || "—";
                const vStatus = c._variantStatus || "draft";
                const statusColors: Record<string, string> = {
                  draft: "text-muted-foreground border-border",
                  approved: "text-green-400 border-green-500/30 bg-green-500/10",
                  banked: "text-primary border-primary/30 bg-primary/10",
                  archived: "text-foreground/40 border-border bg-muted/30",
                };

                return (
                  <Collapsible key={c._variantId || idx} className="rounded-lg border border-border bg-background/95 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left min-w-0">
                        <ChevronRight className="h-4 w-4 text-foreground/50 flex-shrink-0 transition-transform [[data-state=open]_&]:rotate-90" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] text-foreground/50 uppercase tracking-wider">V{idx + 1}</span>
                            <h5 className="text-sm font-semibold text-foreground truncate">{c.asset_name || `Variant ${idx + 1}`}</h5>
                            <Badge variant="outline" className={cn("text-[9px] h-4 capitalize", statusColors[vStatus] || statusColors.draft)}>
                              {vStatus}
                            </Badge>
                          </div>
                          <p className="text-xs text-foreground/60 truncate">{summaryLine}</p>
                        </div>
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Status quick-set */}
                        <Select
                          value={vStatus}
                          onValueChange={async (newStatus) => {
                            if (!c._variantId) return;
                            await supabase.from("problem_variants").update({ variant_status: newStatus } as any).eq("id", c._variantId);
                            await logActivity({
                              actor_type: "user", entity_type: "source_problem",
                              entity_id: rp?.id || "unknown",
                              event_type: "VARIANT_STATUS_CHANGE",
                              payload_json: { variant_id: c._variantId, from: vStatus, to: newStatus },
                            });
                            if (rp) await loadReviewCandidates(rp.id);
                            toast.success(`Status → ${newStatus}`);
                          }}
                        >
                          <SelectTrigger className="h-6 w-[90px] text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="needs_fix">Needs Fix</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="banked">Banked</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => {
                            // Expand the collapsible inline — no drawer
                            // The Collapsible in this review queue section will handle it
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Review & Edit
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => {
                            setSavingIndex(idx);
                            setAfRequiresJE(!!c.journal_entry_block);
                            approveMutation.mutate({ candidate: c, problem: rp as any });
                          }}
                          disabled={approveMutation.isPending}
                        >
                          {savingIndex === idx && approveMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><Check className="h-3 w-3 mr-1" /> Approve</>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-destructive"
                          onClick={() => { setRejectingIndex(idx); setRejectReason(""); setRejectNote(""); setViewingProblem(rp as any); }}
                          disabled={approveMutation.isPending}
                        >
                          <X className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className="border-t border-border px-4 py-4">
                        <VariantReviewContent
                          variant={c}
                          problem={rp}
                          chapterId={rp.chapter_id}
                          onApproved={() => {
                            setSavingIndex(idx);
                            setAfRequiresJE(!!c.journal_entry_block);
                            approveMutation.mutate({ candidate: c, problem: rp as any });
                          }}
                          onRejected={() => {
                            setRejectingIndex(idx);
                            setRejectReason("");
                            setRejectNote("");
                            setViewingProblem(rp as any);
                          }}
                          onNeedsFix={async () => {
                            if (!c._variantId) return;
                            await supabase.from("problem_variants").update({ variant_status: "needs_fix", reviewed_at: new Date().toISOString() } as any).eq("id", c._variantId);
                            toast.success("Marked as needs fix");
                            recomputeProgress();
                            if (rp) await loadReviewCandidates(rp.id);
                          }}
                        />
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              });
              })()}
              {/* Quick navigation after reviewing */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <Button size="sm" variant="outline" onClick={() => {
                  setReviewMode(false);
                  openDetail(rp as any);
                }}>
                  <Sparkles className="h-3 w-3 mr-1" /> New Variant
                </Button>
                <div className="flex items-center gap-2">
                  {reviewIndex < generatedProblems.length - 1 && (
                    <Button size="sm" onClick={() => navigateReview("next")}>
                      Next Problem <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                  {reviewIndex >= generatedProblems.length - 1 && (
                    <Button size="sm" variant="outline" onClick={exitReview}>
                      <Check className="h-3 w-3 mr-1" /> Done Reviewing
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Drawer removed — unified inline review */}

          {/* Rejection Dialog (reuse) */}
          <Dialog open={rejectingIndex !== null} onOpenChange={(o) => { if (!o) { setRejectingIndex(null); setViewingProblem(null); } }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Why reject this variant?</DialogTitle>
                <DialogDescription>Select a reason and optionally add a note.</DialogDescription>
              </DialogHeader>
              <RadioGroup value={rejectReason} onValueChange={setRejectReason} className="space-y-2">
                {REJECTION_REASONS.map((r) => (
                  <div key={r} className="flex items-center gap-2">
                    <RadioGroupItem value={r} id={`rq-reason-${r}`} />
                    <Label htmlFor={`rq-reason-${r}`} className="text-xs cursor-pointer">{r}</Label>
                  </div>
                ))}
              </RadioGroup>
              <div>
                <Label className="text-xs">Note (optional)</Label>
                <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={2} className="text-xs mt-1" />
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => { setRejectingIndex(null); setViewingProblem(null); }}>Cancel</Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!rejectReason || rejectMutation.isPending}
                  onClick={() => {
                    if (rejectingIndex !== null) {
                      rejectMutation.mutate({
                        candidate: allCandidates[rejectingIndex],
                        problem: rp as any,
                        reason: rejectReason,
                        note: rejectNote,
                      });
                    }
                  }}
                >
                  {rejectMutation.isPending ? "Saving…" : "Reject Variant"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }
  }

  // ─── Detail / Generate View ───
  if (viewingProblem) {
    const p = viewingProblem;
    const ocrOk = p.ocr_status === "success";
    const ocrLow = ocrOk && p.ocr_confidence === "low";
    const ocrRunning = p.ocr_status === "running";
    const ocrFailed = p.ocr_status === "failed";
    const canGenerate = (ocrOk && !ocrLow) || (!!(p.problem_text));
    const probTextForJECheck = p.ocr_extracted_problem_text || p.problem_text;
    const problemRequiresJE = detectRequiresJE(probTextForJECheck) || afRequiresJE;
    const jeOnlyBlocked = false; // Universal mode — no longer gated

    // Screenshot URLs
    const problemUrls = p.problem_screenshot_urls?.length ? p.problem_screenshot_urls
      : p.problem_screenshot_url ? [p.problem_screenshot_url] : [];
    const solutionUrls = p.solution_screenshot_urls?.length ? p.solution_screenshot_urls
      : p.solution_screenshot_url ? [p.solution_screenshot_url] : [];
    const hasScreenshots = problemUrls.length > 0 || solutionUrls.length > 0;

    return (
      <div className="space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setViewingProblem(null)} className="text-foreground/70 hover:text-foreground">
          <ArrowLeft className="h-3 w-3 mr-1" /> Back to Problems
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-foreground/70">{p.ocr_detected_label || p.source_label}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{p.problem_type}</Badge>
              <Badge variant="outline" className={`text-[10px] ${statusStyle(p.status)}`}>
                {statusLabel(p.status)}
              </Badge>
              {ocrOk && p.ocr_confidence && (
                <Badge variant="outline" className={`text-[10px] ${
                  p.ocr_confidence === "high" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                  p.ocr_confidence === "medium" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                  "bg-red-500/20 text-red-400 border-red-500/30"
                }`}>
                  OCR: {p.ocr_confidence.toUpperCase()}
                </Badge>
              )}
              {ocrRunning && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </div>
            <h2 className="text-lg font-bold text-foreground">{p.ocr_detected_title || p.title || p.source_label}</h2>
          </div>
        </div>

        {/* Source Screenshots - Split View */}
        {hasScreenshots && (
          <div className={`grid gap-4 ${problemUrls.length > 0 && solutionUrls.length > 0 ? "md:grid-cols-2" : ""}`}>
            {problemUrls.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Problem Screenshots</h3>
                <div className="space-y-2">
                  {problemUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Problem ${i + 1}`} className="w-full rounded-lg border border-border object-contain max-h-80" />
                  ))}
                </div>
              </div>
            )}
            {solutionUrls.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Solution Screenshots</h3>
                <div className="space-y-2">
                  {solutionUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Solution ${i + 1}`} className="w-full rounded-lg border border-border object-contain max-h-80" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* OCR Extracted Text - Collapsible */}
        <Collapsible className="rounded-lg border border-border bg-card">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-2">
              <ScanText className="h-4 w-4 text-foreground/70" />
              <span className="text-sm font-semibold text-foreground">Extracted Source Text (OCR)</span>
              {ocrRunning && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              {ocrOk && <Badge variant="outline" className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">Extracted</Badge>}
              {ocrFailed && <Badge variant="outline" className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>}
              {p.ocr_status === "pending" && <Badge variant="outline" className="text-[10px]">Pending…</Badge>}
            </div>
            <ChevronDown className="h-4 w-4 text-foreground/70" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4 space-y-3">
            {/* Re-run button only if failed */}
            {(ocrFailed || p.ocr_status === "pending") && (
              <Button size="sm" variant="outline" onClick={() => ocrMutation.mutate(p)} disabled={ocrMutation.isPending}>
                {ocrMutation.isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Extracting…</> : <><RotateCw className="h-3 w-3 mr-1" /> Re-run OCR</>}
              </Button>
            )}

            {ocrOk && (
              <div className="space-y-3">
                {/* Detected Fields */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: "Label", value: p.ocr_detected_label },
                    { label: "LO#", value: p.ocr_detected_lo },
                    { label: "Title", value: p.ocr_detected_title },
                    { label: "Type", value: p.ocr_detected_type },
                  ].map(f => (
                    <div key={f.label} className="rounded border border-border bg-muted/30 p-2">
                      <p className="text-[10px] text-foreground/60 uppercase tracking-wider">{f.label}</p>
                      <p className="text-xs font-mono font-semibold text-foreground">{f.value || "—"}</p>
                    </div>
                  ))}
                </div>

                {p.ocr_confidence_notes && (
                  <p className="text-[10px] text-foreground/60 italic">{p.ocr_confidence_notes}</p>
                )}

                {/* Extracted Text */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] text-foreground/60 uppercase tracking-wider mb-1">Extracted Problem Text</p>
                    {ocrEditing ? (
                      <Textarea value={ocrEditProblem} onChange={(e) => setOcrEditProblem(e.target.value)} rows={6} className="text-xs font-mono" />
                    ) : (
                      <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-muted/30 rounded p-2 max-h-60 overflow-y-auto">{p.ocr_extracted_problem_text || "—"}</pre>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-foreground/60 uppercase tracking-wider mb-1">Extracted Solution Text</p>
                    {ocrEditing ? (
                      <Textarea value={ocrEditSolution} onChange={(e) => setOcrEditSolution(e.target.value)} rows={6} className="text-xs font-mono" />
                    ) : (
                      <pre className="text-xs text-foreground whitespace-pre-wrap font-mono bg-muted/30 rounded p-2 max-h-60 overflow-y-auto">{p.ocr_extracted_solution_text || "—"}</pre>
                    )}
                  </div>
                </div>

                {/* Edit actions */}
                <div className="flex items-center gap-2">
                  {!ocrEditing ? (
                    <Button size="sm" variant="ghost" onClick={() => {
                      setOcrEditing(true);
                      setOcrEditProblem(p.ocr_extracted_problem_text || "");
                      setOcrEditSolution(p.ocr_extracted_solution_text || "");
                    }}>
                      <Pencil className="h-3 w-3 mr-1" /> Edit manually
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="default" onClick={async () => {
                        await supabase.from("chapter_problems").update({
                          ocr_extracted_problem_text: ocrEditProblem,
                          ocr_extracted_solution_text: ocrEditSolution,
                        }).eq("id", p.id);
                        setViewingProblem({ ...p, ocr_extracted_problem_text: ocrEditProblem, ocr_extracted_solution_text: ocrEditSolution });
                        setOcrEditing(false);
                        toast.success("OCR text updated");
                      }}>
                        <Check className="h-3 w-3 mr-1" /> Save edits
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setOcrEditing(false)}>Cancel</Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => ocrMutation.mutate(p)} disabled={ocrMutation.isPending}>
                    <RotateCw className="h-3 w-3 mr-1" /> Re-extract
                  </Button>
                </div>
              </div>
            )}

            {p.ocr_status === "pending" && !ocrMutation.isPending && (
              <p className="text-xs text-foreground/60">OCR extraction is processing in the background…</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* OCR Warning Banner */}
        {ocrLow && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <ShieldAlert className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-300">
              <span className="font-semibold">OCR confidence low</span> — please verify extracted text before generating.
            </p>
          </div>
        )}
        {ocrFailed && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <ShieldAlert className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-300">
              <span className="font-semibold">OCR failed</span> — click "Re-run OCR" above or paste text manually.
            </p>
          </div>
        )}

        {/* JE-only mode removed — universal problem type detection */}

        {/* Generate Variants Panel */}
        <div className={cn("rounded-lg border border-primary/30 bg-primary/[0.05] p-5")}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">AI Variant Maker V2</h3>
          </div>

          <div className="grid gap-3 md:grid-cols-2 mb-4">
            <div>
              <Label className="text-xs text-foreground/80">Notes for AI (optional)</Label>
              <Input value={afNotes} onChange={(e) => setAfNotes(e.target.value)} placeholder="e.g., Focus on premium bonds" className="h-8 text-xs" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Checkbox id="je-toggle" checked={afRequiresJE} onCheckedChange={(v) => setAfRequiresJE(v === true)} />
              <Label htmlFor="je-toggle" className="text-xs cursor-pointer text-foreground/80">Journal entry required</Label>
            </div>
          </div>

          {/* AI Provider Selection */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Label className="text-xs text-foreground/80">Provider:</Label>
            <Select value={genProvider} onValueChange={(v) => setGenProvider(v as any)}>
              <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">Lovable</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
            {genProvider === "openai" && (
              <Select value={genModel} onValueChange={setGenModel}>
                <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4.1">gpt-4.1 (accuracy)</SelectItem>
                  <SelectItem value="gpt-4o-mini">gpt-4o-mini (cheap)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <Collapsible className="mb-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-foreground/70 hover:text-foreground transition-colors">
              <AlertTriangle className="h-3 w-3" />
              Exam Difficulty Options
              {activeDiffToggles.length > 0 && (
                <Badge variant="outline" className="text-[10px] ml-1">{activeDiffToggles.length} active</Badge>
              )}
              <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2 pl-5">
              <p className="text-[10px] text-foreground/60 mb-2">
                All OFF by default. Toggle ON to add exam-style traps to generated variants.
              </p>
              {DIFFICULTY_TOGGLES.map((toggle) => (
                <div key={toggle.id} className="flex items-center gap-2">
                  <Switch
                    id={`diff-${toggle.id}`}
                    checked={activeDiffToggles.includes(toggle.id)}
                    onCheckedChange={() => toggleDifficulty(toggle.id)}
                    className="scale-75"
                  />
                  <Label htmlFor={`diff-${toggle.id}`} className="text-xs cursor-pointer">{toggle.label}</Label>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              onClick={() => { setGenProvider("lovable"); generateMutation.mutate({ problem: p, provider: "lovable" }); }}
              disabled={generateMutation.isPending || !canGenerate}
              title={!canGenerate ? "OCR extraction needed" : ""}
            >
              {generateMutation.isPending && genProvider === "lovable" ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1" /> Generate {vCount} Variants (Lovable)</>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => { setGenProvider("openai"); generateMutation.mutate({ problem: p, provider: "openai", model: genModel }); }}
              disabled={generateMutation.isPending || !canGenerate}
              title={!canGenerate ? "OCR extraction needed" : ""}
            >
              {generateMutation.isPending && genProvider === "openai" ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1" /> Generate {vCount} Variants (OpenAI/{genModel})</>
              )}
            </Button>

            {candidates.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => generateMutation.mutate({ problem: p })} disabled={generateMutation.isPending || !canGenerate}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> New Variant
              </Button>
            )}

            {generatedAssetId && (
              <Button size="sm" variant="outline" asChild>
                <Link to="/assets-library">
                  <ExternalLink className="h-3 w-3 mr-1" /> View in Assets Library
                </Link>
              </Button>
            )}
          </div>

          {/* Inline Generation Error Panel */}
          {lastGenError && !generateMutation.isPending && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-destructive">Generation Failed</p>
                  <p className="text-xs text-foreground/70 mt-0.5">{lastGenError.message}</p>
                  {lastGenError.runId && (
                    <p className="text-[10px] text-foreground/50 font-mono mt-1">Run ID: {lastGenError.runId}</p>
                  )}
                </div>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setLastGenError(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    setLastGenError(null);
                    generateMutation.mutate({
                      problem: p,
                      provider: (lastGenError.provider as "lovable" | "openai") ?? genProvider,
                      model: lastGenError.model,
                    });
                  }}
                >
                  <RotateCw className="h-3 w-3 mr-1" /> Retry
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-foreground/60"
                  onClick={() => {
                    const debug = JSON.stringify(lastGenError, null, 2);
                    navigator.clipboard.writeText(debug);
                    toast.success("Debug info copied");
                  }}
                >
                  Copy Debug
                </Button>
              </div>
            </div>
          )}

          {/* Candidates — Vertical Stack */}
          {candidates.length > 0 && (
            <div className="mt-5 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                Generated Variants ({candidates.length})
              </h4>
              <div className="space-y-3">
                {candidates.map((c: any, idx: number) => {
                  const summaryLine = c.survive_problem_text?.split(/[.\n]/)?.[0]?.trim() || "—";
                  const isNonJE = !!(c.answer_parts || c._generation_mode === "NON_JE");
                  const nonJeFailures = isNonJE ? (c._non_je_quality_results || []).filter((r: any) => r.status === "fail") : [];
                  const hasNonJeFailures = nonJeFailures.length > 0;
                  const needsReview = c._needs_review === true;
                  const approveBlocked = hasNonJeFailures && !c._override_approve;

                  return (
                    <Collapsible
                      key={idx}
                      open={expandedVariantIdx === idx}
                      onOpenChange={(open) => setExpandedVariantIdx(open ? idx : null)}
                      className="rounded-lg border border-border bg-card overflow-hidden"
                    >
                      {/* Collapsed Header */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <CollapsibleTrigger className="flex items-center gap-2 flex-1 text-left min-w-0">
                          <ChevronRight className="h-4 w-4 text-foreground/50 flex-shrink-0 transition-transform [[data-state=open]_&]:rotate-90" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] text-foreground/50 uppercase tracking-wider">V{idx + 1}</span>
                              <h5 className="text-sm font-semibold text-foreground truncate">{c.asset_name}</h5>
                              {hasNonJeFailures && <Badge variant="outline" className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">Quality Issues</Badge>}
                              {needsReview && <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30">Cleaned</Badge>}
                            </div>
                            <p className="text-xs text-foreground/60 truncate">{summaryLine}</p>
                          </div>
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => {
                              setExpandedVariantIdx(idx);
                              setTimeout(() => {
                                variantRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }, 100);
                            }}
                          >
                            <Pencil className="h-3 w-3 mr-1" /> Review & Edit
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            onClick={() => {
                              setSavingIndex(idx);
                              approveMutation.mutate({ candidate: c, problem: p });
                            }}
                            disabled={approveMutation.isPending || approveBlocked}
                            title={approveBlocked ? "Fix quality issues or enable Override to approve" : ""}
                          >
                            {savingIndex === idx && approveMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <><Check className="h-3 w-3 mr-1" /> Approve</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive"
                            onClick={() => { setRejectingIndex(idx); setRejectReason(""); setRejectNote(""); }}
                            disabled={approveMutation.isPending}
                          >
                            <X className="h-3 w-3 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      <CollapsibleContent>
                        <div ref={(el) => { variantRefs.current[idx] = el; }} className="border-t border-border px-4 py-4">
                          {/* NON_JE Quality Issues Banner */}
                          {hasNonJeFailures && (
                            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 space-y-2 mb-4">
                              <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                                <ShieldAlert className="h-3 w-3" /> Quality Validation Failures ({nonJeFailures.length})
                              </p>
                              <ul className="text-xs text-red-300 space-y-0.5 list-disc pl-4">
                                {nonJeFailures.map((f: any, fi: number) => (
                                  <li key={fi}><span className="font-mono text-[10px]">{f.name}</span>: {f.message}</li>
                                ))}
                              </ul>
                              <div className="flex items-center gap-2 pt-1">
                                <Switch
                                  id={`override-${idx}`}
                                  checked={!!c._override_approve}
                                  onCheckedChange={(checked) => {
                                    setCandidates(prev => prev.map((cc, ci) =>
                                      ci === idx ? { ...cc, _override_approve: checked } : cc
                                    ));
                                  }}
                                  className="scale-75"
                                />
                                <Label htmlFor={`override-${idx}`} className="text-[10px] text-red-300 cursor-pointer">Override — approve despite failures</Label>
                              </div>
                            </div>
                          )}
                          {needsReview && !hasNonJeFailures && (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 mb-4">
                              <p className="text-[10px] text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Steps were auto-cleaned (trailing commentary stripped). Review before approving.
                              </p>
                            </div>
                          )}

                          {/* Unified Review Content */}
                          <VariantReviewContent
                            variant={c}
                            problem={p}
                            chapterId={p.chapter_id}
                            onApproved={() => {
                              setSavingIndex(idx);
                              approveMutation.mutate({ candidate: c, problem: p });
                            }}
                            onRejected={() => {
                              setRejectingIndex(idx);
                              setRejectReason("");
                              setRejectNote("");
                            }}
                            onNeedsFix={async () => {
                              if (!c._variantId) return;
                              await supabase.from("problem_variants").update({ variant_status: "needs_fix", reviewed_at: new Date().toISOString() } as any).eq("id", c._variantId);
                              toast.success("Marked as needs fix");
                              recomputeProgress();
                            }}
                            onApproveAndNext={() => {
                              setSavingIndex(idx);
                              approveMutation.mutate({ candidate: c, problem: p });
                              // Open next variant after approval
                              const nextIdx = idx + 1;
                              if (nextIdx < candidates.length) {
                                setTimeout(() => {
                                  setExpandedVariantIdx(nextIdx);
                                  setTimeout(() => {
                                    variantRefs.current[nextIdx]?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  }, 100);
                                }, 300);
                              }
                            }}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Drawer removed — unified inline review */}

        {/* Rejection Feedback Dialog */}
        <Dialog open={rejectingIndex !== null} onOpenChange={(o) => { if (!o) setRejectingIndex(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Why reject this variant?</DialogTitle>
              <DialogDescription>Select a reason and optionally add a note. This feedback will improve future generations.</DialogDescription>
            </DialogHeader>
            <RadioGroup value={rejectReason} onValueChange={setRejectReason} className="space-y-2">
              {REJECTION_REASONS.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <RadioGroupItem value={r} id={`reason-${r}`} />
                  <Label htmlFor={`reason-${r}`} className="text-xs cursor-pointer">{r}</Label>
                </div>
              ))}
            </RadioGroup>
            <div>
              <Label className="text-xs">Note (optional)</Label>
              <Textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={2} className="text-xs mt-1" placeholder="Any additional context…" />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setRejectingIndex(null)}>Cancel</Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!rejectReason || rejectMutation.isPending}
                onClick={() => {
                  if (rejectingIndex !== null && viewingProblem) {
                    rejectMutation.mutate({
                      candidate: candidates[rejectingIndex],
                      problem: viewingProblem,
                      reason: rejectReason,
                      note: rejectNote,
                    });
                  }
                }}
              >
                {rejectMutation.isPending ? "Saving…" : "Reject Variant"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const readyCount = problems?.filter(p => p.status === "ready" && (p as any).dependency_type !== "dependent_problem").length ?? 0;

  const launchServerBatch = async () => {
    if (!problems?.length) return;
    const eligible = problems.filter(p => p.status === "ready" && (p as any).dependency_type !== "dependent_problem");
    if (eligible.length === 0) { toast.info("No Ready problems to generate."); return; }
    setLaunchingBatch(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-chapter-batch-run", {
        body: {
          course_id: courseId,
          chapter_id: chapterId,
          source_problem_ids: eligible.map(p => p.id),
          variant_count: vCount,
          provider: "lovable",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Batch run created with ${data.total} problems`);
      // Navigate to batch run detail with smooth transition
      navigate(`/batch-run/${data.batch_run_id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLaunchingBatch(false);
    }
  };

  // ─── Table View ───
  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs text-foreground/80">
          Uploaded textbook problems waiting to be transformed into Survive assets.
        </p>
        <div className="flex items-center gap-2">
          {generatedProblems.length > 0 && (
            <Button
              size="sm"
              variant="default"
              className="text-xs"
              onClick={() => startReviewQueue(0)}
            >
              <Eye className="h-3 w-3 mr-1" /> Review Generated ({generatedProblems.length})
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={launchServerBatch}
            disabled={launchingBatch || readyCount === 0}
          >
            {launchingBatch ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Batch Generate ({readyCount} ready)
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-24 text-foreground/70">Label</TableHead>
              <TableHead className="text-xs text-foreground/70">Title</TableHead>
              <TableHead className="text-xs w-20 text-foreground/70">Type</TableHead>
              <TableHead className="text-xs w-28 text-foreground/70">Status</TableHead>
              <TableHead className="text-xs w-32 text-foreground/70">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-foreground/80 text-xs py-8">Loading…</TableCell></TableRow>
            ) : !problems?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center text-foreground/80 text-xs py-8">No source problems yet. Click "+ Add Source" to start.</TableCell></TableRow>
            ) : (
              problems.map((p) => (
                <TableRow key={p.id} className="bg-background/90 text-foreground hover:bg-accent/50 data-[state=selected]:bg-accent/60">
                  <TableCell className="font-mono text-xs font-medium text-foreground">{p.source_label}</TableCell>
                  <TableCell className="text-xs truncate max-w-[200px] text-foreground/90">{p.title || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize text-foreground/80 bg-background/80 border-border">{p.problem_type}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${statusStyle(p.status)}`}>
                      {statusLabel(p.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {(p.status === "raw" || p.status === "imported" || p.status === "ready" || p.status === "tagged") && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => openDetail(p)}>
                          <Sparkles className="h-3 w-3 mr-1" /> Generate
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/80 hover:text-foreground" onClick={() => setPreviewProblem(p)} title="Preview screenshots">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Source Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Source Problem</DialogTitle>
            <DialogDescription>Enter the textbook problem details. This creates a SOURCE record for variant generation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as any)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exercise">Exercise</SelectItem>
                    <SelectItem value="problem">Problem</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Source Label</Label>
                <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="E13-4" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Bond amortization" className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Problem Text</Label>
              <Textarea value={formProblem} onChange={(e) => setFormProblem(e.target.value)} rows={4} className="text-xs" placeholder="Paste the original problem text…" />
            </div>
            <div>
              <Label className="text-xs">Solution Text</Label>
              <Textarea value={formSolution} onChange={(e) => setFormSolution(e.target.value)} rows={4} className="text-xs" placeholder="Paste the solution…" />
            </div>
            <div>
              <Label className="text-xs">Journal Entry (optional)</Label>
              <Textarea value={formJE} onChange={(e) => setFormJE(e.target.value)} rows={3} className="text-xs font-mono" placeholder="Debit: Account — Amount&#10;Credit: Account — Amount" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="no-je-toggle" checked={formNoJE} onCheckedChange={(v) => setFormNoJE(v === true)} />
              <Label htmlFor="no-je-toggle" className="text-xs cursor-pointer">Contains no Journal Entries</Label>
              <span className="text-[10px] text-muted-foreground">(EPS/ratios/analysis — skips JE logic)</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Save Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Problem</DialogTitle>
            <DialogDescription>This will permanently remove this source problem. Continue?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Source Problem Preview */}
      <SourceProblemPreview
        problem={previewProblem}
        open={!!previewProblem}
        onOpenChange={(open) => { if (!open) setPreviewProblem(null); }}
      />

      {/* Batch Generate Modal */}
      <Dialog open={batchModalOpen} onOpenChange={(o) => { if (!o) { setBatchModalOpen(false); if (!batchRunning) setBatchCompleted(0); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Batch Generate Variants</DialogTitle>
            <DialogDescription>
              Generate {vCount} AI variants for each READY source problem in this chapter.
              Variants will NOT be auto-approved.
            </DialogDescription>
          </DialogHeader>

          {!batchRunning && batchCompleted === 0 && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
                <p className="text-sm text-foreground"><strong>{readyCount}</strong> problems ready for generation</p>
                <p className="text-xs text-muted-foreground">Estimated time: ~{Math.ceil(readyCount * 0.5)} minutes</p>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="force-regen"
                  checked={batchForceRegen}
                  onCheckedChange={(v) => setBatchForceRegen(!!v)}
                />
                <Label htmlFor="force-regen" className="text-xs cursor-pointer">
                  Force regenerate (include already GENERATED problems)
                </Label>
              </div>

              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setBatchModalOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={startBatchGenerate}>
                  <Sparkles className="h-3 w-3 mr-1" /> Start Batch Generation
                </Button>
              </DialogFooter>
            </div>
          )}

          {batchRunning && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">{batchCompleted} / {batchTotal} complete</span>
                  <span className="text-muted-foreground text-xs">{Math.round((batchCompleted / batchTotal) * 100)}%</span>
                </div>
                <Progress value={(batchCompleted / batchTotal) * 100} className="h-2" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span>Processing: <strong className="text-foreground">{batchCurrentLabel}</strong></span>
              </div>
              {batchErrors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 space-y-1 max-h-24 overflow-y-auto">
                  {batchErrors.map((e, i) => (
                    <p key={i} className="text-[10px] text-destructive">{e}</p>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">You can navigate away — generation will continue in the background.</p>
            </div>
          )}

          {!batchRunning && batchCompleted > 0 && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-green-500" />
                <span>Batch complete: {batchCompleted} problems processed</span>
              </div>
              {batchErrors.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 space-y-1 max-h-24 overflow-y-auto">
                  <p className="text-[10px] text-muted-foreground font-semibold">{batchErrors.length} error(s):</p>
                  {batchErrors.map((e, i) => (
                    <p key={i} className="text-[10px] text-destructive">{e}</p>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button size="sm" onClick={() => { setBatchModalOpen(false); setBatchCompleted(0); }}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
