const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_DOCS_API = "https://docs.googleapis.com/v1/documents";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
];

const ROOT_FOLDER_ID = "1Lu00SDbRHDxlMqAu_sa0aZbSw_HHfSbx";

// ── Google Auth helpers ──────────────────────────────────────────────

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(pem: string): Promise<CryptoKey> {
  const lines = pem.split("\n").filter(l => !l.startsWith("-----")).join("");
  const binary = Uint8Array.from(atob(lines), c => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", binary, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email, scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })));
  const key = await importKey(sa.private_key);
  const sig = base64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`)));
  const jwt = `${header}.${payload}.${sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Google API helper ────────────────────────────────────────────────

async function googleFetch(url: string, token: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { rawBody: text }; }
  if (!res.ok) {
    const ge = data?.error;
    const code = ge?.code ?? res.status;
    const message = ge?.message ?? text;
    console.error(`Google API ${code}: ${message}`);
    throw Object.assign(new Error(`Google API ${code}: ${message}`), { googleCode: code });
  }
  return data;
}

// ── Drive helpers ────────────────────────────────────────────────────

async function findOrCreateFolder(token: string, name: string, parentId?: string): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false${parentId ? ` and '${parentId}' in parents` : ""}`;
  const searchData = await googleFetch(
    `${GOOGLE_DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    token
  );
  if (searchData.files?.length) return searchData.files[0].id;
  const createData = await googleFetch(`${GOOGLE_DRIVE_API}?supportsAllDrives=true`, token, {
    method: "POST",
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) }),
  });
  return createData.id;
}

async function ensureFolderHierarchy(
  token: string, courseCode: string, chapterNumber: string | number, serviceAccountEmail: string
): Promise<{ courseFolderId: string; chapterFolderId: string }> {
  try {
    await googleFetch(`${GOOGLE_DRIVE_API}/${ROOT_FOLDER_ID}?fields=id,name&supportsAllDrives=true`, token);
  } catch {
    throw new Error(`Cannot access shared root folder ${ROOT_FOLDER_ID}. Share with: ${serviceAccountEmail}`);
  }
  const courseFolderId = await findOrCreateFolder(token, courseCode, ROOT_FOLDER_ID);
  const chapterLabel = `Chapter ${String(chapterNumber).padStart(2, "0")}`;
  const chapterFolderId = await findOrCreateFolder(token, chapterLabel, courseFolderId);
  return { courseFolderId, chapterFolderId };
}

// ── DB fetch ─────────────────────────────────────────────────────────

async function fetchAssetData(supabaseUrl: string, serviceRoleKey: string, assetId: string) {
  const authHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };

  const assetRes = await fetch(`${supabaseUrl}/rest/v1/teaching_assets?id=eq.${assetId}&select=*`, { headers: authHeaders });
  const assets = await assetRes.json();
  const asset = assets?.[0];
  if (!asset) throw new Error(`Teaching asset not found: ${assetId}`);

  let chapter: any = null;
  if (asset.chapter_id) {
    const chRes = await fetch(`${supabaseUrl}/rest/v1/chapters?id=eq.${asset.chapter_id}&select=id,chapter_number,chapter_name,course_id`, { headers: authHeaders });
    const chapters = await chRes.json();
    chapter = chapters?.[0] || null;
  }

  let course: any = null;
  if (asset.course_id) {
    const coRes = await fetch(`${supabaseUrl}/rest/v1/courses?id=eq.${asset.course_id}&select=id,course_name,code`, { headers: authHeaders });
    const courses = await coRes.json();
    course = courses?.[0] || null;
  }

  let problemInstructions: { instruction_number: number; instruction_text: string }[] = [];
  const instrRes = await fetch(
    `${supabaseUrl}/rest/v1/problem_instructions?teaching_asset_id=eq.${assetId}&select=instruction_number,instruction_text&order=instruction_number`,
    { headers: authHeaders }
  );
  const instrData = await instrRes.json();
  if (Array.isArray(instrData)) problemInstructions = instrData;

  return { asset, chapter, course, problemInstructions };
}

// ── JE helpers ───────────────────────────────────────────────────────

