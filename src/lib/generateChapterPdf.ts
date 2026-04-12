/**
 * generateChapterPdf — Client-side PDF generation for a chapter's approved content.
 * Uses jsPDF (already in deps).
 */
import jsPDF from "jspdf";

// ── Types ────────────────────────────────────────────────────────

interface PurposeData {
  purpose_bullets: string[] | null;
  consequence_bullets: string[] | null;
}

interface KeyTerm {
  term: string;
  definition: string;
  category: string | null;
}

interface Account {
  account_name: string;
  account_type: string;
  normal_balance: string;
  account_description: string;
}

interface Formula {
  formula_name: string;
  formula_expression: string;
  formula_explanation: string | null;
  sort_order: number;
}

interface JECategory {
  id: string;
  category_name: string;
  sort_order: number;
}

interface JEEntry {
  transaction_label: string;
  category_id: string | null;
  je_lines: { account: string; side: "debit" | "credit" }[];
  sort_order: number;
}

interface Mistake {
  mistake: string;
  explanation: string | null;
  sort_order: number;
}

interface MemoryItem {
  title: string;
  subtitle: string | null;
  item_type: string;
  items: any[];
  sort_order: number | null;
}

export interface ChapterPdfData {
  chapterName: string;
  chapterNumber: number;
  courseCode: string;
  courseName: string;
  purpose: PurposeData | null;
  keyTerms: KeyTerm[];
  accounts: Account[];
  formulas: Formula[];
  jeCategories: JECategory[];
  jeEntries: JEEntry[];
  mistakes: Mistake[];
  memoryItems?: MemoryItem[];
}

// ── Constants ────────────────────────────────────────────────────

const NAVY = "#14213D";
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const PAGE_WIDTH = 210; // A4
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const LINE_HEIGHT = 6; // 6mm minimum
const FOOTER_Y = 285;

const ACCOUNT_TYPE_ORDER = ["Assets", "Liabilities", "Equity", "Revenue", "Expenses"];
const ACCOUNT_TYPE_LABELS: Record<string, string[]> = {
  Assets: ["current_asset", "non_current_asset", "contra_asset"],
  Liabilities: ["current_liability", "non_current_liability", "contra_liability"],
  Equity: ["equity", "contra_equity"],
  Revenue: ["revenue", "contra_revenue"],
  Expenses: ["expense", "contra_expense"],
};

// JE column positions
const JE_COL_ACCOUNT = MARGIN_LEFT + 5;
const JE_COL_DEBIT = MARGIN_LEFT + 125; // 120mm account col + 5mm indent
const JE_COL_CREDIT = MARGIN_LEFT + 150; // 25mm debit col

// ── Helpers ──────────────────────────────────────────────────────

function addFooter(doc: jsPDF, chapterName: string, pageNum: number) {
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Survive Accounting — surviveaccounting.com", MARGIN_LEFT, FOOTER_Y);
  doc.text(chapterName, PAGE_WIDTH / 2, FOOTER_Y, { align: "center" });
  doc.text(`${pageNum}`, PAGE_WIDTH - MARGIN_RIGHT, FOOTER_Y, { align: "right" });
}

function ensureSpace(doc: jsPDF, y: number, needed: number, chapterName: string, pageRef: { num: number }): number {
  if (y + needed > FOOTER_Y - 10) {
    addFooter(doc, chapterName, pageRef.num);
    doc.addPage();
    pageRef.num++;
    return 20;
  }
  return y;
}

function sectionHeader(doc: jsPDF, y: number, title: string, chapterName: string, pageRef: { num: number }): number {
  y += 10; // 10mm gap before section header
  y = ensureSpace(doc, y, 20, chapterName, pageRef);
  doc.setFontSize(13);
  doc.setTextColor(NAVY);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN_LEFT, y);
  y += 2;
  doc.setDrawColor(NAVY);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 6; // 6mm gap after section header
  return y;
}

function bodyText(doc: jsPDF) {
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "normal");
}

function renderWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, chapterName: string, pageRef: { num: number }, lineHeight = LINE_HEIGHT): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight, chapterName, pageRef);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

