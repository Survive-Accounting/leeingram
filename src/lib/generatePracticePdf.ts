import jsPDF from "jspdf";

/**
 * Generates a blank practice problem PDF matching the Solutions Viewer layout.
 * 
 * PHASE 1: Testing on BE13.3 (IA2 Ch 13) — remove source_ref
 * check after template approval to enable across all assets
 */

interface PracticePdfInput {
  sourceRef: string;
  problemTitle: string;
  courseName: string;
  chapterLabel: string;
  problemText: string;
  instructions: string[];
}

// ── Color constants ──
const NAVY = "#14213D";
const RED = "#CE1126";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const WORK_BOX_BG = "#f8fafc";
const CTA_BG = "#f0fdf4";
const CTA_BORDER = "#bbf7d0";
const TABLE_HEADER_BG = "#1A2E55";
const TABLE_ALT_BG = "#F8F9FA";

// ── Pipe table detection ──
function parsePipeTable(lines: string[]): string[][] | null {
  const rows: string[][] = [];
  for (const line of lines) {
    const cells = line.split("|").map(c => c.trim());
    if (cells[0] === "") cells.shift();
    if (cells[cells.length - 1] === "") cells.pop();
    // Skip separator rows
    if (cells.every(c => /^[-:]+$/.test(c))) continue;
    rows.push(cells);
  }
  return rows.length >= 2 ? rows : null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// ── Text wrapping utility ──
function wrapText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  return doc.splitTextToSize(text, maxWidth) as string[];
}

function estimateInstructionHeight(instruction: string): number {
  const lower = instruction.toLowerCase();
  if (lower.includes("journal entr")) return 1.1;
  if (lower.includes("compute") || lower.includes("calculate") || lower.includes("determine")) {
    // Multi-step if multiple items mentioned
    const keywords = ["and", ",", "each", "both", "total"];
    if (keywords.some(k => lower.includes(k))) return 1.3;
    return 0.9;
  }
  if (lower.includes("prepare") || lower.includes("record")) return 1.3;
  return 0.9;
}