function normalizeJEFromJson(json: any): any[] {
  if (!json) return [];
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (data.scenario_sections && Array.isArray(data.scenario_sections)) {
      const entries: any[] = [];
      for (const section of data.scenario_sections) {
        const dateEntries = section.entries_by_date || section.journal_entries || [];
        for (const entry of dateEntries) {
          entries.push({ date: entry.date || entry.entry_date || entry.requirement || section.label || "", rows: entry.rows || entry.accounts || [] });
        }
      }
      return entries;
    }
    if (Array.isArray(data)) return data.map((e: any) => ({ date: e.date || e.entry_date || e.requirement || "", rows: e.accounts || e.rows || [] }));
    if (data.parts && Array.isArray(data.parts)) {
      const entries: any[] = [];
      for (const part of data.parts) {
        for (const entry of (part.journal_entries || part.entries || [])) {
          entries.push({ date: entry.date || entry.requirement || "", rows: entry.accounts || entry.rows || [] });
        }
      }
      return entries;
    }
    const arr = data.journal_entries || data.entries;
    if (Array.isArray(arr)) return arr.map((e: any) => ({ date: e.date || e.entry_date || e.requirement || "", rows: e.accounts || e.rows || [] }));
    return [];
  } catch { return []; }
}

function jeToRawText(entries: any[]): string {
  if (entries.length === 0) return "";
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.date) lines.push(entry.date);
    for (const row of (entry.rows || [])) {
      const acct = row.account_name || row.account || "";
      const isCredit = row.side === "credit" || (row.credit != null && row.credit !== 0 && (row.debit == null || row.debit === 0));
      const indent = isCredit ? "    " : "";
      const amt = isCredit
        ? (row.credit != null ? `  ${Number(row.credit).toLocaleString()}` : "")
        : (row.debit != null ? `  ${Number(row.debit).toLocaleString()}` : "");
      lines.push(`${indent}${acct}${amt}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function formatAmount(val: any): string {
  if (val == null || val === 0 || val === "") return "";
  return Number(val).toLocaleString("en-US");
}

// ── Color helpers ────────────────────────────────────────────────────

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { red: r, green: g, blue: b };
}

const NAVY = hexToRgb("#131E35");
const WHITE = { red: 1, green: 1, blue: 1 };
const LIGHT_GRAY = hexToRgb("#AAAAAA");
const RED = hexToRgb("#C0392B");

// ── New batch-update builder using index tracking ────────────────────

interface RequestBuilder {
  requests: any[];
  idx: number;
}

function rb(): RequestBuilder {
  return { requests: [], idx: 1 };
}

function insertText(b: RequestBuilder, text: string): { start: number; end: number } {
  // Strip carriage returns — Google Docs ignores \r but JS counts it in length,
  // which would cause b.idx to drift ahead of the actual document index.
  const clean = text.replace(/\r/g, "");
  const start = b.idx;
  b.requests.push({ insertText: { location: { index: b.idx }, text: clean } });
  b.idx += clean.length;
  return { start, end: b.idx };
}

function styleText(b: RequestBuilder, start: number, end: number, textStyle: any, fields: string) {
  b.requests.push({
    updateTextStyle: {
      range: { startIndex: start, endIndex: end },
      textStyle,
      fields,
    },
  });
}

function styleParagraph(b: RequestBuilder, start: number, end: number, paragraphStyle: any, fields: string) {
  b.requests.push({
    updateParagraphStyle: {
      range: { startIndex: start, endIndex: end },
      paragraphStyle,
      fields,
    },
  });
}

function insertStyledText(
  b: RequestBuilder,
  text: string,
  opts: {
    bold?: boolean;
    fontSize?: number;
    fontFamily?: string;
    fgColor?: { red: number; green: number; blue: number };
    bgColor?: { red: number; green: number; blue: number };
    namedStyle?: string;
    indent?: number;
    link?: string;
    spaceBelow?: number;
  } = {}
): { start: number; end: number } {
  const { start, end } = insertText(b, text);
  if (text.trim().length === 0) return { start, end };

  // Paragraph style
  const pFields: string[] = [];
  const pStyle: any = {};
  if (opts.namedStyle) { pStyle.namedStyleType = opts.namedStyle; pFields.push("namedStyleType"); }
  if (opts.indent) { pStyle.indentStart = { magnitude: opts.indent, unit: "PT" }; pFields.push("indentStart"); }
  if (opts.spaceBelow != null) { pStyle.spaceBelow = { magnitude: opts.spaceBelow, unit: "PT" }; pFields.push("spaceBelow"); }
  if (pFields.length) styleParagraph(b, start, end, pStyle, pFields.join(","));

  // Text style
  const tFields: string[] = [];
  const tStyle: any = {};
  if (opts.bold != null) { tStyle.bold = opts.bold; tFields.push("bold"); }
  if (opts.fontSize) { tStyle.fontSize = { magnitude: opts.fontSize, unit: "PT" }; tFields.push("fontSize"); }
  if (opts.fontFamily) { tStyle.weightedFontFamily = { fontFamily: opts.fontFamily }; tFields.push("weightedFontFamily"); }
  if (opts.fgColor) { tStyle.foregroundColor = { color: { rgbColor: opts.fgColor } }; tFields.push("foregroundColor"); }
  if (opts.bgColor) { tStyle.backgroundColor = { color: { rgbColor: opts.bgColor } }; tFields.push("backgroundColor"); }
  if (opts.link) { tStyle.link = { url: opts.link }; tFields.push("link"); }
  if (tFields.length) styleText(b, start, end, tStyle, tFields.join(","));

  return { start, end };
}

// ── Table builder helpers ────────────────────────────────────────────

function insertTable(b: RequestBuilder, rows: number, cols: number): number {
  const tableStart = b.idx;
  b.requests.push({
    insertTable: {
      location: { index: b.idx },
      rows,
      columns: cols,
    },
  });
  // After inserting table, index advances: table element + (rows * (cols cells + row end + cell paragraphs))
  // Google Docs table structure: tableStart, then for each row: rowStart, then for each cell: cellStart, paragraph(\n), cellEnd, rowEnd, tableEnd
  // Each cell contains a paragraph with a newline = 1 char
  // Total characters added = rows * cols (one \n per cell)
  // But we also have structural elements. The index after table = tableStart + 1 + rows*(1 + cols*(2 + 1)) + 1
  // Actually, let's just compute: table=1, each row=0, each cell=2 (cell start, paragraph), paragraph newline=1, row=0, table end=0
  // Structural elements per table: 1 (table) + rows * (1 (row) + cols * (1 (cell) + 1 (paragraph))) + ... 
  // It's easier to track: total index advance = 1 + rows * (1 + cols * 3)
  // Wait - each cell has: cell(1) + paragraph(1) + newline_char(1) = 3, row(1), table(1)
  // total = 1 + rows * (1 + cols * 3)
  // Actually the standard formula: table adds (4 * rows * cols + 2 * rows + 1) to the index... let me use the known formula
  // After an insertTable with R rows and C cols, the index advances by: R*C + R*(C+1) + ... 
  // Known: new index = old index + 4*R*C + 2*R + 2  ... let me just use the safe formula
  // The safest approach: 1 (table) + for each row: 1 (row start) + for each cell: 1 (cell start) + 1 (paragraph start) + 1 (\n char) = 3 per cell
  // So: 1 + R * (1 + C*3) = 1 + R + 3RC
  b.idx = tableStart + 1 + rows + 3 * rows * cols;
  return tableStart;
}

// ── Main doc content builder ─────────────────────────────────────────

function buildDocRequests(
  asset: any, course: any, chapter: any, problemInstructions: any[], jeEntries: any[], jeRawText: string
): any[] {
  const b = rb();
  const assetName = asset.asset_name || "";
  const courseCode = course?.code || "";
  const courseName = course?.course_name || "";
  const chNum = chapter?.chapter_number ?? "";
  const chName = chapter?.chapter_name || "";
  const sourceRef = asset.source_ref || "";

  // Build the app link URL for the asset heading (deep-link by asset_name)
  const appDomain = Deno.env.get("SITE_URL") || Deno.env.get("APP_URL") || "https://leeingram.lovable.app";
  const assetLink = `${appDomain}/assets-library?asset=${encodeURIComponent(assetName)}`;

  // ─── 1. HEADER ───
  insertStyledText(b, assetName + "\n", {
    bold: true, fontSize: 18, fgColor: NAVY, namedStyle: "HEADING_1", link: assetLink,
  });
  insertStyledText(b, `${courseName} · Ch ${chNum} — ${chName} · Source: ${sourceRef}\n`, {
    fontSize: 10,
  });
  insertText(b, "\n");

  // ─── 2. PROBLEM (context only, no duplicate problem_text) ───
  if (asset.problem_context?.trim()) {
    insertStyledText(b, "PROBLEM\n", { bold: true, fontSize: 13, fgColor: NAVY, namedStyle: "HEADING_2" });
    insertStyledText(b, "Context\n", { bold: true, fontSize: 11, fgColor: hexToRgb("#333333") });
    insertStyledText(b, asset.problem_context + "\n", { fontSize: 11 });
    insertText(b, "\n");
  }

  // ─── 3. REQUIRED (instructions with blank lines between) ───
  const sortedInstr = [...problemInstructions].sort((a, b) => a.instruction_number - b.instruction_number);
  const instrTexts = sortedInstr.filter(i => i.instruction_text?.trim()).map((i, idx) => {
    const letter = String.fromCharCode(97 + idx);
    return `(${letter}) ${i.instruction_text}`;
  });
  if (instrTexts.length > 0) {
    insertStyledText(b, "REQUIRED\n", { bold: true, fontSize: 13, fgColor: NAVY, namedStyle: "HEADING_2" });
    for (let i = 0; i < instrTexts.length; i++) {
      insertStyledText(b, instrTexts[i] + "\n", { fontSize: 11 });
      // Blank line between instructions (paragraph break)
      if (i < instrTexts.length - 1) {
        insertText(b, "\n");
      }
    }
    insertText(b, "\n");
  }

  // ─── 4. JOURNAL ENTRIES (moved before Answer Summary) ───
  // Prefer raw text from the DB field for JE rendering
  const rawJeText = asset.journal_entry_raw || "";
  const hasRawText = rawJeText.trim().length > 0;
  const hasStructuredEntries = jeEntries.length > 0;

  if (hasRawText || hasStructuredEntries) {
    insertStyledText(b, "JOURNAL ENTRIES\n", { bold: true, fontSize: 13, fgColor: NAVY, namedStyle: "HEADING_2" });

    try {
      if (hasRawText) {
        buildJETableFromRaw(b, rawJeText);
      } else {
        buildJETable(b, jeEntries);
      }
    } catch (e) {
      console.warn("JE table build failed, falling back to monospace:", e);
      const fallbackText = hasRawText ? rawJeText : jeRawText;
      if (fallbackText.trim()) {
        insertStyledText(b, fallbackText + "\n", {
          fontSize: 10, fontFamily: "Courier New",
        });
      }
    }
    insertText(b, "\n");
  }

  // ─── 5. ANSWER SUMMARY (moved after JE) ───
  const answerSummary = asset.survive_solution_text || "";
  if (answerSummary.trim()) {
    insertStyledText(b, "ANSWER SUMMARY\n", { bold: true, fontSize: 13, fgColor: NAVY, namedStyle: "HEADING_2" });
    insertStyledText(b, answerSummary + "\n", { fontSize: 11, bgColor: hexToRgb("#E8F5E9") });
    insertText(b, "\n");
  }

  // ─── 6. IMPORTANT FORMULAS (line breaks between formulas) ───
  if (asset.important_formulas?.trim()) {
    insertStyledText(b, "IMPORTANT FORMULAS\n", { bold: true, fontSize: 13, fgColor: NAVY, namedStyle: "HEADING_2" });
    const formulaLines = asset.important_formulas.split("\n").filter((l: string) => l.trim());
    for (const line of formulaLines) {
      insertStyledText(b, line + "\n", {
        fontSize: 10, fontFamily: "Courier New", bgColor: hexToRgb("#FFF8E1"), spaceBelow: 6,
      });
    }
    insertText(b, "\n");
  }

  // ─── 7. CONCEPTS (bulleted list) ───
  if (asset.concept_notes?.trim()) {
    insertStyledText(b, "CONCEPTS\n", { bold: true, fontSize: 13, fgColor: NAVY, namedStyle: "HEADING_2" });
    const sentences = asset.concept_notes.split(". ").filter((s: string) => s.trim());
    for (const sentence of sentences) {
      const text = sentence.endsWith(".") ? sentence : sentence + ".";
      const { start, end } = insertStyledText(b, text + "\n", { fontSize: 11 });
      // Apply bullet list
      b.requests.push({
        createParagraphBullets: {
          range: { startIndex: start, endIndex: end },
          bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
        },
      });
    }
    insertText(b, "\n");
  }

  // ─── 8. EXAM TRAPS (bulleted list, red) ───
  if (asset.exam_traps?.trim()) {
    insertStyledText(b, "⚠ EXAM TRAPS\n", { bold: true, fontSize: 13, fgColor: RED, namedStyle: "HEADING_2" });
    const sentences = asset.exam_traps.split(". ").filter((s: string) => s.trim());
    for (const sentence of sentences) {
      const text = sentence.endsWith(".") ? sentence : sentence + ".";
      const { start, end } = insertStyledText(b, text + "\n", {
        fontSize: 11, fgColor: RED, bgColor: hexToRgb("#FFEBEE"),
      });
      b.requests.push({
        createParagraphBullets: {
          range: { startIndex: start, endIndex: end },
          bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
        },
      });
    }
    insertText(b, "\n");
  }

  // ─── Footer ───
  const today = new Date().toISOString().split("T")[0];
  insertStyledText(b, `Generated by Survive Accounting · ${assetName} · ${today}\n`, {
    fontSize: 8, fgColor: LIGHT_GRAY,
  });

  return b.requests;
}

// ── JE rendering (styled text with tab stops — no actual table) ───────

interface JELine {
  type: "date" | "debit" | "credit";
  text: string;
  amount: string;
}

function parseJERawLines(rawText: string): JELine[][] {
  const lines = rawText.split("\n");
  const groups: JELine[][] = [];
  let current: JELine[] = [];

  // Date pattern: must contain a month name (full or abbreviated)
  const dateRe = /(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}\/\d{2,4})/i;
  // Amount at end of line: dollar sign or comma-separated number that looks like currency (not a year)
  const trailingAmountRe = /\$[\d,]+(?:\.\d+)?|\b[\d]{1,3}(?:,\d{3})+(?:\.\d+)?\s*$/;

  for (const raw of lines) {
    if (!raw.trim()) {
      if (current.length > 0) { groups.push(current); current = []; }
      continue;
    }

    // A date line: contains a month name/date pattern AND does NOT end with a dollar amount
    const looksLikeDate = dateRe.test(raw);
    const hasTrailingAmount = trailingAmountRe.test(raw);
    const isDate = looksLikeDate && !hasTrailingAmount;

    if (isDate) {
      if (current.length > 0) { groups.push(current); current = []; }
      current.push({ type: "date", text: raw.trim(), amount: "" });
    } else {
      const isCredit = raw.startsWith("\t") || raw.startsWith("    ") || raw.startsWith("  ");
      const amountMatch = raw.match(/([\d,]+(?:\.\d+)?)\s*$/);
      const amount = amountMatch ? amountMatch[1] : "";
      const accountName = raw.replace(/([\d,]+(?:\.\d+)?)\s*$/, "").trim();
      current.push({
        type: isCredit ? "credit" : "debit",
        text: accountName,
        amount: amount ? Number(amount.replace(/,/g, "")).toLocaleString("en-US") : "",
      });
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function buildJETable(b: RequestBuilder, entries: any[]) {
  const rawText = jeToRawText(entries);
  if (!rawText.trim()) return;
  buildJETableFromRaw(b, rawText);
}

function buildJETableFromRaw(b: RequestBuilder, rawText: string) {
  const groups = parseJERawLines(rawText);
  if (groups.length === 0) {
    insertStyledText(b, rawText + "\n", { fontSize: 10, fontFamily: "Courier New" });
    return;
  }

  // Tab stop positions for debit and credit columns (in PT)
  const debitTab = 300;  // ~4.2 inches
  const creditTab = 390; // ~5.4 inches

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];

    // Separator line between date groups
    if (gi > 0) {
      insertStyledText(b, "\n", { fontSize: 4 });
    }

    for (const line of group) {
      if (line.type === "date") {
        // Date header: bold, navy, light blue background
        insertStyledText(b, line.text + "\n", {
          bold: true, fontSize: 11, fgColor: NAVY, bgColor: hexToRgb("#EEF2FF"),
        });
      } else {
        const isCredit = line.type === "credit";
        const indent = isCredit ? "    " : "";
        const debitAmt = !isCredit ? line.amount : "";
        const creditAmt = isCredit ? line.amount : "";

        // Build the line: account \t debit \t credit
        const lineText = `${indent}${line.text}\t${debitAmt}\t${creditAmt}\n`;
        const { start, end } = insertStyledText(b, lineText, {
          fontSize: 10,
          fontFamily: "Courier New",
        });

        // Apply tab stops to align debit and credit columns
        b.requests.push({
          updateParagraphStyle: {
            range: { startIndex: start, endIndex: end },
            paragraphStyle: {
              tabStops: [
                { offset: { magnitude: debitTab, unit: "PT" }, alignment: "RIGHT" },
                { offset: { magnitude: creditTab, unit: "PT" }, alignment: "RIGHT" },
              ],
              spaceBelow: { magnitude: 1, unit: "PT" },
            },
            fields: "tabStops,spaceBelow",
          },
        });

        // Light gray background for credit rows
        if (isCredit) {
          styleText(b, start, end - 1, {
            backgroundColor: { color: { rgbColor: hexToRgb("#F5F5F5") } },
          }, "backgroundColor");
        }
      }
    }
  }

  // Closing navy rule (thin dark line)
  insertStyledText(b, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n", {
    fontSize: 4, fgColor: NAVY,
  });
}

// ── Archive previous prep doc ────────────────────────────────────────

async function archivePreviousPrepDoc(
  token: string,
  assetFolderId: string,
  existingDocId: string,
  assetCode: string,
): Promise<void> {
  try {
    // Create or find an "Archived" subfolder inside the asset folder
    const archiveFolderId = await findOrCreateFolder(token, "Archived", assetFolderId);

    // Rename the old doc with a timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const archivedName = `${assetCode} — Tutoring Prep (archived ${timestamp})`;

    // Move the old doc to the archive folder and rename it
    await googleFetch(
      `${GOOGLE_DRIVE_API}/${existingDocId}?addParents=${archiveFolderId}&removeParents=${assetFolderId}&supportsAllDrives=true`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({ name: archivedName }),
      }
    );
    console.log(`Archived previous prep doc ${existingDocId} as "${archivedName}"`);
  } catch (e) {
    // Don't fail the whole operation if archiving fails
    console.warn(`Failed to archive previous prep doc ${existingDocId}:`, e);
  }
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: authHeader, apikey: anonKey },
      });
      if (!verifyRes.ok) {
        await verifyRes.text();
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await verifyRes.text();
    }

    const body = await req.json();
    const { teaching_asset_id } = body;
    if (!teaching_asset_id) {
      return new Response(JSON.stringify({ error: "Missing required field: teaching_asset_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Fetch asset data
    const { asset, chapter, course, problemInstructions } = await fetchAssetData(supabaseUrl, serviceRoleKey, teaching_asset_id);

    const assetCode = asset.asset_name || "";
    const courseCode = course?.code || "";
    const chapterNumber = chapter?.chapter_number ?? 0;

    // Get Google credentials
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    // Navigate to asset subfolder
    const { chapterFolderId } = await ensureFolderHierarchy(token, courseCode, chapterNumber, sa.client_email);
    const assetFolderId = await findOrCreateFolder(token, assetCode, chapterFolderId);

    console.log(`Asset folder: ${assetFolderId} for ${assetCode}`);

    // Archive previous prep doc if one exists
    if (asset.prep_doc_id) {
      console.log(`Archiving previous prep doc: ${asset.prep_doc_id}`);
      await archivePreviousPrepDoc(token, assetFolderId, asset.prep_doc_id, assetCode);
    }

    // Build JE data
    const jeEntries = normalizeJEFromJson(asset.journal_entry_completed_json);
    const jeRawText = jeToRawText(jeEntries);

    // Create a blank Google Doc via Drive API
    const docTitle = `${assetCode} — Tutoring Prep`;
    console.log(`Creating doc "${docTitle}" in folder ${assetFolderId}...`);
    const docCreateRes = await googleFetch(`${GOOGLE_DRIVE_API}?supportsAllDrives=true`, token, {
      method: "POST",
      body: JSON.stringify({
        name: docTitle,
        mimeType: "application/vnd.google-apps.document",
        parents: [assetFolderId],
      }),
    });
    const docId = docCreateRes.id;
    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
    console.log(`Created doc: ${docId}`);

    // Build and apply document content
    const batchRequests = buildDocRequests(asset, course, chapter, problemInstructions, jeEntries, jeRawText);

    if (batchRequests.length > 0) {
      await googleFetch(`${GOOGLE_DOCS_API}/${docId}:batchUpdate`, token, {
        method: "POST",
        body: JSON.stringify({ requests: batchRequests }),
      });
      console.log("Doc content populated successfully");
    }

    // Make doc viewable by anyone with link
    await googleFetch(`${GOOGLE_DRIVE_API}/${docId}/permissions?supportsAllDrives=true`, token, {
      method: "POST",
      body: JSON.stringify({ type: "anyone", role: "reader" }),
    });

    // Update Supabase
    await fetch(`${supabaseUrl}/rest/v1/teaching_assets?id=eq.${teaching_asset_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: anonKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ prep_doc_id: docId, prep_doc_url: docUrl }),
    });

    return new Response(JSON.stringify({
      success: true,
      doc_url: docUrl,
      doc_id: docId,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("create-prep-doc error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    const httpStatus = err.googleCode && err.googleCode >= 400 && err.googleCode < 500 ? err.googleCode : 500;
    return new Response(JSON.stringify({
      success: false,
      error: msg,
    }), {
      status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
