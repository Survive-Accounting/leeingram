import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { resolveEffectiveRole } from "@/lib/rolePermissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Wrench, ChevronDown, Loader2, Undo2, History, Eye, Play, Pause, Info, Plus, X, Trash2, ListOrdered, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type OperationType = "fix_entity_naming" | "find_replace_simple" | "custom_ai" | "fix_entity_perspective" | "enrich_je_rows" | "generate_supplementary_je" | "generate_worked_steps" | "generate_flowcharts" | "generate_dissector_highlights" | "enrich_je_tooltips" | "rewrite_je_reasons" | "rewrite_je_amounts" | "generate_calculation_formulas" | "standardize_formatting";

interface HistoryEntry {
  label: string;
  date: string;
  count: number;
  scope: string;
  reverted: boolean;
}

interface QueueItem {
  id: string;
  operation_name: string;
  operation_key: string;
  queue_position: number;
  status: string;
  assets_processed: number;
  assets_succeeded: number;
  assets_errored: number;
  assets_skipped: number;
  started_at: string | null;
  completed_at: string | null;
  error_summary: string | null;
  created_at: string;
}

const BATCH_SIZE = 10;

const OPERATION_LABELS: Record<string, string> = {
  fix_entity_naming: "Fix Entity Naming (Counterparty → Company A/B)",
  fix_entity_perspective: "Fix Entity Naming + Perspective (Full Correction)",
  find_replace_simple: "Simple Find & Replace",
  custom_ai: "Custom AI Rewrite",
  enrich_je_rows: "Enrich JE Rows (debit_credit_reason + amount_source)",
  generate_supplementary_je: "Generate Supplementary JEs (backfill)",
  generate_worked_steps: "Generate Worked Steps (backfill)",
  generate_flowcharts: "Generate Flowcharts (backfill missing)",
  generate_dissector_highlights: "Generate Dissector Highlights (backfill missing)",
  enrich_je_tooltips: "Enrich JE Tooltips (fill gaps)",
  rewrite_je_reasons: "Rewrite JE Reasons (YOU Format)",
  rewrite_je_amounts: "Rewrite Amount Sources (Plain English)",
  generate_calculation_formulas: "Generate Calculation Formulas (e.g. $180,000 × 8% = $14,400)",
  standardize_formatting: "Standardize Formatting (solution text only)",
};

const ENTITY_PERSPECTIVE_INSTRUCTION = `You are making surgical text corrections to an accounting problem. You must follow these rules with absolute precision:

WHAT YOU MUST CHANGE:
1. If the text says "Survive Company" without an A/B suffix, rename it to "Survive Company A ([role])" where [role] is inferred from context (e.g. the issuer, the borrower, the lessor, the seller, the lessee, the investor, etc.)
2. If "Survive Company B" appears without a role hint in parentheses, add the appropriate role hint based on context. Example: "Survive Company B" → "Survive Company B (the investor)"
3. If "Survive Counterparty" still appears anywhere, replace it with "Survive Company B ([role])" where role is inferred from context.
4. For every instruction line that asks the student to prepare a journal entry or calculate something, rewrite it to include "on the books of Survive Company A/B ([role])" inline within that instruction.
   Determine which entity each instruction refers to by reading the full problem context.
   Example transformation:
   BEFORE: "(a) Prepare the journal entry to record the issuance of the bonds on January 1."
   AFTER: "(a) Prepare the journal entry on the books of Survive Company A (the issuer) to record the issuance of the bonds on January 1."

WHAT YOU MUST NOT CHANGE:
- All dollar amounts, percentages, and numeric values must remain exactly as-is
- All dates must remain exactly as-is
- The overall sentence structure and wording of the problem scenario must remain the same
- Do not add new sentences or paragraphs
- Do not remove any existing content
- Do not change any accounting terminology
- Do not reorder the instructions

Return only the corrected text with no explanation or commentary. The output must be a drop-in replacement for the original field value.`;

const STANDARDIZE_FORMATTING_PROMPT = `You are fixing the formatting of this explanation only. Do not change any numbers, calculations, or accounting conclusions. Apply these rules exactly:

1. Step labels (Step 1, Step 2, Step 3) must always be narrative text OUTSIDE of calculation blocks — never inside a monospace or highlighted calculation line.

2. Part headers like "Calculate the amount of proceeds allocated to the bonds" must be bold and sit as a clean header above their calculation block — not mixed inside it.

3. Every calculation line stays in its monospace/highlighted format.

4. One blank line between each step and its calculation block.

5. One blank line between each part (a), (b), (c).

6. Do not add any new content or change any values.

7. Do not remove any calculations or conclusions.

Output must look like a clean textbook solution with clear separation between narrative steps and calculation lines.`;

/** Extract all numbers from text for comparison */
function extractNumbers(text: string): string[] {
  return (text.match(/[\d,]+\.?\d*/g) || []).sort();
}

function hasNumericDiff(before: string, after: string): boolean {
  const numsBefore = extractNumbers(before);
  const numsAfter = extractNumbers(after);
  if (numsBefore.length !== numsAfter.length) return true;
  return numsBefore.some((n, i) => n !== numsAfter[i]);
}

// Fields that can be targeted by bulk fix
const FIXABLE_FIELDS = [
  { key: "problem_context", label: "Problem Context" },
  { key: "survive_problem_text", label: "Problem Text" },
  { key: "survive_solution_text", label: "Solution Text" },
] as const;

type FixableField = typeof FIXABLE_FIELDS[number]["key"];

interface PreviewRow {
  id: string;
  asset_name: string;
  field: string;
  before: string;
  after: string;
  numericWarning?: boolean;
}

function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem("bulk-fix-history") || "[]");
  } catch { return []; }
}

function addHistory(entry: HistoryEntry) {
  const h = getHistory();
  h.unshift(entry);
  localStorage.setItem("bulk-fix-history", JSON.stringify(h.slice(0, 50)));
}

// ── Recommended order shortcuts ──
const RECOMMENDED_ORDER: { key: OperationType; label: string; desc: string }[] = [
  { key: "enrich_je_tooltips", label: "Enrich JE Rows", desc: "safe, fills gaps only" },
  { key: "rewrite_je_reasons", label: "Rewrite JE Reasons (YOU Format)", desc: "rewrites all reasons" },
  { key: "rewrite_je_amounts", label: "Rewrite Amount Sources (Plain English)", desc: "rewrites all amounts" },
  { key: "generate_dissector_highlights", label: "Generate Dissector Highlights", desc: "run after 1-3 are complete" },
];

