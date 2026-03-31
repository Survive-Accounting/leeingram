/**
 * Renders a banked question or LW item as clean HTML
 * suitable for pasting into LearnWorlds assessment editor.
 */

const TABLE_STYLE = 'border-collapse:collapse;width:100%;margin:8px 0;';
const CELL_STYLE = 'border:1px solid #ccc;padding:6px;text-align:left;';
const HEADER_STYLE = `${CELL_STYLE}font-weight:bold;background:#f5f5f5;`;
const INDENT_STYLE = `${CELL_STYLE}padding-left:24px;`;

// ── Journal Entry detection ──────────────────────────────────────────

const JE_PATTERNS = [
  /\b(debit|credit)\b/i,
  /\bjournal entry\b/i,
  /\baccount\b.*\b(debit|credit)\b/i,
];

interface JERow {
  account: string;
  debit: string;
  credit: string;
}

function detectJournalEntryRows(text: string): JERow[] | null {
  // Look for tabular JE data: "Account  Debit  Credit" or lines with $ amounts
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const rows: JERow[] = [];

  for (const line of lines) {
    // Pattern: "Account Name   10,000   " or "  Account Name      10,000"
    // Tab or multi-space separated with numbers
    const match = line.match(/^(\s{0,4})(.+?)\s{2,}([\d,]+(?:\.\d+)?)\s*$/);
    if (match) {
      const isCredit = match[1].length >= 2; // indented = credit
      const account = match[2].trim();
      const amount = match[3].trim();
      if (isCredit) {
        rows.push({ account, debit: "", credit: amount });
      } else {
        rows.push({ account, debit: amount, credit: "" });
      }
      continue;
    }

    // Pattern: "Account   debit_amount   credit_amount" (3 columns)
    const threeCol = line.match(/^(.+?)\s{2,}([\d,]+(?:\.\d+)?)\s{2,}([\d,]+(?:\.\d+)?)$/);
    if (threeCol) {
      rows.push({
        account: threeCol[1].trim(),
        debit: threeCol[2].trim(),
        credit: threeCol[3].trim(),
      });
    }
  }

  return rows.length >= 2 ? rows : null;
}

// ── Table detection ──────────────────────────────────────────────────

function detectTable(text: string): string[][] | null {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  // Pipe-delimited table
  const pipeLines = lines.filter(l => l.includes("|") && !l.match(/^\|?[-:| ]+\|?$/));
  if (pipeLines.length >= 2) {
    return pipeLines.map(l =>
      l.split("|").map(c => c.trim()).filter(Boolean)
    );
  }
  // Tab-delimited (3+ columns)
  const tabLines = lines.filter(l => l.split("\t").length >= 3);
  if (tabLines.length >= 2) {
    return tabLines.map(l => l.split("\t").map(c => c.trim()));
  }
  return null;
}

// ── HTML rendering helpers ───────────────────────────────────────────

function renderJETable(rows: JERow[]): string {
  const headerRow = `<tr><th style="${HEADER_STYLE}">Account</th><th style="${HEADER_STYLE}">Debit</th><th style="${HEADER_STYLE}">Credit</th></tr>`;
  const dataRows = rows.map(r => {
    const style = r.credit && !r.debit ? INDENT_STYLE : CELL_STYLE;
    return `<tr><td style="${style}">${escHtml(r.account)}</td><td style="${CELL_STYLE}">${escHtml(r.debit)}</td><td style="${CELL_STYLE}">${escHtml(r.credit)}</td></tr>`;
  }).join("\n");
  return `<table style="${TABLE_STYLE}">\n${headerRow}\n${dataRows}\n</table>`;
}

