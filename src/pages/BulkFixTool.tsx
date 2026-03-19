import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SurviveSidebarLayout } from "@/components/SurviveSidebarLayout";
import { useVaAccount } from "@/hooks/useVaAccount";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { resolveEffectiveRole } from "@/lib/rolePermissions";
import { useQuery } from "@tanstack/react-query";
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
import { AlertTriangle, Wrench, ChevronDown, Loader2, Undo2, History, Eye, Play } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type OperationType = "fix_entity_naming" | "find_replace_simple" | "custom_ai" | "fix_entity_perspective" | "enrich_je_rows" | "generate_supplementary_je" | "generate_flowcharts";

interface HistoryEntry {
  label: string;
  date: string;
  count: number;
  scope: string;
  reverted: boolean;
}

const BATCH_SIZE = 10;

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

export default function BulkFixTool() {
  const navigate = useNavigate();
  const { isVa, vaAccount } = useVaAccount();
  const { impersonating } = useImpersonation();
  const effectiveRole = resolveEffectiveRole(impersonating?.role, vaAccount?.role, isVa);

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
  const [runProgress, setRunProgress] = useState({ current: 0, total: 0 });
  const [runComplete, setRunComplete] = useState<{ updated: number; skipped: number } | null>(null);

  const [reverting, setReverting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  const operationLabel = useMemo(() => {
    if (operation === "fix_entity_naming") return "Fix Entity Naming (Counterparty → Company A/B)";
    if (operation === "fix_entity_perspective") return "Fix Entity Naming + Perspective (Full Correction)";
    if (operation === "find_replace_simple") return `Find & Replace: "${findText}" → "${replaceText}"`;
    if (operation === "custom_ai") return "Custom AI Rewrite";
    if (operation === "enrich_je_rows") return "Enrich JE Rows (debit_credit_reason + amount_source)";
    if (operation === "generate_supplementary_je") return "Generate Supplementary JEs (backfill)";
    if (operation === "generate_flowcharts") return "Generate Flowcharts (backfill missing)";
    return "";
  }, [operation, findText, replaceText]);

  // Build the scope query
  function buildScopeQuery() {
    let q = supabase.from("teaching_assets").select("id, asset_name, problem_context, survive_problem_text, survive_solution_text, journal_entry_completed_json, supplementary_je_json");
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
    // Replace "Survive Counterparty" with "Survive Company B"
    let result = text.replace(/Survive\s+Counterparty/gi, "Survive Company B");
    // Replace standalone "Counterparty" (not already preceded by "Survive")
    result = result.replace(/(?<!Survive\s+)Counterparty/gi, "Survive Company B");
    // Replace "the other company" / "the second party" 
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
        // AI preview: sample 3
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
        // JE enrichment preview: sample more assets to find ones that actually need enrichment
        const { data: assets, error } = await buildScopeQuery().not("journal_entry_completed_json", "is", null).limit(20);
        if (error) throw error;

        // Count total with JE data that need enrichment (we'll count client-side from larger sample)
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
              // Only show first 4 preview rows to keep UI clean
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

        // Estimate total needing enrichment based on sample ratio
        const sampleSize = (assets ?? []).length;
        const estimatedNeedEnrichment = sampleSize > 0
          ? Math.round(((assetsNeedingEnrichment / sampleSize) * (jeCount ?? 0)))
          : 0;
        setTotalMatched(estimatedNeedEnrichment > 0 ? estimatedNeedEnrichment : assetsNeedingEnrichment);

        setPreviewRows(rows);
        setIsAiPreview(true);
      } else if (operation === "generate_supplementary_je") {
        // Preview: count assets with main JE but no supplementary
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
      } else if (operation === "generate_flowcharts") {
        // Preview: count approved assets with no flowchart records
        // We check asset_flowcharts join — but simpler: check flowchart_image_url is null
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
      }
    } catch (e: any) {
      toast.error("Preview failed: " + e.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  // Run the actual operation
  async function runOperation() {
    if (!operation) return;

    // Check if there's an existing backup — warn
    if (lastOp) {
      const confirmed = window.confirm(
        "Running this will overwrite your existing backup. Make sure you don't need to revert the previous operation first. Continue?"
      );
      if (!confirmed) return;
    }

    setRunning(true);
    setRunComplete(null);

    try {
      // Fetch all assets in scope
      const { data: assets, error } = await buildScopeQuery();
      if (error) throw error;
      if (!assets?.length) { toast.info("No assets in scope."); setRunning(false); return; }

      const total = assets.length;
      setRunProgress({ current: 0, total });
      let updated = 0;
      let skipped = 0;

      // Process in batches — use smaller batch for AI-heavy JE enrichment
      const batchSize = (operation === "enrich_je_rows" || operation === "generate_supplementary_je") ? 2 : BATCH_SIZE;
      for (let i = 0; i < total; i += batchSize) {
        const batch = assets.slice(i, i + batchSize);
        const updates: Promise<void>[] = [];

        for (const asset of batch) {
          updates.push((async () => {
            // 1. Backup current values
            const backupUpdate: Record<string, any> = {
              problem_context_backup: (asset as any).problem_context || "",
              problem_text_backup: (asset as any).survive_problem_text || "",
              // problem_text_ht_backup and others go here if fields exist
              last_bulk_fix_at: new Date().toISOString(),
              last_bulk_fix_label: operationLabel,
            };

            // 2. Compute new values
            const newValues: Record<string, any> = {};
            let changed = false;

            if (operation === "find_replace_simple") {
              for (const f of FIXABLE_FIELDS) {
                if (!selectedFields.includes(f.key)) continue;
                const original = (asset as any)[f.key] || "";
                const replaced = simpleReplace(original);
                if (replaced !== original) { newValues[f.key] = replaced; changed = true; }
              }
            } else if (operation === "fix_entity_naming") {
              for (const f of FIXABLE_FIELDS) {
                const original = (asset as any)[f.key] || "";
                const replaced = entityNamingReplace(original);
                if (replaced !== original) { newValues[f.key] = replaced; changed = true; }
              }
            } else if (operation === "custom_ai" || operation === "fix_entity_perspective") {
              const aiInstruction = operation === "fix_entity_perspective"
                ? ENTITY_PERSPECTIVE_INSTRUCTION
                : customInstruction;
              const targetFields = operation === "fix_entity_perspective"
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
            } else if (operation === "enrich_je_rows") {
              // Process both journal_entry_completed_json and supplementary_je_json
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

              // If neither field had data, skip
              if (!changed) { skipped++; return; }
            } else if (operation === "generate_supplementary_je") {
              // Skip if already has supplementary JE or no main JE
              const jeJson = (asset as any).journal_entry_completed_json;
              const suppJson = (asset as any).supplementary_je_json;
              if (!jeJson || suppJson) { skipped++; return; }

              // Call the existing edge function
              const { data: result, error: fnErr } = await supabase.functions.invoke("generate-supplementary-je", {
                body: { teaching_asset_id: asset.id },
              });

              if (fnErr || !result?.success) { skipped++; return; }
              changed = true;
              // No need to update here — edge function already writes to DB
            }

            if (changed) {
              // generate_supplementary_je writes via edge function; others need explicit update
              if (operation !== "generate_supplementary_je") {
                await supabase.from("teaching_assets").update({ ...backupUpdate, ...newValues }).eq("id", asset.id);
              }
              updated++;
            } else {
              skipped++;
            }
          })());
        }

        await Promise.all(updates);
        setRunProgress({ current: Math.min(i + batchSize, total), total });
      }

      setRunComplete({ updated, skipped });
      addHistory({
        label: operationLabel,
        date: new Date().toISOString(),
        count: updated,
        scope: `${courseFilter === "all" ? "All courses" : "Filtered course"} / ${chapterFilter === "all" ? "All chapters" : "Filtered chapter"}`,
        reverted: false,
      });
      refetchLastOp();
      toast.success(`Bulk fix complete: ${updated} updated, ${skipped} skipped.`);
    } catch (e: any) {
      toast.error("Bulk fix failed: " + e.message);
    } finally {
      setRunning(false);
    }
  }

  // Revert
  async function runRevert() {
    if (!lastOp) return;
    const confirmed = window.confirm(
      "Revert is a one-time option. After reverting, the backup will be cleared. Continue?"
    );
    if (!confirmed) return;

    setReverting(true);
    try {
      // Find all assets with this label
      const { data: assets, error } = await supabase
        .from("teaching_assets")
        .select("id, problem_context_backup, problem_text_backup")
        .eq("last_bulk_fix_label", lastOp.label as string)
        .not("last_bulk_fix_at", "is", null);
      if (error) throw error;

      let reverted = 0;
      for (let i = 0; i < (assets?.length ?? 0); i += BATCH_SIZE) {
        const batch = assets!.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (asset) => {
          const revertUpdate: Record<string, any> = {
            last_bulk_fix_at: null,
            last_bulk_fix_label: null,
            problem_context_backup: null,
            problem_text_backup: null,
            problem_text_ht_backup: null,
            answer_summary_backup: null,
            worked_steps_backup: null,
          };
          if ((asset as any).problem_context_backup != null) revertUpdate.problem_context = (asset as any).problem_context_backup;
          if ((asset as any).problem_text_backup != null) revertUpdate.survive_problem_text = (asset as any).problem_text_backup;
          await supabase.from("teaching_assets").update(revertUpdate).eq("id", asset.id);
          reverted++;
        }));
      }

      // Update history
      const h = getHistory();
      const entry = h.find(e => e.label === lastOp.label && !e.reverted);
      if (entry) entry.reverted = true;
      localStorage.setItem("bulk-fix-history", JSON.stringify(h));

      refetchLastOp();
      toast.success(`Reverted ${reverted} assets to previous text.`);
    } catch (e: any) {
      toast.error("Revert failed: " + e.message);
    } finally {
      setReverting(false);
    }
  }

  function toggleField(field: FixableField) {
    setSelectedFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  }

  const history = getHistory();

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
              </SelectContent>
            </Select>

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
                          Looks good — run on all {isAiPreview ? totalMatched : totalMatched} assets
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
                Fixing asset {runProgress.current} of {runProgress.total}…
              </p>
              <Progress value={(runProgress.current / Math.max(runProgress.total, 1)) * 100} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Section 4: Completion */}
        {runComplete && (
          <Card className="bg-card border-border border-emerald-500/30">
            <CardContent className="pt-4">
              <p className="text-sm text-emerald-400">
                Fix complete. {runComplete.updated} assets updated, {runComplete.skipped} skipped (no match found).
              </p>
            </CardContent>
          </Card>
        )}

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
