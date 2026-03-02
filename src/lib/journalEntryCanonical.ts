export interface PersistedJERow {
  account_name: string;
  debit: number | null;
  credit: number | null;
}

export interface PersistedJEEntryByDate {
  date: string;
  rows: PersistedJERow[];
}

export interface PersistedJEScenarioSection {
  label: string;
  entries_by_date: PersistedJEEntryByDate[];
}

export interface PersistedJEPayload {
  scenario_sections: PersistedJEScenarioSection[];
}

function toWholeDollars(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, "").trim());
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) < 0.0001) return null;
  return Math.round(Math.abs(n));
}

function normalizeRow(raw: any): PersistedJERow | null {
  const account_name = String(raw?.account_name ?? raw?.account ?? "").trim();
  if (!account_name) return null;

  let debit = toWholeDollars(raw?.debit);
  let credit = toWholeDollars(raw?.credit);

  const hasDebit = debit !== null;
  const hasCredit = credit !== null;

  if (hasDebit && hasCredit) {
    if ((debit ?? 0) >= (credit ?? 0)) {
      credit = null;
    } else {
      debit = null;
    }
  } else if (!hasDebit && !hasCredit) {
    const amount = toWholeDollars(raw?.amount);
    if (amount === null) return null;
    const side = String(raw?.side ?? "debit").toLowerCase();
    if (side === "credit" || side === "cr") {
      credit = amount;
      debit = null;
    } else {
      debit = amount;
      credit = null;
    }
  }

  return { account_name, debit, credit };
}

function normalizeEntry(entry: any): PersistedJEEntryByDate | null {
  const date = String(entry?.date ?? entry?.entry_date ?? "").trim() || "Undated";
  const rows = (entry?.rows ?? entry?.lines ?? [])
    .map(normalizeRow)
    .filter((row: PersistedJERow | null): row is PersistedJERow => row !== null);

  if (rows.length === 0) return null;
  return { date, rows };
}

function normalizeScenarioSection(section: any): PersistedJEScenarioSection | null {
  const label = String(section?.label ?? section?.scenario_label ?? "Main").trim() || "Main";
  const entries_by_date = (section?.entries_by_date ?? section?.journal_entries ?? [])
    .map(normalizeEntry)
    .filter((entry: PersistedJEEntryByDate | null): entry is PersistedJEEntryByDate => entry !== null);

  if (entries_by_date.length === 0) return null;
  return { label, entries_by_date };
}

export function normalizeJournalEntryCompletedJson(input: any): PersistedJEPayload | null {
  const rawSections = input?.scenario_sections ?? input?.teaching_aids?.scenario_sections ?? [];
  if (!Array.isArray(rawSections) || rawSections.length === 0) return null;

  const scenario_sections = rawSections
    .map(normalizeScenarioSection)
    .filter((section: PersistedJEScenarioSection | null): section is PersistedJEScenarioSection => section !== null);

  if (scenario_sections.length === 0) return null;
  return { scenario_sections };
}

export function buildJournalEntryTemplateFromCompleted(completed: PersistedJEPayload | null): PersistedJEPayload | null {
  if (!completed) return null;

  return {
    scenario_sections: completed.scenario_sections.map((section) => ({
      label: section.label,
      entries_by_date: section.entries_by_date.map((entry) => ({
        date: entry.date,
        rows: entry.rows.map((row) => ({
          account_name: row.account_name,
          debit: null,
          credit: null,
        })),
      })),
    })),
  };
}

export function getJournalEntryCounts(completed: PersistedJEPayload | null): {
  scenario_sections_count: number;
  entries_by_date_count: number;
  rows_count: number;
} {
  if (!completed) {
    return { scenario_sections_count: 0, entries_by_date_count: 0, rows_count: 0 };
  }

  const scenario_sections_count = completed.scenario_sections.length;
  let entries_by_date_count = 0;
  let rows_count = 0;

  for (const section of completed.scenario_sections) {
    entries_by_date_count += section.entries_by_date.length;
    for (const entry of section.entries_by_date) {
      rows_count += entry.rows.length;
    }
  }

  return { scenario_sections_count, entries_by_date_count, rows_count };
}

export function normalizeCandidateJournalEntry(candidate: any): any {
  const normalizedCompleted = normalizeJournalEntryCompletedJson(
    candidate?.journal_entry_completed_json ?? candidate?.je_structured ?? null
  );

  return {
    ...candidate,
    journal_entry_completed_json: normalizedCompleted,
    journal_entry_template_json: buildJournalEntryTemplateFromCompleted(normalizedCompleted),
  };
}