// ── Shared builder ───────────────────────────────────────────────

export function buildPdfContent(doc: jsPDF, data: ChapterPdfData, pageRef: { num: number }, options?: {
  includePurpose?: boolean;
  includeKeyTerms?: boolean;
  includeAccounts?: boolean;
  includeFormulas?: boolean;
  includeMemoryItems?: boolean;
  includeJEs?: boolean;
  includeMistakes?: boolean;
}) {
  const opts = {
    includePurpose: true,
    includeKeyTerms: true,
    includeAccounts: true,
    includeFormulas: true,
    includeMemoryItems: true,
    includeJEs: true,
    includeMistakes: true,
    ...options,
  };

  let y = 25;

  // ── Title page header ──
  doc.setFontSize(20);
  doc.setTextColor(NAVY);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(`Chapter ${data.chapterNumber}: ${data.chapterName}`, CONTENT_WIDTH);
  for (const line of titleLines) {
    doc.text(line, MARGIN_LEFT, y);
    y += 8;
  }
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`${data.courseCode} — ${data.courseName}`, MARGIN_LEFT, y);
  y += 12;

  // ── 1. What's the Point ──
  if (opts.includePurpose) {
    const purposeBullets = (data.purpose?.purpose_bullets || []).filter(Boolean);
    const consequenceBullets = (data.purpose?.consequence_bullets || []).filter(Boolean);
    if (purposeBullets.length > 0 || consequenceBullets.length > 0) {
      y = sectionHeader(doc, y, "What's the Point?", data.chapterName, pageRef);

      if (purposeBullets.length > 0) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(NAVY);
        doc.text("Why this chapter matters:", MARGIN_LEFT, y);
        y += LINE_HEIGHT;
        bodyText(doc);
        for (const bullet of purposeBullets) {
          y = renderWrappedText(doc, `• ${bullet}`, MARGIN_LEFT + 3, y, CONTENT_WIDTH - 5, data.chapterName, pageRef);
        }
        y += 3;
      }

      if (consequenceBullets.length > 0) {
        y = ensureSpace(doc, y, 10, data.chapterName, pageRef);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(NAVY);
        doc.text("What goes wrong if ignored:", MARGIN_LEFT, y);
        y += LINE_HEIGHT;
        bodyText(doc);
        for (const bullet of consequenceBullets) {
          y = renderWrappedText(doc, `• ${bullet}`, MARGIN_LEFT + 3, y, CONTENT_WIDTH - 5, data.chapterName, pageRef);
        }
      }
      y += 5;
    }
  }

  // ── 2. Key Terms ──
  if (opts.includeKeyTerms && data.keyTerms.length > 0) {
    y = sectionHeader(doc, y, "Key Terms", data.chapterName, pageRef);

    // Group by category
    const categories = new Map<string, KeyTerm[]>();
    for (const kt of data.keyTerms) {
      const cat = kt.category || "General";
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(kt);
    }

    for (const [cat, terms] of categories) {
      // Category subheader
      if (categories.size > 1) {
        y = ensureSpace(doc, y, 12, data.chapterName, pageRef);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(NAVY);
        doc.text(cat, MARGIN_LEFT, y);
        // Underline the category name
        const catWidth = doc.getTextWidth(cat);
        doc.setDrawColor(NAVY);
        doc.setLineWidth(0.3);
        doc.line(MARGIN_LEFT, y + 1, MARGIN_LEFT + catWidth, y + 1);
        y += LINE_HEIGHT + 2;
      }

      bodyText(doc);
      for (const t of terms) {
        const defLines = doc.splitTextToSize(t.definition, CONTENT_WIDTH - 30);
        const needed = LINE_HEIGHT + defLines.length * LINE_HEIGHT + 3;
        y = ensureSpace(doc, y, needed, data.chapterName, pageRef);
        doc.setFont("helvetica", "bold");
        doc.text(t.term, MARGIN_LEFT + 2, y);
        y += LINE_HEIGHT;
        doc.setFont("helvetica", "normal");
        for (const line of defLines) {
          y = ensureSpace(doc, y, LINE_HEIGHT, data.chapterName, pageRef);
          doc.text(line, MARGIN_LEFT + 4, y);
          y += LINE_HEIGHT;
        }
        y += 2;
      }
      y += 6; // 6mm gap between categories
    }
  }

  // ── 3. Accounts ──
  if (opts.includeAccounts && data.accounts.length > 0) {
    y = sectionHeader(doc, y, "Accounts", data.chapterName, pageRef);

    for (const groupName of ACCOUNT_TYPE_ORDER) {
      const subTypes = ACCOUNT_TYPE_LABELS[groupName] || [];
      const groupAccounts = data.accounts.filter(a => subTypes.includes(a.account_type));
      if (groupAccounts.length === 0) continue;

      y = ensureSpace(doc, y, 12, data.chapterName, pageRef);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(NAVY);
      doc.text(groupName.toUpperCase(), MARGIN_LEFT, y);
      y += LINE_HEIGHT + 1;

      bodyText(doc);
      for (const acc of groupAccounts) {
        const descLines = doc.splitTextToSize(acc.account_description, CONTENT_WIDTH - 10);
        const needed = LINE_HEIGHT + descLines.length * LINE_HEIGHT + 4;
        y = ensureSpace(doc, y, needed, data.chapterName, pageRef);

        doc.setFont("helvetica", "bold");
        doc.text(acc.account_name, MARGIN_LEFT + 3, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const balanceText = `Normal balance: ${acc.normal_balance}`;
        const nameWidth = doc.getTextWidth(acc.account_name);
        doc.text(balanceText, MARGIN_LEFT + 3 + nameWidth + 4, y);
        doc.setTextColor(40, 40, 40);
        y += LINE_HEIGHT;
        for (const line of descLines) {
          y = ensureSpace(doc, y, LINE_HEIGHT, data.chapterName, pageRef);
          doc.text(line, MARGIN_LEFT + 5, y);
          y += LINE_HEIGHT;
        }
        y += 2;
      }
      y += 3;
    }
  }

  // ── 4. Formulas ──
  if (opts.includeFormulas && data.formulas.length > 0) {
    y = sectionHeader(doc, y, "Formulas", data.chapterName, pageRef);

    bodyText(doc);
    for (const f of data.formulas) {
      const expLines = doc.splitTextToSize(f.formula_expression, CONTENT_WIDTH - 10);
      const explLines = f.formula_explanation ? doc.splitTextToSize(f.formula_explanation, CONTENT_WIDTH - 10) : [];
      const needed = LINE_HEIGHT + expLines.length * LINE_HEIGHT + explLines.length * LINE_HEIGHT + 6;
      y = ensureSpace(doc, y, needed, data.chapterName, pageRef);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(NAVY);
      doc.text(f.formula_name, MARGIN_LEFT + 2, y);
      y += LINE_HEIGHT;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      for (const line of expLines) {
        y = ensureSpace(doc, y, LINE_HEIGHT, data.chapterName, pageRef);
        doc.text(line, MARGIN_LEFT + 5, y);
        y += LINE_HEIGHT;
      }

      if (explLines.length > 0) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);
        for (const line of explLines) {
          y = ensureSpace(doc, y, LINE_HEIGHT, data.chapterName, pageRef);
          doc.text(line, MARGIN_LEFT + 5, y);
          y += LINE_HEIGHT;
        }
        doc.setFontSize(10);
      }
      y += 3;
    }
  }

  // ── 4.5. Memory Items ──
  if (opts.includeMemoryItems && data.memoryItems && data.memoryItems.length > 0) {
    y = sectionHeader(doc, y, "Memory Items", data.chapterName, pageRef);

    bodyText(doc);
    for (const mi of data.memoryItems) {
      // Title
      const titleNeeded = LINE_HEIGHT * 2 + (mi.subtitle ? LINE_HEIGHT : 0) + 8;
      y = ensureSpace(doc, y, titleNeeded, data.chapterName, pageRef);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      y = renderWrappedText(doc, mi.title, MARGIN_LEFT + 2, y, CONTENT_WIDTH - 5, data.chapterName, pageRef);

      // Subtitle
      if (mi.subtitle) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        y = renderWrappedText(doc, mi.subtitle, MARGIN_LEFT + 2, y, CONTENT_WIDTH - 5, data.chapterName, pageRef);
      }

      y += 2;

      // Items as numbered list
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      const items = Array.isArray(mi.items) ? mi.items : [];
      items.forEach((item: any, idx: number) => {
        const label = typeof item === "string" ? item : (item?.label || item?.text || JSON.stringify(item));
        const itemText = `${idx + 1}. ${label}`;
        y = renderWrappedText(doc, itemText, MARGIN_LEFT + 5, y, CONTENT_WIDTH - 10, data.chapterName, pageRef);
      });

      y += 8; // 8mm gap between memory items
    }
  }

  // ── 5. Journal Entries ──
  if (opts.includeJEs && data.jeEntries.length > 0) {
    y = sectionHeader(doc, y, "Journal Entries", data.chapterName, pageRef);

    // Group by category
    const catMap = new Map<string, JECategory>();
    for (const c of data.jeCategories) catMap.set(c.id, c);

    const uncategorized: JEEntry[] = [];
    const byCat = new Map<string, JEEntry[]>();
    for (const je of data.jeEntries) {
      if (je.category_id && catMap.has(je.category_id)) {
        if (!byCat.has(je.category_id)) byCat.set(je.category_id, []);
        byCat.get(je.category_id)!.push(je);
      } else {
        uncategorized.push(je);
      }
    }

    const sortedCats = [...data.jeCategories].sort((a, b) => a.sort_order - b.sort_order);

    const renderJE = (je: JEEntry) => {
      const lines: { account: string; side: "debit" | "credit" }[] = Array.isArray(je.je_lines) ? je.je_lines : [];
      const rowCount = lines.length || 1;
      const needed = LINE_HEIGHT + rowCount * LINE_HEIGHT + 10;
      y = ensureSpace(doc, y, needed, data.chapterName, pageRef);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(10);
      y = renderWrappedText(doc, je.transaction_label, MARGIN_LEFT + 3, y, CONTENT_WIDTH - 5, data.chapterName, pageRef);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      // Header row
      doc.setTextColor(100, 100, 100);
      doc.text("Account", JE_COL_ACCOUNT, y);
      doc.text("Debit", JE_COL_DEBIT, y, { align: "right" });
      doc.text("Credit", JE_COL_CREDIT, y, { align: "right" });
      y += 1;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(JE_COL_ACCOUNT, y, JE_COL_CREDIT + 10, y);
      y += LINE_HEIGHT - 1;

      doc.setTextColor(40, 40, 40);
      for (const line of lines) {
        y = ensureSpace(doc, y, LINE_HEIGHT, data.chapterName, pageRef);
        const isCredit = line.side === "credit";
        const accountText = isCredit ? `    ${line.account}` : line.account;
        // Wrap long account names within the 120mm column
        const acctLines = doc.splitTextToSize(accountText, 115);
        for (let i = 0; i < acctLines.length; i++) {
          if (i > 0) y = ensureSpace(doc, y, LINE_HEIGHT, data.chapterName, pageRef);
          doc.text(acctLines[i], JE_COL_ACCOUNT, y);
          if (i === 0) {
            doc.text(isCredit ? "" : "???", JE_COL_DEBIT, y, { align: "right" });
            doc.text(isCredit ? "???" : "", JE_COL_CREDIT, y, { align: "right" });
          }
          y += LINE_HEIGHT;
        }
      }
      y += 8; // 8mm gap between JE entries
    };

    for (const cat of sortedCats) {
      const entries = byCat.get(cat.id);
      if (!entries || entries.length === 0) continue;

      y = ensureSpace(doc, y, 14, data.chapterName, pageRef);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(NAVY);
      doc.text(cat.category_name, MARGIN_LEFT, y);
      y += LINE_HEIGHT + 2;

      const sorted = [...entries].sort((a, b) => a.sort_order - b.sort_order);
      for (const je of sorted) renderJE(je);
      y += 4; // extra 4mm on top of 8mm per-entry = 12mm between categories
    }

    if (uncategorized.length > 0) {
      const sorted = [...uncategorized].sort((a, b) => a.sort_order - b.sort_order);
      for (const je of sorted) renderJE(je);
    }
  }

  // ── 6. Common Exam Mistakes ──
  if (opts.includeMistakes && data.mistakes.length > 0) {
    y = sectionHeader(doc, y, "Common Exam Mistakes", data.chapterName, pageRef);

    const rankLabels = ["#1 — Most Dangerous", "#2 — Most Common", "#3 — Most Subtle"];
    const sorted = [...data.mistakes].sort((a, b) => a.sort_order - b.sort_order);

    bodyText(doc);
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      const mistakeLines = doc.splitTextToSize(m.mistake, CONTENT_WIDTH - 10);
      const explLines = m.explanation ? doc.splitTextToSize(m.explanation, CONTENT_WIDTH - 10) : [];
      const needed = LINE_HEIGHT * 2 + mistakeLines.length * LINE_HEIGHT + explLines.length * LINE_HEIGHT + 6;
      y = ensureSpace(doc, y, needed, data.chapterName, pageRef);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(NAVY);
      doc.setFontSize(10);
      doc.text(rankLabels[i] || `#${i + 1}`, MARGIN_LEFT + 2, y);
      y += LINE_HEIGHT;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      for (const line of mistakeLines) {
        y = ensureSpace(doc, y, LINE_HEIGHT, data.chapterName, pageRef);
        doc.text(line, MARGIN_LEFT + 5, y);
        y += LINE_HEIGHT;
      }

      if (explLines.length > 0) {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(9);
        for (const line of explLines) {
          y = ensureSpace(doc, y, LINE_HEIGHT, data.chapterName, pageRef);
          doc.text(line, MARGIN_LEFT + 5, y);
          y += LINE_HEIGHT;
        }
        doc.setFontSize(10);
      }
      y += 5;
    }
  }

  // Final footer
  addFooter(doc, data.chapterName, pageRef.num);
  return y;
}

