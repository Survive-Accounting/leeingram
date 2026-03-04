/**
 * Parts-based variant answer schema.
 *
 * Every variant's answer is an ordered list of parts.
 * Each part is either a "text" answer or a "je" (journal entry) answer.
 */

// ── Core Types ──

export interface VariantTextPart {
  label: string;            // "a", "b", "c" — UI renders as (a), (b), (c)
  type: "text";
  final_answer: string;     // e.g. "The credit loss is $10,000."
  explanation: string;      // reasoning
  worked_steps?: string;    // optional step-by-step
  final_value?: number;     // optional numeric value
  units?: string;           // optional e.g. "USD", "%"
}

export interface JEEntry {
  date: string;
  entries: Array<{
    account: string;
    debit: number | null;
    credit: number | null;
  }>;
}

export interface VariantJEPart {
  label: string;
  type: "je";
  je_structured: JEEntry[];
}

export type VariantPart = VariantTextPart | VariantJEPart;

// ── Helpers ──

export function isTextPart(p: VariantPart): p is VariantTextPart {
  return p.type === "text";
}

export function isJEPart(p: VariantPart): p is VariantJEPart {
  return p.type === "je";
}

export function formatPartLabel(label: string): string {
  return `(${label})`;
}

// ── Legacy Normalizer ──

/**
 * Convert older variant data structures into the unified parts[] schema.
 *
 * Handles:
 * 1. Variants that already have parts_json  → passthrough
 * 2. answer_parts_json (NON_JE text parts)  → map to VariantTextPart[]
 * 3. journal_entry_completed_json only      → wrap as single VariantJEPart
 * 4. Both answer_parts + JE data (hybrid)   → merge
 * 5. answer_only string (legacy)            → single text part
 * 6. candidate_data with answer_parts       → extract and convert
 */
export function normalizeToParts(variant: Record<string, any>): VariantPart[] {
  // 1. Already has parts
  if (Array.isArray(variant.parts_json) && variant.parts_json.length > 0) {
    return variant.parts_json as VariantPart[];
  }

  const parts: VariantPart[] = [];

  // Check candidate_data.parts first (parts-based format stored in candidate_data)
  if (Array.isArray(variant.candidate_data?.parts) && variant.candidate_data.parts.length > 0) {
    return variant.candidate_data.parts as VariantPart[];
  }

  // Extract answer_parts from various locations
  const answerParts: any[] | null =
    variant.answer_parts_json ??
    variant.candidate_data?.answer_parts ??
    null;

  // Extract JE data from various locations
  const jeCompleted: any =
    variant.journal_entry_completed_json ??
    variant.candidate_data?.journal_entry_completed_json ??
    variant.candidate_data?.scenario_sections ??
    null;

  // 2. Has answer_parts (text/numeric parts)
  if (Array.isArray(answerParts) && answerParts.length > 0) {
    for (const ap of answerParts) {
      parts.push({
        label: ap.label || String.fromCharCode(97 + parts.length), // a, b, c...
        type: "text",
        final_answer: ap.final_answer || ap.answer || "",
        explanation: ap.explanation || ap.steps || "",
        worked_steps: ap.worked_steps || ap.steps || undefined,
        final_value: ap.final_value != null ? Number(ap.final_value) : undefined,
        units: ap.units || undefined,
      });
    }
  }

  // 3. Has JE data → convert to JE part(s)
  if (jeCompleted) {
    const jeParts = convertJEToJEParts(jeCompleted, parts.length);
    parts.push(...jeParts);
  }

  // 4. Legacy answer_only string fallback
  if (parts.length === 0 && variant.answer_only) {
    parts.push({
      label: "a",
      type: "text",
      final_answer: String(variant.answer_only),
      explanation: "",
    });
  }

  // 5. Legacy candidate_data.final_answers
  if (parts.length === 0 && Array.isArray(variant.candidate_data?.final_answers)) {
    for (const fa of variant.candidate_data.final_answers) {
      parts.push({
        label: fa.label || String.fromCharCode(97 + parts.length),
        type: "text",
        final_answer: String(fa.value ?? fa.final_answer ?? ""),
        explanation: "",
        final_value: typeof fa.value === "number" ? fa.value : undefined,
        units: fa.unit || undefined,
      });
    }
  }

  return parts;
}

function convertJEToJEParts(jeData: any, existingPartCount: number): VariantJEPart[] {
  // Handle scenario_sections format (canonical)
  const sections: any[] =
    jeData?.scenario_sections ??
    (Array.isArray(jeData) ? jeData : null) ??
    [];

  if (sections.length === 0) return [];

  // Each scenario section becomes its own JE part
  return sections.map((section: any, i: number) => {
    const entriesByDate = section.entries_by_date ?? section.journal_entries ?? [];

    const jeStructured: JEEntry[] = entriesByDate.map((entry: any) => ({
      date: entry.date || entry.entry_date || "Undated",
      entries: (entry.rows || entry.lines || []).map((row: any) => ({
        account: row.account_name || row.account || "",
        debit: row.debit != null ? Number(row.debit) : null,
        credit: row.credit != null ? Number(row.credit) : null,
      })),
    }));

    return {
      label: String.fromCharCode(97 + existingPartCount + i), // continue labeling
      type: "je" as const,
      je_structured: jeStructured,
    };
  });
}

/**
 * Convert parts[] back into legacy fields for backwards compatibility.
 * Useful when persisting to DB fields that other code still reads.
 */
export function partsToLegacyFields(parts: VariantPart[]): {
  answer_parts_json: any[] | null;
  journal_entry_completed_json: any | null;
} {
  const textParts = parts.filter(isTextPart);
  const jeParts = parts.filter(isJEPart);

  const answer_parts_json = textParts.length > 0
    ? textParts.map(p => ({
        label: p.label,
        final_answer: p.final_answer,
        explanation: p.explanation,
        steps: p.worked_steps || p.explanation,
        worked_steps: p.worked_steps,
        final_value: p.final_value,
        units: p.units,
      }))
    : null;

  let journal_entry_completed_json: any = null;
  if (jeParts.length > 0) {
    journal_entry_completed_json = {
      scenario_sections: jeParts.map(jp => ({
        label: `Part ${jp.label}`,
        entries_by_date: jp.je_structured.map(je => ({
          date: je.date,
          rows: je.entries.map(e => ({
            account_name: e.account,
            debit: e.debit,
            credit: e.credit,
          })),
        })),
      })),
    };
  }

  return { answer_parts_json, journal_entry_completed_json };
}