export function generatePracticePdf(input: PracticePdfInput) {
  const { sourceRef, problemTitle, courseName, chapterLabel, problemText, instructions } = input;

  const doc = new jsPDF({ unit: "in", format: "letter" });
  const pageW = 8.5;
  const pageH = 11;
  const marginL = 0.75;
  const marginR = 0.75;
  const contentW = pageW - marginL - marginR;
  let y = 0;

  // ── Helper: check page break ──
  function checkPage(needed: number) {
    if (y + needed > pageH - 0.75) {
      doc.addPage();
      y = 0.75;
    }
  }

  // ══════════════════════════════════════════
  // SECTION 1: NAVY HEADER BAR
  // ══════════════════════════════════════════
  const headerH = 0.52;
  doc.setFillColor(...hexToRgb(NAVY));
  doc.rect(0, 0, pageW, headerH, "F");

  // Left: "SurviveAccounting™"
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Survive", 0.5, 0.33);
  const surviveW = doc.getTextWidth("Survive");
  doc.setTextColor(...hexToRgb(RED));
  doc.text("Accounting", 0.5 + surviveW, 0.33);
  const accW = doc.getTextWidth("Accounting");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text("™", 0.5 + surviveW + accW + 0.02, 0.26);

  // Right: "by Lee Ingram"
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  const byText = "by Lee Ingram";
  const byW = doc.getTextWidth(byText);
  doc.text(byText, pageW - 0.5 - byW, 0.33);

  y = headerH;

  // ══════════════════════════════════════════
  // SECTION 2: CTA STRIP
  // ══════════════════════════════════════════
  const ctaH = 0.4;
  doc.setFillColor(...hexToRgb(CTA_BG));
  doc.rect(0, y, pageW, ctaH, "F");
  // Bottom border
  doc.setDrawColor(...hexToRgb(CTA_BORDER));
  doc.setLineWidth(0.01);
  doc.line(0, y + ctaH, pageW, y + ctaH);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...hexToRgb(NAVY));
  doc.text("Full solution & study tools — including worked steps, key concepts, and exam traps", marginL, y + 0.24);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const ctaRight = "SurviveAccounting.com →";
  const ctaRW = doc.getTextWidth(ctaRight);
  doc.text(ctaRight, pageW - marginR - ctaRW, y + 0.24);

  y += ctaH;

  // ══════════════════════════════════════════
  // SECTION 3: PROBLEM IDENTIFIER
  // ══════════════════════════════════════════
  y += 0.28;

  // Line 1: "Practice problem based on [source_ref]"
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...hexToRgb(MUTED));
  doc.text(`Practice problem based on ${sourceRef}`, marginL, y);
  y += 0.22;

  // Line 2: problem title
  if (problemTitle) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...hexToRgb(NAVY));
    const titleLines = wrapText(doc, problemTitle, contentW, 16);
    for (const line of titleLines) {
      checkPage(0.25);
      doc.text(line, marginL, y);
      y += 0.25;
    }
  }

  // Line 3: course · chapter
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...hexToRgb(MUTED));
  const courseChapter = [courseName, chapterLabel].filter(Boolean).join("  ·  ");
  doc.text(courseChapter, marginL, y);
  y += 0.18;

  // Thin divider
  doc.setDrawColor(...hexToRgb(BORDER));
  doc.setLineWidth(0.005);
  doc.line(marginL, y, pageW - marginR, y);
  y += 0.25;

  // ══════════════════════════════════════════
  // SECTION 4: PROBLEM TEXT
  // ══════════════════════════════════════════
  // Section label
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...hexToRgb(MUTED));
  doc.text("PROBLEM", marginL, y);
  y += 0.22;

  // Render problem text with pipe table support
  if (problemText.trim()) {
    const allLines = problemText.split("\n");
    let li = 0;

    while (li < allLines.length) {
      // Check for pipe table block
      if (
        li < allLines.length - 1 &&
        allLines[li].includes("|") &&
        allLines[li + 1].includes("|")
      ) {
        const tableStart = li;
        while (li < allLines.length && allLines[li].includes("|")) li++;
        const tableLines = allLines.slice(tableStart, li);
        const tableRows = parsePipeTable(tableLines);
        if (tableRows) {
          y = renderPipeTablePdf(doc, tableRows, marginL, y, contentW);
          y += 0.15;
        }
      } else {
        // Regular text line
        const line = allLines[li];
        li++;
        if (!line.trim()) {
          y += 0.1;
          continue;
        }
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...hexToRgb("#1A1A1A"));
        const wrapped = wrapText(doc, line, contentW, 11);
        for (const wl of wrapped) {
          checkPage(0.2);
          doc.text(wl, marginL, y);
          y += 0.18;
        }
        y += 0.04;
      }
    }
  }

  y += 0.15;

  // ══════════════════════════════════════════
  // SECTION 5: INSTRUCTIONS
  // ══════════════════════════════════════════
  if (instructions.length > 0) {
    checkPage(0.5);

    // Section label
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...hexToRgb(MUTED));
    doc.text("INSTRUCTIONS", marginL, y);
    y += 0.22;

    for (let idx = 0; idx < instructions.length; idx++) {
      const letter = String.fromCharCode(97 + idx);
      const inst = instructions[idx];

      // Estimate needed space
      const boxH = estimateInstructionHeight(inst);
      doc.setFontSize(11);
      const labelText = `(${letter})`;
      const labelW = doc.getTextWidth(labelText) + 0.08;
      const instWrapped = wrapText(doc, inst, contentW - labelW, 11);
      const textH = instWrapped.length * 0.18;
      const totalNeeded = textH + 0.12 + boxH + 0.2;

      checkPage(totalNeeded);

      // Instruction label + text
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...hexToRgb(NAVY));
      doc.text(labelText, marginL, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...hexToRgb("#1A1A1A"));
      for (let wi = 0; wi < instWrapped.length; wi++) {
        doc.text(instWrapped[wi], marginL + labelW, y + wi * 0.18);
      }
      y += textH + 0.12;

      // Work box
      doc.setFillColor(...hexToRgb(WORK_BOX_BG));
      doc.setDrawColor(...hexToRgb(BORDER));
      doc.setLineWidth(0.01);
      doc.roundedRect(marginL, y, contentW, boxH, 0.04, 0.04, "FD");
      y += boxH + 0.2;
    }
  }

  // ── Generate and download ──
  const safeRef = sourceRef.replace(/\s+/g, "-");
  doc.save(`SurviveAccounting-${safeRef}-Practice.pdf`);
}

// ── Pipe table renderer for PDF ──
function renderPipeTablePdf(
  doc: jsPDF,
  rows: string[][],
  x: number,
  startY: number,
  tableW: number,
): number {
  const [header, ...body] = rows;
  const colCount = header.length;
  const colW = tableW / colCount;
  const rowH = 0.28;
  let y = startY;

  // Header row
  doc.setFillColor(...hexToRgb(TABLE_HEADER_BG));
  doc.rect(x, y, tableW, rowH, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  for (let ci = 0; ci < colCount; ci++) {
    doc.text(header[ci], x + ci * colW + 0.1, y + 0.18);
  }
  y += rowH;

  // Body rows
  for (let ri = 0; ri < body.length; ri++) {
    const row = body[ri];
    const bg = ri % 2 === 0 ? "#FFFFFF" : TABLE_ALT_BG;
    doc.setFillColor(...hexToRgb(bg));
    doc.rect(x, y, tableW, rowH, "F");
    // Top border
    doc.setDrawColor(...hexToRgb("#E0E0E0"));
    doc.setLineWidth(0.005);
    doc.line(x, y, x + tableW, y);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...hexToRgb("#1A1A1A"));
    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci] || "";
      const isNum = /^\$?[\d,]+(\.\d+)?%?$/.test(cell.trim());
      if (isNum) {
        const cellTextW = doc.getTextWidth(cell);
        doc.text(cell, x + (ci + 1) * colW - 0.1 - cellTextW, y + 0.18);
      } else {
        doc.text(cell, x + ci * colW + 0.1, y + 0.18);
      }
    }
    y += rowH;
  }

  // Bottom border
  doc.setDrawColor(...hexToRgb(BORDER));
  doc.setLineWidth(0.005);
  doc.line(x, y, x + tableW, y);

  return y;
}