// ── Public API ───────────────────────────────────────────────────

export function generateChapterPdf(data: ChapterPdfData) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageRef = { num: 1 };
  buildPdfContent(doc, data, pageRef);

  const safeName = data.chapterName.replace(/[^a-zA-Z0-9]/g, "");
  const filename = `SA_${data.courseCode}_Ch${data.chapterNumber}_${safeName}.pdf`;
  doc.save(filename);
}

/** Returns a Blob instead of triggering download — used for bulk zip export */
export function generateChapterPdfBlob(data: ChapterPdfData): { blob: Blob; filename: string } {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageRef = { num: 1 };
  buildPdfContent(doc, data, pageRef);

  const safeName = data.chapterName.replace(/[^a-zA-Z0-9]/g, "");
  const filename = `SA_${data.courseCode}_Ch${data.chapterNumber}_${safeName}.pdf`;
  return { blob: doc.output("blob"), filename };
}

// ── Tutor Prep Pack ─────────────────────────────────────────────

export interface TutorPrepPackOptions {
  chapterData: ChapterPdfData;
  sections: {
    purpose: boolean;
    memoryItems: boolean;
    keyTerms: boolean;
    formulas: boolean;
    jes: boolean;
    mistakes: boolean;
    accounts: boolean;
  };
  problems: {
    asset_name: string;
    source_ref: string;
    problem_text: string;
    instructions: string;
    solution_text: string;
    je_data: any[] | null;
    problem_screenshot_url: string | null;
    solution_screenshot_url: string | null;
  }[];
  problemFormat: "blank" | "with_solution" | "both";
}

