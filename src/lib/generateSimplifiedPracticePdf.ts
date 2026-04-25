import jsPDF from "jspdf";

/**
 * Generates a clean, printable PDF of the SIMPLIFIED version of a problem
 * (problem + instructions combined) plus blank work space.
 *
 * Input: the simplified Markdown produced by the `simplify-problem` edge function.
 * We do a lightweight Markdown -> structured-block parse (headings, bullets, paragraphs)
 * — no heavy renderer needed.
 */

export interface SimplifiedPracticePdfInput {
  sourceRef: string | null;        // e.g. "BE13.3"
  problemTitle: string | null;
  chapterLabel: string | null;     // e.g. "Ch 13: Long-Term Liabilities"
  courseName: string | null;       // e.g. "ACCY 304"
  simplifiedMarkdown: string;
}

// Brand colors (match generatePracticePdf.ts)
const NAVY = "#14213D";
const RED = "#CE1126";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const WORK_BOX_BG = "#fafafa";

// Page geometry (US Letter, points)
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN_X = 54;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

type Block =
  | { kind: "h"; level: 2 | 3; text: string }
  | { kind: "p"; text: string }
  | { kind: "li"; text: string; marker: string } // marker e.g. "•", "(a)"
  | { kind: "spacer"; h: number };

// ── Markdown parser (intentionally minimal) ─────────────────────────────
function stripInlineMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function parseSimplified(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: stripInlineMd(para.join(" ")) });
      para = [];
    }
  };

  for (let raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flushPara();
      continue;
    }
    // Headings
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    if (h2) {
      flushPara();
      blocks.push({ kind: "h", level: 2, text: stripInlineMd(h2[1]) });
      continue;
    }
    if (h3) {
      flushPara();
      blocks.push({ kind: "h", level: 3, text: stripInlineMd(h3[1]) });
      continue;
    }
    // Bullet (- or *)
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (bullet) {
      flushPara();
      const t = stripInlineMd(bullet[1]);
      // Detect "(a) ..." style at start so we keep the label as the marker
      const partMatch = t.match(/^\(([a-z])\)\s*(.+)/i);
      if (partMatch) {
        blocks.push({ kind: "li", marker: `(${partMatch[1].toLowerCase()})`, text: partMatch[2] });
      } else {
        blocks.push({ kind: "li", marker: "•", text: t });
      }
      continue;
    }
    // Numbered list "1. ..."
    const num = line.match(/^\s*(\d+)\.\s+(.+)/);
    if (num) {
      flushPara();
      blocks.push({ kind: "li", marker: `${num[1]}.`, text: stripInlineMd(num[2]) });
      continue;
    }
    // Line that is itself "(a) something" — treat as labeled item
    const part = line.match(/^\s*\(([a-z])\)\s*(.+)/i);
    if (part) {
      flushPara();
      blocks.push({ kind: "li", marker: `(${part[1].toLowerCase()})`, text: stripInlineMd(part[2]) });
      continue;
    }
    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

// ── PDF rendering ───────────────────────────────────────────────────────
export function generateSimplifiedPracticePdf(input: SimplifiedPracticePdfInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = MARGIN_TOP;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  // Header bar
  doc.setFillColor(NAVY);
  doc.rect(0, 0, PAGE_W, 36, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor("#FFFFFF");
  doc.text("Survive Accounting · Practice", MARGIN_X, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const rightHeader = [input.courseName, input.chapterLabel].filter(Boolean).join(" · ");
  if (rightHeader) {
    const tw = doc.getTextWidth(rightHeader);
    doc.text(rightHeader, PAGE_W - MARGIN_X - tw, 23);
  }

  y = 64;

  // Source ref + title
  if (input.sourceRef) {
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.setTextColor(RED);
    doc.text(input.sourceRef.toUpperCase(), MARGIN_X, y);
    y += 14;
  }
  if (input.problemTitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(NAVY);
    const titleLines = doc.splitTextToSize(input.problemTitle, CONTENT_W);
    titleLines.forEach((ln: string) => {
      ensureSpace(20);
      doc.text(ln, MARGIN_X, y);
      y += 18;
    });
  }

  // Subtitle
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("Simplified version (for practice)", MARGIN_X, y);
  y += 16;

  // Divider
  doc.setDrawColor(BORDER);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 16;

  // Body blocks
  const blocks = parseSimplified(input.simplifiedMarkdown);
  for (const b of blocks) {
    if (b.kind === "h") {
      const size = b.level === 2 ? 13 : 11;
      const lineH = size + 4;
      ensureSpace(lineH + 6);
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(size);
      doc.setTextColor(NAVY);
      const wrapped = doc.splitTextToSize(b.text, CONTENT_W);
      wrapped.forEach((ln: string) => {
        ensureSpace(lineH);
        doc.text(ln, MARGIN_X, y);
        y += lineH;
      });
      y += 2;
      continue;
    }
    if (b.kind === "p") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor("#1f2937");
      const wrapped = doc.splitTextToSize(b.text, CONTENT_W);
      wrapped.forEach((ln: string) => {
        ensureSpace(14);
        doc.text(ln, MARGIN_X, y);
        y += 14;
      });
      y += 4;
      continue;
    }
    if (b.kind === "li") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(RED);
      const markerW = doc.getTextWidth(b.marker) + 6;
      ensureSpace(14);
      doc.text(b.marker, MARGIN_X, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor("#1f2937");
      const wrapped = doc.splitTextToSize(b.text, CONTENT_W - markerW);
      wrapped.forEach((ln: string, i: number) => {
        if (i > 0) ensureSpace(14);
        doc.text(ln, MARGIN_X + markerW, y);
        y += 14;
      });
      y += 2;
      continue;
    }
    if (b.kind === "spacer") {
      y += b.h;
    }
  }

  // Work space
  y += 10;
  ensureSpace(40);
  doc.setDrawColor(BORDER);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(NAVY);
  doc.text("Your work", MARGIN_X, y);
  y += 14;

  // Lined writing area — fill the rest of page, then keep adding pages with lines
  const LINE_H = 22;
  const drawLines = () => {
    doc.setDrawColor("#d4d4d8");
    doc.setLineWidth(0.4);
    while (y + LINE_H <= PAGE_H - MARGIN_BOTTOM) {
      doc.line(MARGIN_X, y + LINE_H - 4, PAGE_W - MARGIN_X, y + LINE_H - 4);
      y += LINE_H;
    }
  };

  // Subtle background for first work area
  const workTop = y - 4;
  drawLines();
  doc.setFillColor(WORK_BOX_BG);
  void workTop;

  // Add ONE additional blank-lined page for extra room
  doc.addPage();
  y = MARGIN_TOP;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(NAVY);
  doc.text("Your work (continued)", MARGIN_X, y);
  y += 14;
  drawLines();

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    const footer = `${input.sourceRef || "Practice"} · Page ${i} of ${pageCount} · surviveaccounting.com`;
    const fw = doc.getTextWidth(footer);
    doc.text(footer, (PAGE_W - fw) / 2, PAGE_H - 24);
  }

  return doc;
}