export default function BulkFixTool() {
  const navigate = useNavigate();
  const { isVa, vaAccount } = useVaAccount();
  const { impersonating } = useImpersonation();
  const effectiveRole = resolveEffectiveRole(impersonating?.role, vaAccount?.role, isVa);
  const queryClient = useQueryClient();

  // Admin gate
  useEffect(() => {
    if (effectiveRole !== "admin") navigate("/dashboard", { replace: true });
  }, [effectiveRole, navigate]);

  // State
  const [operation, setOperation] = useState<OperationType | "">("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [selectedFields, setSelectedFields] = useState<FixableField[]>(["problem_context", "survive_problem_text"]);
  const [courseFilter, setCourseFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("approved");

  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [totalMatched, setTotalMatched] = useState(0);
  const [isAiPreview, setIsAiPreview] = useState(false);

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const pauseRef = useRef(false);
  const [runProgress, setRunProgress] = useState({ current: 0, total: 0, currentAsset: "" });
  const [runComplete, setRunComplete] = useState<{ updated: number; skipped: number; errors?: number } | null>(null);

  const [reverting, setReverting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Queue state
  const [queueOp, setQueueOp] = useState<OperationType | "">("");
  const [queueRunning, setQueueRunning] = useState(false);

  // Queries
  const { data: courses } = useQuery({
    queryKey: ["courses-bulk"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, course_name").order("created_at");
      return data ?? [];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters-bulk", courseFilter],
    queryFn: async () => {
      let q = supabase.from("chapters").select("id, chapter_number, chapter_name, course_id").order("chapter_number");
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Count affected assets
  const { data: estimatedCount } = useQuery({
    queryKey: ["bulk-fix-count", courseFilter, chapterFilter, statusFilter],
    queryFn: async () => {
      let q = supabase.from("teaching_assets").select("id", { count: "exact", head: true });
      if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
      if (chapterFilter !== "all") q = q.eq("chapter_id", chapterFilter);
      if (statusFilter === "approved") q = q.not("asset_approved_at", "is", null);
      if (statusFilter === "core") q = q.not("core_rank", "is", null);
      const { count } = await q;
      return count ?? 0;
    },
  });

  // Last operation info
  const { data: lastOp, refetch: refetchLastOp } = useQuery({
    queryKey: ["bulk-fix-last-op"],
    queryFn: async () => {
      const { data } = await supabase
        .from("teaching_assets")
        .select("id, last_bulk_fix_at, last_bulk_fix_label")
        .not("last_bulk_fix_at", "is", null)
        .order("last_bulk_fix_at", { ascending: false })
        .limit(1);
      if (!data?.length) return null;
      const { count } = await supabase
        .from("teaching_assets")
        .select("id", { count: "exact", head: true })
        .eq("last_bulk_fix_label", data[0].last_bulk_fix_label as string)
        .not("last_bulk_fix_at", "is", null);
      return { label: data[0].last_bulk_fix_label, date: data[0].last_bulk_fix_at, count: count ?? 0 };
    },
  });

  // Queue items
  const { data: queueItems, refetch: refetchQueue } = useQuery({
    queryKey: ["bulk-fix-queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bulk_fix_queue")
        .select("*")
        .order("queue_position", { ascending: true });
      return (data ?? []) as QueueItem[];
    },
    refetchInterval: queueRunning ? 5000 : 15000,
  });

  // Detect server-side running state
  useEffect(() => {
    if (!queueItems) return;
    const hasRunning = queueItems.some(q => q.status === "running");
    const hasPending = queueItems.some(q => q.status === "pending");
    // If server is processing, reflect that in UI
    if ((hasRunning || hasPending) && !queueRunning) {
      // Only set running if there's actually a running item (server is active)
      if (hasRunning) setQueueRunning(true);
    }
    if (!hasRunning && !hasPending && queueRunning) {
      setQueueRunning(false);
    }
  }, [queueItems, queueRunning]);

  const operationLabel = useMemo(() => {
    if (operation === "fix_entity_naming") return "Fix Entity Naming (Counterparty → Company A/B)";
    if (operation === "fix_entity_perspective") return "Fix Entity Naming + Perspective (Full Correction)";
    if (operation === "find_replace_simple") return `Find & Replace: "${findText}" → "${replaceText}"`;
    if (operation === "custom_ai") return "Custom AI Rewrite";
    if (operation === "enrich_je_rows") return "Enrich JE Rows (debit_credit_reason + amount_source)";
    if (operation === "generate_supplementary_je") return "Generate Supplementary JEs (backfill)";
    if (operation === "generate_worked_steps") return "Generate Worked Steps (backfill)";
    if (operation === "generate_flowcharts") return "Generate Flowcharts (backfill missing)";
    if (operation === "generate_dissector_highlights") return "Generate Dissector Highlights (backfill missing)";
    if (operation === "enrich_je_tooltips") return "Enrich JE Tooltips (fill gaps)";
    if (operation === "rewrite_je_reasons") return "Rewrite JE Reasons (YOU Format)";
    if (operation === "rewrite_je_amounts") return "Rewrite Amount Sources (Plain English)";
    return "";
  }, [operation, findText, replaceText]);

  // Build the scope query — use lightweight select for operations that only need id
  function buildScopeQuery(lightweight = false) {
    const fields = lightweight
      ? "id, asset_name, fix_notes"
      : "id, asset_name, problem_context, survive_problem_text, survive_solution_text, journal_entry_completed_json, supplementary_je_json, fix_notes";
    let q = supabase.from("teaching_assets").select(fields) as any;
    if (courseFilter !== "all") q = q.eq("course_id", courseFilter);
    if (chapterFilter !== "all") q = q.eq("chapter_id", chapterFilter);
    if (statusFilter === "approved") q = q.not("asset_approved_at", "is", null);
    if (statusFilter === "core") q = q.not("core_rank", "is", null);
    return q;
  }

  function simpleReplace(text: string): string {
    if (!findText) return text;
    return text.split(findText).join(replaceText);
  }

  function entityNamingReplace(text: string): string {
    let result = text.replace(/Survive\s+Counterparty/gi, "Survive Company B");
    result = result.replace(/(?<!Survive\s+)Counterparty/gi, "Survive Company B");
    result = result.replace(/the other company/gi, "Survive Company B");
    result = result.replace(/the second party/gi, "Survive Company B");
    return result;
  }

  // Preview
  async function runPreview() {
    if (!operation) return;
    setPreviewLoading(true);
    setPreviewRows(null);
    setRunComplete(null);

    try {
      if (operation === "find_replace_simple" || operation === "fix_entity_naming") {
        const { data: assets, error } = await buildScopeQuery();
        if (error) throw error;

        const rows: PreviewRow[] = [];
        const replaceFn = operation === "fix_entity_naming" ? entityNamingReplace : simpleReplace;

        for (const asset of assets ?? []) {
          for (const f of FIXABLE_FIELDS) {
            if (operation === "find_replace_simple" && !selectedFields.includes(f.key)) continue;
            const original = (asset as any)[f.key] || "";
            const replaced = replaceFn(original);
            if (replaced !== original) {
              rows.push({
                id: asset.id,
                asset_name: asset.asset_name,
                field: f.label,
                before: original.slice(0, 200),
                after: replaced.slice(0, 200),
              });
            }
          }
        }

        setTotalMatched(new Set(rows.map(r => r.id)).size);
        setPreviewRows(rows);
        setIsAiPreview(false);
      } else if (operation === "custom_ai" || operation === "fix_entity_perspective") {
        const { data: assets, error } = await buildScopeQuery().limit(3);
        if (error) throw error;
        setTotalMatched(estimatedCount ?? 0);

        const aiInstruction = operation === "fix_entity_perspective" 
          ? ENTITY_PERSPECTIVE_INSTRUCTION 
          : customInstruction;
        const targetFields = operation === "fix_entity_perspective"
          ? FIXABLE_FIELDS.filter(f => ["problem_context", "survive_problem_text"].includes(f.key))
          : FIXABLE_FIELDS.filter(f => selectedFields.includes(f.key));

        const rows: PreviewRow[] = [];
        for (const asset of assets ?? []) {
          for (const f of targetFields) {
            const original = (asset as any)[f.key] || "";
            if (!original.trim()) continue;

            const { data: aiResult, error: aiError } = await supabase.functions.invoke("generate-ai-output", {
              body: {
                provider: "lovable",
                model: "google/gemini-2.5-flash",
                messages: [
                  { role: "system", content: "You are a text editor. Apply the following instruction to the text. Return ONLY the modified text, nothing else." },
                  { role: "user", content: `Instruction: ${aiInstruction}\n\nText to modify:\n${original}` },
                ],
                temperature: 0.1,
                max_output_tokens: 2000,
              },
            });
            if (aiError) throw aiError;
            const after = aiResult?.raw || aiResult?.content || original;
            if (after !== original) {
              rows.push({
                id: asset.id,
                asset_name: asset.asset_name,
                field: f.label,
                before: original.slice(0, 300),
                after: after.slice(0, 300),
                numericWarning: hasNumericDiff(original, after),
              });
            }
          }
        }

        setPreviewRows(rows);
        setIsAiPreview(true);
      } else if (operation === "enrich_je_rows") {
        const { data: assets, error } = await buildScopeQuery().not("journal_entry_completed_json", "is", null).limit(20);
        if (error) throw error;

        let countQ = supabase.from("teaching_assets").select("id", { count: "exact", head: true }).not("journal_entry_completed_json", "is", null);
        if (courseFilter !== "all") countQ = countQ.eq("course_id", courseFilter);
        if (chapterFilter !== "all") countQ = countQ.eq("chapter_id", chapterFilter);
        if (statusFilter === "approved") countQ = countQ.not("asset_approved_at", "is", null);
        if (statusFilter === "core") countQ = countQ.not("core_rank", "is", null);
        const { count: jeCount } = await countQ;

        const rows: PreviewRow[] = [];
        let assetsNeedingEnrichment = 0;
        for (const asset of assets ?? []) {
          for (const jsonField of ["journal_entry_completed_json", "supplementary_je_json"] as const) {
            const jeJson = (asset as any)[jsonField];
            if (!jeJson?.scenario_sections) continue;

            let missingCount = 0;
            let totalRows = 0;
            for (const section of jeJson.scenario_sections) {
              for (const entry of section.entries_by_date || []) {
                for (const row of entry.rows || []) {
                  totalRows++;
                  if (!row.debit_credit_reason || !row.amount_source) missingCount++;
                }
              }
            }

            if (missingCount > 0) {
              assetsNeedingEnrichment++;
              if (rows.length < 4) {
                rows.push({
                  id: asset.id,
                  asset_name: asset.asset_name,
                  field: jsonField,
                  before: `${totalRows} JE rows, ${missingCount} missing enrichment fields`,
                  after: `Will add debit_credit_reason + amount_source to ${missingCount} rows via AI`,
                });
              }
            }
          }
        }

        const sampleSize = (assets ?? []).length;
        const estimatedNeedEnrichment = sampleSize > 0
          ? Math.round(((assetsNeedingEnrichment / sampleSize) * (jeCount ?? 0)))
          : 0;
        setTotalMatched(estimatedNeedEnrichment > 0 ? estimatedNeedEnrichment : assetsNeedingEnrichment);

        setPreviewRows(rows);
        setIsAiPreview(true);
      } else if (operation === "generate_supplementary_je") {
        let countQ = supabase.from("teaching_assets").select("id", { count: "exact", head: true })
          .not("journal_entry_completed_json", "is", null)
          .is("supplementary_je_json", null);
        if (courseFilter !== "all") countQ = countQ.eq("course_id", courseFilter);
        if (chapterFilter !== "all") countQ = countQ.eq("chapter_id", chapterFilter);
        if (statusFilter === "approved") countQ = countQ.not("asset_approved_at", "is", null);
        if (statusFilter === "core") countQ = countQ.not("core_rank", "is", null);
        const { count: missingCount } = await countQ;
        setTotalMatched(missingCount ?? 0);

        setPreviewRows([{
          id: "summary",
          asset_name: "All in scope",
          field: "supplementary_je_json",
          before: `${missingCount ?? 0} assets have main JE but no supplementary JE`,
          after: `Will generate supplementary JEs for ${missingCount ?? 0} assets via AI`,
        }]);
        setIsAiPreview(true);
      } else if (operation === "generate_worked_steps") {
        let countQ = supabase.from("teaching_assets").select("id", { count: "exact", head: true })
          .not("survive_solution_text", "is", null);
        // Exclude assets that already have worked_steps
        countQ = countQ.or("worked_steps.is.null,worked_steps.eq.");
        if (courseFilter !== "all") countQ = countQ.eq("course_id", courseFilter);
        if (chapterFilter !== "all") countQ = countQ.eq("chapter_id", chapterFilter);
        if (statusFilter === "approved") countQ = countQ.not("asset_approved_at", "is", null);
        if (statusFilter === "core") countQ = countQ.not("core_rank", "is", null);
        const { count: missingCount } = await countQ;
        setTotalMatched(missingCount ?? 0);

        setPreviewRows([{
          id: "summary",
          asset_name: "All in scope",
          field: "worked_steps",
          before: `${missingCount ?? 0} approved assets have solution text but no worked steps`,
          after: `Will extract step-by-step worked solutions for ${missingCount ?? 0} assets via AI`,
        }]);
        setIsAiPreview(true);
      } else if (operation === "generate_flowcharts") {
        let countQ = supabase.from("teaching_assets").select("id", { count: "exact", head: true })
          .is("flowchart_image_url", null);
        if (courseFilter !== "all") countQ = countQ.eq("course_id", courseFilter);
        if (chapterFilter !== "all") countQ = countQ.eq("chapter_id", chapterFilter);
        if (statusFilter === "approved") countQ = countQ.not("asset_approved_at", "is", null);
        if (statusFilter === "core") countQ = countQ.not("core_rank", "is", null);
        const { count: missingCount } = await countQ;
        setTotalMatched(missingCount ?? 0);

        setPreviewRows([{
          id: "summary",
          asset_name: "All in scope",
          field: "flowchart_image_url",
          before: `${missingCount ?? 0} assets have no flowchart generated`,
          after: `Will generate flowcharts for ${missingCount ?? 0} assets via AI + HCTI`,
        }]);
        setIsAiPreview(true);
      } else if (operation === "generate_dissector_highlights") {
        const { data: scopeAssets } = await buildScopeQuery(true);
        if (!scopeAssets?.length) { setTotalMatched(0); setPreviewRows([]); setIsAiPreview(true); return; }

        const assetIds = scopeAssets.map((a: any) => a.id);
        const { data: existingDissectors } = await supabase
          .from("dissector_problems")
          .select("teaching_asset_id")
          .in("teaching_asset_id", assetIds.slice(0, 500));
        const existingSet = new Set((existingDissectors || []).map((d: any) => d.teaching_asset_id));
        const missing = scopeAssets.filter((a: any) => !existingSet.has(a.id));
        setTotalMatched(missing.length);

        setPreviewRows([{
          id: "summary",
          asset_name: "All in scope",
          field: "dissector_problems",
          before: `${missing.length} assets have no dissector highlights`,
          after: `Will generate highlights for ${missing.length} assets via AI`,
        }]);
        setIsAiPreview(true);
      } else if (operation === "enrich_je_tooltips" || operation === "rewrite_je_reasons" || operation === "rewrite_je_amounts" || operation === "generate_calculation_formulas") {
        let countQ = supabase.from("teaching_assets").select("id", { count: "exact", head: true })
          .not("journal_entry_completed_json", "is", null);
        if (courseFilter !== "all") countQ = countQ.eq("course_id", courseFilter);
        if (chapterFilter !== "all") countQ = countQ.eq("chapter_id", chapterFilter);
        if (statusFilter === "approved") countQ = countQ.not("asset_approved_at", "is", null);
        if (statusFilter === "core") countQ = countQ.not("core_rank", "is", null);
        const { count: jeCount } = await countQ;
        setTotalMatched(jeCount ?? 0);

        const modeLabel = operation === "enrich_je_tooltips" ? "enrich" : operation === "rewrite_je_reasons" ? "rewrite_reasons" : operation === "rewrite_je_amounts" ? "rewrite_amounts" : "generate_formulas";
        const actionDesc = operation === "enrich_je_tooltips"
          ? "Will fill missing debit_credit_reason + amount_source fields"
          : operation === "rewrite_je_reasons"
          ? "Will rewrite ALL debit_credit_reason fields to student-friendly format"
          : operation === "rewrite_je_amounts"
          ? "Will rewrite ALL amount_source fields to plain English (no dollar figures)"
          : "Will generate calculation_formula fields (e.g. $180,000 × 8% = $14,400) for all JE rows";

        setPreviewRows([{
          id: "summary",
          asset_name: "All in scope",
          field: "journal_entry_completed_json",
          before: `${jeCount ?? 0} assets with JE data`,
          after: `${actionDesc} via AI (mode: ${modeLabel})`,
        }]);
        setIsAiPreview(true);
      }
    } catch (e: any) {
      toast.error("Preview failed: " + e.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Core operation runner (shared between single-run and queue) ──
  async function executeOperation(
    opKey: OperationType,
    onProgress?: (current: number, total: number, assetName: string) => void,
    onComplete?: (updated: number, skipped: number, errors: number) => void,
    shouldStop?: () => boolean,
    startOffset?: number,
  ) {
    const isLightweight = ["generate_flowcharts", "generate_supplementary_je", "generate_dissector_highlights", "enrich_je_tooltips", "rewrite_je_reasons", "rewrite_je_amounts"].includes(opKey);
    let scopeQuery = buildScopeQuery(isLightweight);
    if (["enrich_je_tooltips", "rewrite_je_reasons", "rewrite_je_amounts"].includes(opKey)) {
      scopeQuery = scopeQuery.not("journal_entry_completed_json", "is", null);
    }
    const { data: assets, error } = await scopeQuery;
    if (error) throw error;
    if (!assets?.length) return { updated: 0, skipped: 0, errors: 0 };

    const total = assets.length;
    let updated = 0, skipped = 0, errors = 0;
    const offset = startOffset ?? 0;

    // Set fix_status = 'pending_fix' on all assets in scope before processing
    const assetIds = assets.map((a: any) => a.id);
    for (let chunk = 0; chunk < assetIds.length; chunk += 500) {
      const ids = assetIds.slice(chunk, chunk + 500);
      await supabase.from("teaching_assets").update({ fix_status: "pending_fix" } as any).in("id", ids);
    }

    const batchSize = ["enrich_je_rows", "generate_supplementary_je", "generate_flowcharts", "generate_dissector_highlights", "enrich_je_tooltips", "rewrite_je_reasons", "rewrite_je_amounts"].includes(opKey) ? 5 : BATCH_SIZE;

    for (let i = offset; i < total; i += batchSize) {
      if (shouldStop?.()) break;
      const batch = assets.slice(i, i + batchSize);
      const updates: Promise<void>[] = [];

      for (const asset of batch) {
        updates.push((async () => {
          const now = new Date().toISOString();
          const fixLabel = OPERATION_LABELS[opKey] || opKey;
          const fixNoteEntry = `Bulk fix applied: ${fixLabel} — ${now}`;
          const backupUpdate: Record<string, any> = {
            problem_context_backup: (asset as any).problem_context || "",
            problem_text_backup: (asset as any).survive_problem_text || "",
            last_bulk_fix_at: now,
            last_bulk_fix_label: fixLabel,
            fix_status: "fix_applied",
            fix_notes: ((asset as any).fix_notes ? (asset as any).fix_notes + "\n" : "") + fixNoteEntry,
          };

          const newValues: Record<string, any> = {};
          let changed = false;

          if (opKey === "find_replace_simple") {
            for (const f of FIXABLE_FIELDS) {
              if (!selectedFields.includes(f.key)) continue;
              const original = (asset as any)[f.key] || "";
              const replaced = simpleReplace(original);
              if (replaced !== original) { newValues[f.key] = replaced; changed = true; }
            }
          } else if (opKey === "fix_entity_naming") {
            for (const f of FIXABLE_FIELDS) {
              const original = (asset as any)[f.key] || "";
              const replaced = entityNamingReplace(original);
              if (replaced !== original) { newValues[f.key] = replaced; changed = true; }
            }
          } else if (opKey === "custom_ai" || opKey === "fix_entity_perspective") {
            const aiInstruction = opKey === "fix_entity_perspective" ? ENTITY_PERSPECTIVE_INSTRUCTION : customInstruction;
            const targetFields = opKey === "fix_entity_perspective"
              ? FIXABLE_FIELDS.filter(f => ["problem_context", "survive_problem_text"].includes(f.key))
              : FIXABLE_FIELDS.filter(f => selectedFields.includes(f.key));
            for (const f of targetFields) {
              const original = (asset as any)[f.key] || "";
              if (!original.trim()) continue;
              const { data: aiResult } = await supabase.functions.invoke("generate-ai-output", {
                body: {
                  provider: "lovable",
                  model: "google/gemini-2.5-flash",
                  messages: [
                    { role: "system", content: "You are a text editor. Apply the following instruction to the text. Return ONLY the modified text, nothing else." },
                    { role: "user", content: `Instruction: ${aiInstruction}\n\nText to modify:\n${original}` },
                  ],
                  temperature: 0.1,
                  max_output_tokens: 2000,
                },
              });
              const after = aiResult?.raw || aiResult?.content || original;
              if (after !== original) { newValues[f.key] = after; changed = true; }
            }
          } else if (opKey === "enrich_je_rows") {
            for (const jsonField of ["journal_entry_completed_json", "supplementary_je_json"] as const) {
              const jeJson = (asset as any)[jsonField];
              if (!jeJson?.scenario_sections) continue;

              let hasMissing = false;
              for (const section of jeJson.scenario_sections) {
                for (const entry of section.entries_by_date || []) {
                  for (const row of entry.rows || []) {
                    if (!row.debit_credit_reason || !row.amount_source) { hasMissing = true; break; }
                  }
                  if (hasMissing) break;
                }
                if (hasMissing) break;
              }
              if (!hasMissing) continue;

              const jeSummary: string[] = [];
              for (const section of jeJson.scenario_sections) {
                for (const entry of section.entries_by_date || []) {
                  for (const row of entry.rows || []) {
                    const side = row.credit != null && row.credit !== 0 ? "Credit" : "Debit";
                    const amount = row.credit != null && row.credit !== 0 ? row.credit : row.debit;
                    jeSummary.push(`Account: ${row.account_name}, ${side}: $${amount}, Date: ${entry.date}, Section: ${section.label}`);
                  }
                }
              }

              const enrichSystemPrompt = `You are an accounting tutor. For each journal entry row below, provide two fields:
1. debit_credit_reason: 1-2 sentences explaining why this account is debited or credited in this context. Written for an accounting student.
2. amount_source: 1-2 sentences explaining where the dollar amount comes from, referencing the solution/problem when possible.

Return JSON: { "rows": [ { "debit_credit_reason": "...", "amount_source": "..." } ] }
Rules: Return rows in SAME ORDER. Be concise but specific. If amount is given directly, say so. Return ONLY valid JSON.`;

              const enrichUserPrompt = `Problem:\n${(asset as any).problem_context || (asset as any).survive_problem_text || "N/A"}\n\nSolution:\n${(asset as any).survive_solution_text || "N/A"}\n\nJE rows (${jeSummary.length}):\n${jeSummary.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}`;

              const { data: aiResult, error: aiErr } = await supabase.functions.invoke("generate-ai-output", {
                body: {
                  provider: "lovable",
                  model: "google/gemini-2.5-flash",
                  messages: [
                    { role: "system", content: enrichSystemPrompt },
                    { role: "user", content: enrichUserPrompt },
                  ],
                  temperature: 0.1,
                  max_output_tokens: 4000,
                },
              });

              if (aiErr) continue;
              const rawContent = aiResult?.raw || aiResult?.content || "";
              let parsed: any;
              try {
                const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
                parsed = JSON.parse(cleaned);
              } catch { continue; }

              if (!parsed?.rows || !Array.isArray(parsed.rows)) continue;

              const enriched = JSON.parse(JSON.stringify(jeJson));
              let rowIdx = 0;
              for (const section of enriched.scenario_sections) {
                for (const entry of section.entries_by_date || []) {
                  for (const row of entry.rows || []) {
                    if (rowIdx < parsed.rows.length) {
                      if (!row.debit_credit_reason && parsed.rows[rowIdx].debit_credit_reason) {
                        row.debit_credit_reason = parsed.rows[rowIdx].debit_credit_reason;
                      }
                      if (!row.amount_source && parsed.rows[rowIdx].amount_source) {
                        row.amount_source = parsed.rows[rowIdx].amount_source;
                      }
                    }
                    rowIdx++;
                  }
                }
              }

              newValues[jsonField] = enriched;
              changed = true;
            }

            if (!changed) { skipped++; return; }
          } else if (opKey === "generate_supplementary_je") {
            const jeJson = (asset as any).journal_entry_completed_json;
            const suppJson = (asset as any).supplementary_je_json;
            if (!jeJson || suppJson) { skipped++; return; }

            const { data: result, error: fnErr } = await supabase.functions.invoke("generate-supplementary-je", {
              body: { teaching_asset_id: asset.id },
            });

            if (fnErr || !result?.success) { skipped++; return; }
            changed = true;
          } else if (opKey === "generate_flowcharts") {
            const { data: existing } = await supabase
              .from("asset_flowcharts")
              .select("id")
              .eq("teaching_asset_id", asset.id)
              .limit(1);
            if (existing && existing.length > 0) { skipped++; return; }

            const { data: result, error: fnErr } = await supabase.functions.invoke("generate-flowchart", {
              body: { teaching_asset_id: asset.id },
            });

            if (fnErr || !result?.success || result?.skipped) { skipped++; return; }
            changed = true;
          } else if (opKey === "generate_dissector_highlights") {
            const { data: existing } = await supabase
              .from("dissector_problems")
              .select("id")
              .eq("teaching_asset_id", asset.id)
              .limit(1);
            if (existing && existing.length > 0) { skipped++; return; }

            const { data: result, error: fnErr } = await supabase.functions.invoke("generate-dissector-highlights", {
              body: { teaching_asset_id: asset.id },
            });

            if (fnErr || !result?.success) { skipped++; return; }
            changed = true;
          } else if (opKey === "enrich_je_tooltips" || opKey === "rewrite_je_reasons" || opKey === "rewrite_je_amounts") {
            const mode = opKey === "enrich_je_tooltips" ? "enrich" : opKey === "rewrite_je_reasons" ? "rewrite_reasons" : "rewrite_amounts";
            try {
              const { data: result, error: fnErr } = await supabase.functions.invoke("rewrite-je-tooltips", {
                body: { teaching_asset_id: asset.id, mode },
              });
              if (fnErr || !result?.success) { errors++; return; }
              changed = true;
            } catch { errors++; return; }
          }

          if (changed) {
            if (!["generate_supplementary_je", "generate_flowcharts", "generate_dissector_highlights", "enrich_je_tooltips", "rewrite_je_reasons", "rewrite_je_amounts"].includes(opKey)) {
              await supabase.from("teaching_assets").update({ ...backupUpdate, ...newValues }).eq("id", asset.id);
            }
            updated++;
          } else {
            skipped++;
          }
        })());
      }

      await Promise.all(updates);
      onProgress?.(Math.min(i + batchSize, total), total, (batch[batch.length - 1] as any)?.asset_name || "");

      // Delay for AI-heavy operations
      if (["enrich_je_tooltips", "rewrite_je_reasons", "rewrite_je_amounts", "enrich_je_rows", "generate_supplementary_je", "generate_flowcharts", "generate_dissector_highlights"].includes(opKey)) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    onComplete?.(updated, skipped, errors);
    return { updated, skipped, errors };
  }

  // Run the actual operation (single-run mode)
  async function runOperation() {
    if (!operation) return;

    if (lastOp) {
      const confirmed = window.confirm(
        "Running this will overwrite your existing backup. Make sure you don't need to revert the previous operation first. Continue?"
      );
      if (!confirmed) return;
    }

    setRunning(true);
    setRunComplete(null);
    pauseRef.current = false;

    try {
      const result = await executeOperation(
        operation as OperationType,
        (current, total, assetName) => setRunProgress({ current, total, currentAsset: assetName }),
        undefined,
        () => pauseRef.current,
      );

      if (result) {
        setRunComplete({ updated: result.updated, skipped: result.skipped, errors: result.errors });
        addHistory({
          label: operationLabel,
          date: new Date().toISOString(),
          count: result.updated,
          scope: `${courseFilter === "all" ? "All courses" : courses?.find(c => c.id === courseFilter)?.course_name || courseFilter} / ${statusFilter}`,
          reverted: false,
        });
        refetchLastOp();
        toast.success(`Done — ${result.updated} assets updated.`);
      }
    } catch (e: any) {
      toast.error("Operation failed: " + e.message);
    } finally {
      setRunning(false);
      setPaused(false);
      pauseRef.current = false;
    }
  }

  // Revert
  async function runRevert() {
    if (!lastOp) return;
    const confirmed = window.confirm(`Revert "${lastOp.label}" on ${lastOp.count} assets? This restores original text from backups.`);
    if (!confirmed) return;

    setReverting(true);
    try {
      const { data: assets, error } = await supabase
        .from("teaching_assets")
        .select("id, problem_context_backup, problem_text_backup")
        .eq("last_bulk_fix_label", lastOp.label as string)
        .not("last_bulk_fix_at", "is", null);
      if (error) throw error;

      let reverted = 0;
      for (const asset of assets ?? []) {
        const a = asset as any;
        await supabase.from("teaching_assets").update({
          problem_context: a.problem_context_backup || "",
          survive_problem_text: a.problem_text_backup || "",
          last_bulk_fix_at: null,
          last_bulk_fix_label: null,
          fix_status: "pending_fix",
        }).eq("id", asset.id);
        reverted++;
      }

      const h = getHistory();
      const idx = h.findIndex(x => x.label === lastOp.label);
      if (idx >= 0) { h[idx].reverted = true; localStorage.setItem("bulk-fix-history", JSON.stringify(h)); }

      toast.success(`Reverted ${reverted} assets.`);
      refetchLastOp();
    } catch (e: any) {
      toast.error("Revert failed: " + e.message);
    } finally {
      setReverting(false);
    }
  }

  // ── Queue functions ──
  async function addToQueue(opKey: OperationType) {
    const maxPos = Math.max(0, ...(queueItems ?? []).filter(q => q.status === "pending").map(q => q.queue_position));
    const { error } = await supabase.from("bulk_fix_queue").insert({
      operation_name: OPERATION_LABELS[opKey] || opKey,
      operation_key: opKey,
      queue_position: maxPos + 1,
      status: "pending",
      scope_course_id: courseFilter === "all" ? null : courseFilter,
      scope_chapter_id: chapterFilter === "all" ? null : chapterFilter,
      scope_status_filter: statusFilter,
    } as any);
    if (error) { toast.error("Failed to add to queue"); return; }
    refetchQueue();
    toast.success(`Added "${OPERATION_LABELS[opKey]}" to queue`);
  }

  async function removeFromQueue(id: string) {
    await supabase.from("bulk_fix_queue").delete().eq("id", id);
    refetchQueue();
  }

  async function clearCompleted() {
    await supabase.from("bulk_fix_queue").delete().in("status", ["complete", "skipped", "failed"]);
    refetchQueue();
  }

  async function retryFailed(itemId: string) {
    await supabase.from("bulk_fix_queue").update({
      status: "pending",
      error_summary: null,
    }).eq("id", itemId);
    refetchQueue();
    toast.success("Reset to pending — hit Run Queue to resume");
  }




  const runQueue = useCallback(async () => {
    setQueueRunning(true);

    try {
      // Just invoke the server-side processor — it self-chains
      const { error } = await supabase.functions.invoke("process-bulk-fix-queue");
      if (error) throw error;
      toast.success("Queue started — processing server-side. You can close this page.");
      refetchQueue();
    } catch (e: any) {
      toast.error("Failed to start queue: " + e.message);
      setQueueRunning(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleField(field: FixableField) {
    setSelectedFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  }

  const history = getHistory();
  const pendingQueueItems = (queueItems ?? []).filter(q => q.status === "pending");
  const hasRunningQueueItem = (queueItems ?? []).some(q => q.status === "running");
  const runningQueueItem = (queueItems ?? []).find(q => q.status === "running");

  if (effectiveRole !== "admin") return null;

  return (
    <SurviveSidebarLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-5 w-5" /> Bulk Fix Tool
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Make targeted text fixes across teaching assets with preview and full revert.
          </p>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-200">
            This tool modifies teaching asset content directly. Always preview before running. Every operation is fully reversible.
          </p>
        </div>

        {/* Section 1: Operation Selector */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Select Fix Operation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={operation} onValueChange={(v) => { setOperation(v as OperationType); setPreviewRows(null); setRunComplete(null); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose an operation…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fix_entity_naming">Fix Entity Naming (Counterparty → Company A/B)</SelectItem>
                <SelectItem value="fix_entity_perspective">Fix Entity Naming + Perspective (Full Correction)</SelectItem>
                <SelectItem value="find_replace_simple">Simple Find &amp; Replace</SelectItem>
                <SelectItem value="custom_ai">Custom AI Rewrite Instruction</SelectItem>
                <SelectItem value="enrich_je_rows">Enrich JE Rows (add debit_credit_reason + amount_source)</SelectItem>
                <SelectItem value="generate_supplementary_je">Generate Supplementary JEs (backfill missing)</SelectItem>
                <SelectItem value="generate_flowcharts">Generate Flowcharts (backfill missing)</SelectItem>
                <SelectItem value="generate_dissector_highlights">Generate Dissector Highlights (backfill missing)</SelectItem>
                <SelectItem value="enrich_je_tooltips">Enrich JE Tooltips (fill gaps)</SelectItem>
                <SelectItem value="rewrite_je_reasons">Rewrite JE Reasons (YOU Format)</SelectItem>
                <SelectItem value="rewrite_je_amounts">Rewrite Amount Sources (Plain English)</SelectItem>
                <SelectItem value="generate_calculation_formulas">Generate Calculation Formulas (e.g. $180,000 × 8% = $14,400)</SelectItem>
              </SelectContent>
            </Select>

            {/* Info card for JE tooltip operations */}
            {(operation === "enrich_je_tooltips" || operation === "rewrite_je_reasons" || operation === "rewrite_je_amounts") && (
              <div className="flex items-start gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-200 space-y-1">
                  <p className="font-medium">Recommended run order:</p>
                  <ol className="list-decimal ml-4 space-y-0.5">
                    <li className={operation === "enrich_je_tooltips" ? "font-semibold text-blue-100" : ""}>Enrich JE Tooltips first (fills gaps, safe to run anytime)</li>
                    <li className={operation === "rewrite_je_reasons" ? "font-semibold text-blue-100" : ""}>Rewrite JE Reasons overnight</li>
                    <li className={operation === "rewrite_je_amounts" ? "font-semibold text-blue-100" : ""}>Rewrite Amount Sources overnight</li>
                  </ol>
                </div>
              </div>
            )}

            {operation === "fix_entity_naming" && (
              <p className="text-xs text-muted-foreground">
                Replaces "Survive Counterparty" with "Survive Company B" and removes vague terms like "the other company" or "the second party". Applies to all text fields.
              </p>
            )}

            {operation === "fix_entity_perspective" && (
              <p className="text-xs text-muted-foreground">
                Renames "Survive Company" to "Survive Company A ([role])" where missing, ensures Survive Company B has role hint, and rewrites each instruction line to include "on the books of Survive Company A/B ([role])" inline. Numbers and dates are not changed.
              </p>
            )}

            {operation === "enrich_je_rows" && (
              <p className="text-xs text-muted-foreground">
                Reads each asset's <code className="text-foreground">journal_entry_completed_json</code> and <code className="text-foreground">supplementary_je_json</code>, then uses AI to add <code className="text-foreground">debit_credit_reason</code> and <code className="text-foreground">amount_source</code> fields to every JE row. Only processes rows missing these fields. Powers hover tooltips in SolutionsViewer.
              </p>
            )}

            {operation === "generate_supplementary_je" && (
              <p className="text-xs text-muted-foreground">
                Generates <code className="text-foreground">supplementary_je_json</code> for assets that have main journal entries but are missing the "Related Journal Entries" section. Calls the existing generation function per asset. Only targets assets where this field is currently null.
              </p>
            )}

            {operation === "generate_flowcharts" && (
              <p className="text-xs text-muted-foreground">
                Generates "How to Solve This" flowchart images for assets that don't have one yet. Creates per-instruction flowcharts for multi-part problems. Uses AI + HCTI rendering. Batch size of 2 to manage rate limits.
              </p>
            )}

            {operation === "generate_dissector_highlights" && (
              <p className="text-xs text-muted-foreground">
                Generates problem dissector highlights for assets that don't have them yet. Creates a <code className="text-foreground">dissector_problems</code> record per asset with AI-identified key inputs, amounts, dates, and concepts. Powers the highlight overlay on SolutionsViewer staging page.
              </p>
            )}

            {operation === "enrich_je_tooltips" && (
              <p className="text-xs text-muted-foreground">
                Add missing <code className="text-foreground">debit_credit_reason</code> and <code className="text-foreground">amount_source</code> fields to all JE rows. Skips rows that already have both fields. Safe and additive — won't overwrite existing content.
              </p>
            )}

            {operation === "rewrite_je_reasons" && (
              <>
                <p className="text-xs text-muted-foreground">
                  Rewrites all <code className="text-foreground">debit_credit_reason</code> fields to use student-friendly "you" language and account type rules. Overwrites existing text.
                </p>
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 mt-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200">
                    ⚠ This overwrites all existing debit_credit_reason text across all assets in scope. Best run overnight.
                  </p>
                </div>
              </>
            )}

            {operation === "rewrite_je_amounts" && (
              <>
                <p className="text-xs text-muted-foreground">
                  Rewrites all <code className="text-foreground">amount_source</code> fields to explain HOW to calculate each amount without mentioning specific dollar figures.
                </p>
                <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 mt-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-200">
                    ⚠ This overwrites all existing amount_source text across all assets in scope. Best run overnight.
                  </p>
                </div>
              </>
            )}

            {operation === "find_replace_simple" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Find</Label>
                  <Input value={findText} onChange={e => setFindText(e.target.value)} placeholder="Text to find…" />
                </div>
                <div>
                  <Label className="text-xs">Replace With</Label>
                  <Input value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="Replacement text…" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-2 block">Target Fields</Label>
                  <div className="flex gap-4">
                    {FIXABLE_FIELDS.map(f => (
                      <label key={f.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox checked={selectedFields.includes(f.key)} onCheckedChange={() => toggleField(f.key)} />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {operation === "custom_ai" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">AI Instruction</Label>
                  <Textarea
                    value={customInstruction}
                    onChange={e => setCustomInstruction(e.target.value)}
                    placeholder="e.g. Add role hints in parentheses after each company name…"
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-2 block">Target Fields</Label>
                  <div className="flex gap-4">
                    {FIXABLE_FIELDS.map(f => (
                      <label key={f.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Checkbox checked={selectedFields.includes(f.key)} onCheckedChange={() => toggleField(f.key)} />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Scope */}
        {operation && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Scope</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Course</Label>
                  <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); setChapterFilter("all"); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Courses</SelectItem>
                      {courses?.map(c => <SelectItem key={c.id} value={c.id}>{c.course_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Chapter</Label>
                  <Select value={chapterFilter} onValueChange={setChapterFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Chapters</SelectItem>
                      {chapters?.map(c => <SelectItem key={c.id} value={c.id}>Ch {c.chapter_number} — {c.chapter_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status Filter</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved Assets</SelectItem>
                      <SelectItem value="core">Core Assets Only</SelectItem>
                      <SelectItem value="all">All Assets</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3">
                <Badge variant="secondary" className="text-xs">
                  Estimated: {estimatedCount ?? "…"} assets in scope
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3: Preview */}
        {operation && (
          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={runPreview}
              disabled={previewLoading || running || (operation === "find_replace_simple" && !findText)}
            >
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              Preview Changes
            </Button>

            {previewRows !== null && (
              <Card className="bg-card border-border">
                <CardContent className="pt-4">
                  {previewRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matching assets found. Nothing would change.</p>
                  ) : (
                    <>
                      {isAiPreview && (
                        <p className="text-xs text-amber-300 mb-3">
                          Showing {previewRows.length} field changes from 3 sample assets of {totalMatched} total. Review carefully before running on all assets.
                        </p>
                      )}
                      {!isAiPreview && (
                        <p className="text-xs text-muted-foreground mb-3">
                          {totalMatched} assets would be affected
                        </p>
                      )}
                      <div className="max-h-96 overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs w-36">Asset</TableHead>
                              <TableHead className="text-xs w-28">Field</TableHead>
                              <TableHead className="text-xs">Before</TableHead>
                              <TableHead className="text-xs">After</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewRows.map((row, i) => (
                              <TableRow key={`${row.id}-${row.field}-${i}`} className={row.numericWarning ? "bg-destructive/10" : ""}>
                                <TableCell className="text-xs font-mono">{row.asset_name.slice(0, 25)}</TableCell>
                                <TableCell className="text-xs">{row.field}</TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-48 truncate">{row.before}</TableCell>
                                <TableCell className="text-xs max-w-48">
                                  <span className={row.numericWarning ? "text-destructive" : "text-emerald-400"}>
                                    {row.after}
                                  </span>
                                  {row.numericWarning && (
                                    <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3 inline" /> ⚠ Numeric value may have changed — review carefully before running
                                    </p>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button onClick={runOperation} disabled={running}>
                          <Play className="h-4 w-4 mr-2" />
                          Looks good — run on all {totalMatched} assets
                        </Button>
                        <Button variant="outline" onClick={() => setPreviewRows(null)}>Cancel</Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Section 4: Progress */}
        {running && (
          <Card className="bg-card border-border">
            <CardContent className="pt-4 space-y-2">
              <p className="text-sm text-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Processing asset {runProgress.current} of {runProgress.total}…
              </p>
              {runProgress.currentAsset && (
                <p className="text-xs text-muted-foreground">Current: {runProgress.currentAsset}</p>
              )}
              <Progress value={(runProgress.current / Math.max(runProgress.total, 1)) * 100} className="h-2" />
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => { pauseRef.current = true; setPaused(true); }}
                disabled={paused}
              >
                {paused ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Pausing…</>
                ) : (
                  <><Pause className="h-3.5 w-3.5 mr-1.5" /> Pause</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Section 4: Completion */}
        {runComplete && (
          <Card className="bg-card border-border border-emerald-500/30">
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm text-emerald-400">
                ✓ Done — {runComplete.updated} assets updated, {runComplete.skipped} skipped{runComplete.errors ? `, ${runComplete.errors} errors` : ""}.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  onClick={async () => {
                    if (!lastOp?.label) return;
                    const { data: assets } = await supabase
                      .from("teaching_assets")
                      .select("id")
                      .eq("last_bulk_fix_label", lastOp.label as string)
                      .eq("fix_status", "fix_applied");
                    if (!assets?.length) { toast.info("No assets to approve"); return; }
                    for (let i = 0; i < assets.length; i += 500) {
                      const ids = assets.slice(i, i + 500).map(a => a.id);
                      await supabase.from("teaching_assets").update({ fix_status: "fix_verified" } as any).in("id", ids);
                    }
                    toast.success(`Approved ${assets.length} assets — fix_status set to verified ✓`);
                    refetchLastOp();
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Changes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
                  onClick={runRevert}
                  disabled={reverting}
                >
                  {reverting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Undo2 className="h-3.5 w-3.5 mr-1" />}
                  Reject &amp; Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Overnight Queue Section ── */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListOrdered className="h-4 w-4" /> Overnight Queue
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Add operations in order. Hit Run Queue before bed — each operation runs automatically after the previous one completes.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recommended order card */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <p className="text-xs font-medium text-blue-300 mb-2">Recommended overnight run order:</p>
              <ol className="space-y-1.5">
                {RECOMMENDED_ORDER.map((item, idx) => (
                  <li key={item.key} className="flex items-center gap-2">
                    <span className="text-xs text-blue-400 font-mono w-4">{idx + 1}.</span>
                    <button
                      onClick={() => addToQueue(item.key)}
                      disabled={queueRunning}
                      className="text-xs text-blue-200 hover:text-blue-100 hover:underline transition-colors text-left"
                    >
                      {item.label}
                    </button>
                    <span className="text-[10px] text-muted-foreground">({item.desc})</span>
                  </li>
                ))}
              </ol>
              <p className="text-[10px] text-muted-foreground mt-2">Click any item to add it to the queue.</p>
            </div>

            {/* Queue add controls */}
            <div className="flex gap-2">
              <Select value={queueOp} onValueChange={(v) => setQueueOp(v as OperationType)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select operation to queue…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OPERATION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={!queueOp || queueRunning}
                onClick={() => { if (queueOp) { addToQueue(queueOp as OperationType); setQueueOp(""); } }}
              >
                <Plus className="h-4 w-4 mr-1" /> Add to Queue
              </Button>
            </div>

            {/* Queue list */}
            {(queueItems ?? []).length > 0 && (
              <div className="space-y-1.5">
                {(queueItems ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    <span className="text-xs font-mono text-muted-foreground w-5">#{item.queue_position}</span>
                    <span className="text-xs text-foreground flex-1">{item.operation_name}</span>
                    <Badge
                      variant={item.status === "complete" ? "default" : item.status === "running" ? "secondary" : item.status === "failed" ? "destructive" : "outline"}
                      className="text-[10px]"
                    >
                      {item.status === "running" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      {item.status}
                    </Badge>
                    {item.status === "complete" && (
                      <span className="text-[10px] text-muted-foreground">
                        {item.assets_succeeded} ok, {item.assets_errored} err
                      </span>
                    )}
                    {item.status === "running" && (
                      <span className="text-[10px] text-muted-foreground">
                        {item.assets_processed} processed
                      </span>
                    )}
                    {item.status === "failed" && item.error_summary && (
                      <span className="text-[10px] text-destructive truncate max-w-32" title={item.error_summary}>
                        {item.error_summary.slice(0, 40)}
                      </span>
                    )}
                    {/* fix_status badge */}
                    {item.status === "complete" && (
                      <Badge className="text-[9px]" style={{
                        backgroundColor: "rgba(59,130,246,0.15)",
                        color: "rgb(96,165,250)",
                      }}>fix_applied</Badge>
                    )}
                    {item.status === "failed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                        onClick={() => retryFailed(item.id)}
                      >
                        ↻ Retry
                      </Button>
                    )}
                    {item.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeFromQueue(item.id)}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Queue running progress */}
            {queueRunning && runningQueueItem && (
              <div className="space-y-2">
                <p className="text-xs text-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1.5" />
                  Running server-side: {runningQueueItem.operation_name} — {runningQueueItem.assets_processed} processed ({runningQueueItem.assets_succeeded} ok, {runningQueueItem.assets_errored} err, {runningQueueItem.assets_skipped} skipped)
                </p>
                <p className="text-[10px] text-muted-foreground">Processing continues even if you close this page.</p>
              </div>
            )}

            {/* Queue controls */}
            <div className="flex gap-2">
              <Button
                onClick={runQueue}
                disabled={pendingQueueItems.length === 0 || queueRunning || hasRunningQueueItem}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Play className="h-4 w-4 mr-1.5" />
                Run Queue ({pendingQueueItems.length} pending)
              </Button>
              {(queueItems ?? []).some(q => ["complete", "skipped", "failed"].includes(q.status)) && (
                <Button variant="outline" size="sm" onClick={clearCompleted} disabled={queueRunning}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear Completed
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Revert */}
        {lastOp && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Undo2 className="h-4 w-4" /> Revert Last Operation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Last operation: <span className="text-foreground font-medium">{lastOp.label}</span> — ran{" "}
                {lastOp.date ? format(new Date(lastOp.date as string), "MMM d, yyyy h:mm a") : "unknown"} on {lastOp.count} assets
              </p>
              <p className="text-xs text-amber-300">
                Revert is a one-time option. After reverting, the backup will be cleared.
              </p>
              <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={runRevert} disabled={reverting}>
                {reverting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Undo2 className="h-4 w-4 mr-2" />}
                Revert This Operation
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Section 6: History */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <History className="h-4 w-4" /> History
              <ChevronDown className={`h-3 w-3 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No operations run yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Operation</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Assets</TableHead>
                    <TableHead className="text-xs">Scope</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{h.label}</TableCell>
                      <TableCell className="text-xs">{format(new Date(h.date), "MMM d, h:mm a")}</TableCell>
                      <TableCell className="text-xs">{h.count}</TableCell>
                      <TableCell className="text-xs">{h.scope}</TableCell>
                      <TableCell>
                        <Badge variant={h.reverted ? "outline" : "secondary"} className="text-[10px]">
                          {h.reverted ? "Reverted" : "Applied"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </SurviveSidebarLayout>
  );
}