const ASSET_TYPE_ORDER = ["BE", "QS", "EX", "P"];

function assetTypeSort(ref: string): number {
  const prefix = ref.replace(/[0-9.]/g, "").toUpperCase();
  const idx = ASSET_TYPE_ORDER.indexOf(prefix);
  return idx >= 0 ? idx : 99;
}

function sortProblems(problems: TutorPrepPackOptions["problems"]): TutorPrepPackOptions["problems"] {
  return [...problems].sort((a, b) => {
    const ta = assetTypeSort(a.source_ref);
    const tb = assetTypeSort(b.source_ref);
    if (ta !== tb) return ta - tb;
    // Numeric sort within type
    const na = parseFloat(a.source_ref.replace(/[^0-9.]/g, "")) || 0;
    const nb = parseFloat(b.source_ref.replace(/[^0-9.]/g, "")) || 0;
    return na - nb;
  });
}

function addPrepPackFooter(doc: jsPDF, chapterNumber: number, chapterName: string, pageNum: number) {
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Survive Accounting · Ch ${chapterNumber} — ${chapterName} · Page ${pageNum}`, PAGE_WIDTH / 2, FOOTER_Y, { align: "center" });
}

function renderProblemPage(doc: jsPDF, prob: TutorPrepPackOptions["problems"][0], chapterNumber: number, chapterName: string, pageRef: { num: number }, includeWorkspace: boolean, includeSolution: boolean) {
  doc.addPage();
  pageRef.num++;
  let y = 20;

  const footerLabel = `Ch ${chapterNumber} — ${chapterName}`;

  // Problem identifier
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY);
  const titleText = prob.source_ref + (prob.problem_text ? " — " + prob.problem_text.substring(0, 60) : "");
  const titleLines = doc.splitTextToSize(titleText, CONTENT_WIDTH);
  for (const line of titleLines) {
    doc.text(line, MARGIN_LEFT, y);
    y += 7;
  }

  // Divider
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(0.8);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 6;

  // PROBLEM section
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY);
  doc.text("PROBLEM:", MARGIN_LEFT, y);
  y += LINE_HEIGHT;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  if (prob.problem_text) {
    y = renderWrappedText(doc, prob.problem_text, MARGIN_LEFT, y, CONTENT_WIDTH, footerLabel, pageRef);
  }
  y += 4;

  // INSTRUCTIONS section
  if (prob.instructions) {
    y = ensureSpace(doc, y, 12, footerLabel, pageRef);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(NAVY);
    doc.text("INSTRUCTIONS:", MARGIN_LEFT, y);
    y += LINE_HEIGHT;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);

    // Split instructions by lettered parts
    const parts = prob.instructions.split(/(?=\([a-z]\))/i).filter(Boolean);
    let partCount = 0;
    for (const part of parts) {
      y = renderWrappedText(doc, part.trim(), MARGIN_LEFT + 3, y, CONTENT_WIDTH - 6, footerLabel, pageRef);
      partCount++;
      y += 2;
    }

    // Workspace
    if (includeWorkspace) {
      y += 4;
      y = ensureSpace(doc, y, 12, footerLabel, pageRef);
      doc.setDrawColor(40, 40, 40);
      doc.setLineWidth(0.8);
      doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(NAVY);
      doc.text("WORK SPACE:", MARGIN_LEFT, y);
      y += LINE_HEIGHT;

      // 6 blank lines per instruction part
      const blankLines = Math.max(partCount, 1) * 6;
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.1);
      for (let i = 0; i < blankLines; i++) {
        y = ensureSpace(doc, y, LINE_HEIGHT, footerLabel, pageRef);
        doc.line(MARGIN_LEFT, y + 2, PAGE_WIDTH - MARGIN_RIGHT, y + 2);
        y += LINE_HEIGHT;
      }
    }
  }

  // Solution
  if (includeSolution) {
    y += 4;
    y = ensureSpace(doc, y, 12, footerLabel, pageRef);
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.8);
    doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
    y += 6;

    if (prob.solution_text) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(NAVY);
      doc.text("EXPLANATION:", MARGIN_LEFT, y);
      y += LINE_HEIGHT;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(10);
      y = renderWrappedText(doc, prob.solution_text, MARGIN_LEFT, y, CONTENT_WIDTH, footerLabel, pageRef);
      y += 4;
    }

    // JE data table
    const jeLines = Array.isArray(prob.je_data) ? prob.je_data : [];
    if (jeLines.length > 0) {
      y = ensureSpace(doc, y, 12, footerLabel, pageRef);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(NAVY);
      doc.setFontSize(10);
      doc.text("JOURNAL ENTRIES:", MARGIN_LEFT, y);
      y += LINE_HEIGHT;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text("Account", JE_COL_ACCOUNT, y);
      doc.text("Debit", JE_COL_DEBIT, y, { align: "right" });
      doc.text("Credit", JE_COL_CREDIT, y, { align: "right" });
      y += 1;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(JE_COL_ACCOUNT, y, JE_COL_CREDIT + 10, y);
      y += LINE_HEIGHT - 1;

      doc.setTextColor(40, 40, 40);
      for (const line of jeLines) {
        y = ensureSpace(doc, y, LINE_HEIGHT, footerLabel, pageRef);
        const acct = line.account || "";
        const side = line.side || "debit";
        const amount = line.amount || "???";
        const isCredit = side === "credit";
        doc.text(isCredit ? `    ${acct}` : acct, JE_COL_ACCOUNT, y);
        doc.text(isCredit ? "" : String(amount), JE_COL_DEBIT, y, { align: "right" });
        doc.text(isCredit ? String(amount) : "", JE_COL_CREDIT, y, { align: "right" });
        y += LINE_HEIGHT;
      }
    }
  }

  addPrepPackFooter(doc, chapterNumber, chapterName, pageRef.num);
}

export function generateTutorPrepPack(opts: TutorPrepPackOptions) {
  const { chapterData, sections, problems, problemFormat } = opts;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageRef = { num: 1 };

  // ── Cover page ──
  let y = 80;
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY);
  doc.text("Tutor Prep Pack", MARGIN_LEFT, y);
  y += 14;
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(`Chapter ${chapterData.chapterNumber}: ${chapterData.chapterName}`, MARGIN_LEFT, y);
  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`${chapterData.courseCode} — ${chapterData.courseName}`, MARGIN_LEFT, y);
  y += 16;
  doc.setFontSize(11);
  doc.setTextColor(NAVY);
  doc.text("Survive Accounting · surviveaccounting.com", MARGIN_LEFT, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, MARGIN_LEFT, y);

  addPrepPackFooter(doc, chapterData.chapterNumber, chapterData.chapterName, pageRef.num);

  // ── Chapter content sections ──
  const hasAnySections = Object.values(sections).some(Boolean);
  if (hasAnySections) {
    doc.addPage();
    pageRef.num++;
    buildPdfContent(doc, chapterData, pageRef, {
      includePurpose: sections.purpose,
      includeKeyTerms: sections.keyTerms,
      includeAccounts: sections.accounts,
      includeFormulas: sections.formulas,
      includeMemoryItems: sections.memoryItems,
      includeJEs: sections.jes,
      includeMistakes: sections.mistakes,
    });
  }

  // ── Practice Problems ──
  const sorted = sortProblems(problems);
  for (const prob of sorted) {
    if (problemFormat === "blank" || problemFormat === "both") {
      renderProblemPage(doc, prob, chapterData.chapterNumber, chapterData.chapterName, pageRef, true, false);
    }
    if (problemFormat === "with_solution") {
      renderProblemPage(doc, prob, chapterData.chapterNumber, chapterData.chapterName, pageRef, false, true);
    }
    if (problemFormat === "both") {
      renderProblemPage(doc, prob, chapterData.chapterNumber, chapterData.chapterName, pageRef, false, true);
    }
  }

  // Final footer on last page
  addPrepPackFooter(doc, chapterData.chapterNumber, chapterData.chapterName, pageRef.num);

  const safeName = chapterData.chapterName.replace(/[^a-zA-Z0-9]/g, "");
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `SA_TutorPrepPack_Ch${chapterData.chapterNumber}_${safeName}_${dateStr}.pdf`;
  doc.save(filename);
}