function renderGenericTable(rows: string[][]): string {
  if (!rows.length) return "";
  const [header, ...body] = rows;
  const hRow = `<tr>${header.map(h => `<th style="${HEADER_STYLE}">${escHtml(h)}</th>`).join("")}</tr>`;
  const bRows = body.map(r =>
    `<tr>${r.map(c => `<td style="${CELL_STYLE}">${escHtml(c)}</td>`).join("")}</tr>`
  ).join("\n");
  return `<table style="${TABLE_STYLE}">\n${hRow}\n${bRows}\n</table>`;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert plain text paragraphs to HTML, detecting embedded tables/JEs */
function textToHtml(text: string): string {
  if (!text) return "";

  // Check for journal entry patterns
  const hasJE = JE_PATTERNS.some(p => p.test(text));
  if (hasJE) {
    const jeRows = detectJournalEntryRows(text);
    if (jeRows) {
      // Split text into before-JE and after-JE parts
      const lines = text.split("\n");
      const firstNumLine = lines.findIndex(l => /\s{2,}[\d,]+/.test(l));
      const lastNumLine = [...lines].reverse().findIndex(l => /\s{2,}[\d,]+/.test(l));
      const before = lines.slice(0, Math.max(0, firstNumLine)).filter(l => l.trim()).map(l => `<p>${escHtml(l.trim())}</p>`).join("\n");
      const after = lines.slice(lines.length - lastNumLine).filter(l => l.trim() && !/\s{2,}[\d,]+/.test(l)).map(l => `<p>${escHtml(l.trim())}</p>`).join("\n");
      return `${before}\n${renderJETable(jeRows)}\n${after}`;
    }
  }

  // Check for generic tables
  const tableRows = detectTable(text);
  if (tableRows) {
    return renderGenericTable(tableRows);
  }

  // Plain text paragraphs
  return text.split("\n").filter(l => l.trim()).map(l => `<p>${escHtml(l.trim())}</p>`).join("\n");
}

// ── Main export function ─────────────────────────────────────────────

export interface QuestionHtmlInput {
  questionId: string;
  questionText: string;
  answers: string[];
  correctAnswer: string;
  explanation?: string;
}

export function renderQuestionHtml(input: QuestionHtmlInput): string {
  const { questionId, questionText, answers, correctAnswer, explanation } = input;
  const labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  const questionBody = textToHtml(questionText);

  const answerItems = answers
    .filter(a => a?.trim())
    .map((a, i) => {
      const label = labels[i] || String(i + 1);
      return `  <li>${label}. ${escHtml(a)}</li>`;
    })
    .join("\n");

  const explanationHtml = explanation
    ? `\n<p style="margin-top:12px;font-size:0.9em;color:#666;"><em>${escHtml(explanation)}</em></p>`
    : "";

  return `<div class="question">
<p><strong>${escHtml(questionId)}</strong></p>

${questionBody}

<ul style="list-style:none;padding-left:0;">
${answerItems}
</ul>

<!-- correct: ${escHtml(correctAnswer)} -->
${explanationHtml}
</div>`;
}

/** Copy HTML string to clipboard */
export async function copyHtmlToClipboard(html: string): Promise<boolean> {
  try {
    // Try using ClipboardItem for rich HTML
    if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
      const blob = new Blob([html], { type: "text/html" });
      const item = new ClipboardItem({ "text/html": blob, "text/plain": new Blob([html], { type: "text/plain" }) });
      await navigator.clipboard.write([item]);
      return true;
    }
    // Fallback: copy as plain text
    await navigator.clipboard.writeText(html);
    return true;
  } catch {
    // Last resort fallback
    const ta = document.createElement("textarea");
    ta.value = html;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}

// ── JE Option types and renderers ────────────────────────────────────

export interface JEOptionRow {
  account_name: string;
  side: "debit" | "credit";
}

export function parseJEOption(value: string | null | undefined): JEOptionRow[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof parsed[0].account_name === "string" &&
      typeof parsed[0].side === "string"
    ) {
      return parsed as JEOptionRow[];
    }
    return null;
  } catch {
    return null;
  }
}

export function renderJEOptionHtml(rows: JEOptionRow[]): string {
  if (!rows || rows.length === 0) return "<p>(empty)</p>";

  const debits = rows.filter(r => r.side === "debit");
  const credits = rows.filter(r => r.side === "credit");
  const ordered = [...debits, ...credits];

  const headerRow = `<tr><th style="${HEADER_STYLE}">Account</th><th style="${HEADER_STYLE}width:80px;text-align:center;">Debit</th><th style="${HEADER_STYLE}width:80px;text-align:center;">Credit</th></tr>`;

  const dataRows = ordered.map(r => {
    const isCredit = r.side === "credit";
    const tdStyle = isCredit ? INDENT_STYLE : CELL_STYLE;
    return `<tr><td style="${tdStyle}">${escHtml(r.account_name)}</td><td style="${CELL_STYLE}text-align:center;">${isCredit ? "" : "&#10003;"}</td><td style="${CELL_STYLE}text-align:center;">${isCredit ? "&#10003;" : ""}</td></tr>`;
  }).join("\n");

  return `<table style="${TABLE_STYLE}">${headerRow}\n${dataRows}</table>`;
}

export function renderFeedbackHtml(
  isCorrect: boolean,
  explanationCorrect: string,
  correctJERows?: JEOptionRow[]
): string {
  if (isCorrect) {
    const jeSection = correctJERows
      ? `<div style="margin-top:10px;"><p style="font-size:0.85em;color:#555;margin:0 0 6px;"><strong>Correct journal entry:</strong></p>${renderJEOptionHtml(correctJERows)}</div>`
      : "";

    return `<div style="padding:12px;background:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;"><p style="color:#166534;font-weight:bold;margin:0 0 8px;">&#10003; Correct!</p><p style="margin:0;">${escHtml(explanationCorrect)}</p>${jeSection}</div>`;
  }

  return `<div style="padding:12px;background:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;"><p style="color:#991b1b;font-weight:bold;margin:0 0 8px;">&#10007; Not quite.</p><p style="margin:0;">Review which accounts are involved in this transaction and which side each one goes on. Check the correct answer feedback for the full explanation.</p></div>`;
}
