import { useState, useRef, useCallback, useEffect } from "react";
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
import { SpeedReviewPanel } from "@/components/content-factory/SpeedReviewPanel";
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
  autoReview?: boolean;
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

export function ProblemBankTab({ chapterId, chapterNumber, courseId, autoReview }: Props) {
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
  const [notReadyWarningFlash, setNotReadyWarningFlash] = useState(false);
  const [sourceStatusFilter, setSourceStatusFilter] = useState<string>("ready");

  // Review queue state
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewCandidates, setReviewCandidates] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [variantStatusFilter, setVariantStatusFilter] = useState<string>("active");
  const [showArchived, setShowArchived] = useState(false);
  const [speedReviewMode, setSpeedReviewMode] = useState(true);
  const [speedReviewVariantIndex, setSpeedReviewVariantIndex] = useState(0);
  const [startOverOpen, setStartOverOpen] = useState(false);
  const [startOverRunning, setStartOverRunning] = useState(false);
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

      // Trigger Google Sheets workbook creation (fire-and-forget)
      if (data.asset?.id) {
        supabase.functions.invoke("create-asset-sheet", {
          body: { asset_id: data.asset.id },
        }).then((res) => {
          if (res.data?.sheet_master_url || res.data?.sheet_url) {
            toast.success("Google Sheets created", { description: "Master, Practice & Promo sheets ready in Drive" });
          } else if (res.error) {
            console.error("Sheet creation failed:", res.error);
          }
        }).catch((err) => console.error("Sheet creation error:", err));
      }
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
    if (p.status !== "ready" && p.status !== "generated") {
      toast.warning("This problem isn't ready yet. Import both the textbook problem and solution before generating.");
      setNotReadyWarningFlash(true);
      setTimeout(() => setNotReadyWarningFlash(false), 2000);
      return;
    }
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

  // Auto-start review if navigated with ?mode=review
  const autoReviewTriggered = useRef(false);
  useEffect(() => {
    if (autoReview && !autoReviewTriggered.current && generatedProblems.length > 0 && !reviewMode) {
      autoReviewTriggered.current = true;
      startReviewQueue(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReview, generatedProblems.length]);

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
      .neq("variant_status", "archived")
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
          highlight_key_json: v.highlight_key_json,
          parts_json: v.parts_json,
          confidence_score: v.confidence_score,
          difficulty_estimate: v.difficulty_estimate,
        };
      }));
      setSpeedReviewVariantIndex(0);
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
              {/* Speed / Full Review Toggle */}
              <div className="flex items-center gap-1.5 mr-2">
                <Switch
                  checked={speedReviewMode}
                  onCheckedChange={setSpeedReviewMode}
                  className="h-5 w-9"
                />
                <span className="text-[10px] text-muted-foreground font-medium">
                  {speedReviewMode ? "Speed" : "Full"}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setStartOverOpen(true)}
                disabled={startOverRunning}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Start Over (Archive Variants)
              </Button>
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

          {/* Start Over Confirmation Dialog */}
          <AlertDialog open={startOverOpen} onOpenChange={setStartOverOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start Over Variant Generation?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will archive all existing variants for this chapter and allow new V1 variants to be generated.
                  <br /><br />
                  Nothing will be deleted. Archived variants remain available for debugging.
                  <br /><br />
                  Do you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={startOverRunning}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={startOverRunning}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async (e) => {
                    e.preventDefault();
                    setStartOverRunning(true);
                    try {
                      // Step 1: Get all non-approved variant IDs for this chapter's sources
                      const chapterSourceIds = (problems ?? []).map(p => p.id);
                      if (chapterSourceIds.length === 0) {
                        toast.info("No source problems in this chapter.");
                        return;
                      }

                      const { data: variants, error: fetchErr } = await supabase
                        .from("problem_variants")
                        .select("id, variant_status")
                        .in("base_problem_id", chapterSourceIds)
                        .neq("variant_status", "archived");

                      if (fetchErr) throw fetchErr;
                      
                      const toArchive = (variants ?? []).filter(v => v.variant_status !== "approved");
                      const archivedCount = toArchive.length;

                      // Step 1: Archive variants (batch update)
                      if (toArchive.length > 0) {
                        const ids = toArchive.map(v => v.id);
                        const { error: archiveErr } = await supabase
                          .from("problem_variants")
                          .update({ variant_status: "archived" } as any)
                          .in("id", ids);
                        if (archiveErr) throw archiveErr;
                      }

                      // Step 2: Reset source pipeline status back to "ready" for generated sources
                      const generatedSourceIds = (problems ?? [])
                        .filter(p => p.status === "generated")
                        .map(p => p.id);
                      
                      if (generatedSourceIds.length > 0) {
                        const { error: resetErr } = await supabase
                          .from("chapter_problems")
                          .update({ status: "ready", pipeline_status: "imported" } as any)
                          .in("id", generatedSourceIds);
                        if (resetErr) throw resetErr;
                      }

                      // Step 3: Log the reset
                      await logActivity({
                        actor_type: "user",
                        entity_type: "chapter",
                        entity_id: chapterId,
                        event_type: "generation_reset",
                        severity: "warn",
                        message: `Archived ${archivedCount} variant(s), reset ${generatedSourceIds.length} source(s) to ready`,
                        payload_json: {
                          variants_archived: archivedCount,
                          sources_reset: generatedSourceIds.length,
                          chapter_id: chapterId,
                        },
                      });

                      // Step 4: Refresh data and exit review
                      qc.invalidateQueries({ queryKey: ["chapter-problems", chapterId] });
                      qc.invalidateQueries({ queryKey: ["chapter-activity-log", chapterId] });
                      exitReview();
                      setStartOverOpen(false);
                      toast.success(`Variants archived. Ready to generate fresh V1 variants.`);
                    } catch (err: any) {
                      toast.error(`Reset failed: ${err?.message}`);
                    } finally {
                      setStartOverRunning(false);
                    }
                  }}
                >
                  {startOverRunning ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Archiving…</>
                  ) : (
                    "Archive & Reset"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

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
          ) : speedReviewMode && allCandidates.filter((c: any) => (c._variantStatus || "draft") !== "archived").length > 0 ? (
            /* ═══ SPEED REVIEW MODE ═══ */
            (() => {
              const activeVariants = allCandidates.filter((c: any) => (c._variantStatus || "draft") !== "archived");
              const currentVariant = activeVariants[speedReviewVariantIndex] || activeVariants[0];
              if (!currentVariant) return null;
              return (
                <SpeedReviewPanel
                  variant={currentVariant}
                  problem={rp}
                  variantIndex={speedReviewVariantIndex}
                  totalVariants={activeVariants.length}
                  onApprove={() => {
                    setSavingIndex(speedReviewVariantIndex);
                    setAfRequiresJE(!!currentVariant.journal_entry_block);
                    approveMutation.mutate({ candidate: currentVariant, problem: rp as any });
                    // Auto-advance after approve
                    if (speedReviewVariantIndex < activeVariants.length - 1) {
                      setSpeedReviewVariantIndex(prev => prev + 1);
                    } else if (reviewIndex < generatedProblems.length - 1) {
                      navigateReview("next");
                    }
                  }}
                  onReject={() => {
                    setRejectingIndex(speedReviewVariantIndex);
                    setRejectReason("");
                    setRejectNote("");
                    setViewingProblem(rp as any);
                  }}
                  onRegenerate={async () => {
                    if (!currentVariant._variantId) return;
                    await supabase.from("problem_variants").update({ variant_status: "archived" } as any).eq("id", currentVariant._variantId);
                    toast.success("Variant archived — regenerate from Full Review");
                    if (rp) await loadReviewCandidates(rp.id);
                    // Auto-advance after regenerate
                    if (speedReviewVariantIndex < activeVariants.length - 1) {
                      setSpeedReviewVariantIndex(prev => prev + 1);
                    } else if (reviewIndex < generatedProblems.length - 1) {
                      navigateReview("next");
                    }
                  }}
                  onFlagForDeepReview={async () => {
                    if (!currentVariant._variantId) return;
                    await supabase.from("problem_variants").update({ variant_status: "needs_fix", reviewed_at: new Date().toISOString() } as any).eq("id", currentVariant._variantId);
                    toast.success("Flagged for deep review");
                    if (rp) await loadReviewCandidates(rp.id);
                    // Auto-advance after flag
                    if (speedReviewVariantIndex < activeVariants.length - 1) {
                      setSpeedReviewVariantIndex(prev => prev + 1);
                    } else if (reviewIndex < generatedProblems.length - 1) {
                      navigateReview("next");
                    }
                  }}
                  onNext={() => {
                    if (speedReviewVariantIndex < activeVariants.length - 1) {
                      setSpeedReviewVariantIndex(prev => prev + 1);
                    } else if (reviewIndex < generatedProblems.length - 1) {
                      navigateReview("next");
                    } else {
                      toast.info("No more variants to review");
                    }
                  }}
                  onBack={() => {
                    if (speedReviewVariantIndex > 0) {
                      setSpeedReviewVariantIndex(prev => prev - 1);
                    } else if (reviewIndex > 0) {
                      navigateReview("prev");
                    } else {
                      toast.info("Already at the first item");
                    }
                  }}
                  onOpenFullReview={() => setSpeedReviewMode(false)}
                />
              );
            })()
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

  // Detail view removed — generation now uses batch pipeline only

  const readyCount = problems?.filter(p => p.status === "ready").length ?? 0;

  const launchServerBatch = async () => {
    if (!problems?.length) return;
    const eligible = problems.filter(p => p.status === "ready");
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
          <Select value={sourceStatusFilter} onValueChange={setSourceStatusFilter}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ready">Ready Only</SelectItem>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="imported">Imported</SelectItem>
              <SelectItem value="generated">Generated</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={launchServerBatch}
            disabled={launchingBatch || readyCount === 0}
          >
            {launchingBatch ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Generate ({readyCount} ready)
          </Button>
        </div>
      </div>

      {/* Warning: no ready problems */}
      {problems && problems.length > 0 && readyCount === 0 && (
        <div className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-3 mb-3 text-sm transition-all",
          notReadyWarningFlash
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-border bg-muted/50 text-muted-foreground"
        )}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Import textbook problems first.</strong> Each source needs both a solution and textbook problem screenshot before it can be generated.
          </span>
        </div>
      )}

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
              <TableRow><TableCell colSpan={5} className="text-center text-foreground/80 text-xs py-8">No imported sources yet.</TableCell></TableRow>
            ) : (() => {
              const filtered = sourceStatusFilter === "all"
                ? problems
                : problems.filter(p => p.status === sourceStatusFilter);
              return filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-foreground/80 text-xs py-8">No {sourceStatusFilter} problems found.</TableCell></TableRow>
              ) : filtered.map((p) => (
                <TableRow key={p.id} className="bg-background/90 text-foreground hover:bg-accent/50 data-[state=selected]:bg-accent/60">
                  <TableCell className="font-mono text-xs font-medium text-foreground">{p.source_label}</TableCell>
                  <TableCell className="text-xs truncate max-w-[200px] text-foreground/90">{p.title || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] capitalize text-foreground/80 bg-background/80 border-border">{p.source_label?.match(/^BE/i) ? "Brief Exercise" : p.problem_type}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${statusStyle(p.status)}`}>
                      {statusLabel(p.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-foreground/80 hover:text-foreground" onClick={() => setPreviewProblem(p)} title="Preview screenshots">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ));
            })()}

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
