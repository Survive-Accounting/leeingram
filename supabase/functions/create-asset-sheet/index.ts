const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"];

const ROOT_FOLDER_ID = "1Lu00SDbRHDxlMqAu_sa0aZbSw_HHfSbx";
const ARCHIVE_FOLDER_NAME = "Archive";

// Template file IDs
const MASTER_TEMPLATE_ID = "15yytFbb_tOLCIsR4dLoFVb0oNTFm9X6LfUVN1OKGY-A";
const PRACTICE_TEMPLATE_ID = "15yytFbb_tOLCIsR4dLoFVb0oNTFm9X6LfUVN1OKGY-A"; // TODO: Replace with actual Practice template ID
const PROMO_TEMPLATE_ID = "15yytFbb_tOLCIsR4dLoFVb0oNTFm9X6LfUVN1OKGY-A"; // TODO: Replace with actual Promo template ID

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
    const status = ge?.status ?? "UNKNOWN";
    const message = ge?.message ?? text;
    console.error(`Google API ${code} (${status}): ${message}`, { url: url.split("?")[0], errors: ge?.errors });
    throw Object.assign(new Error(`Google API ${code}: ${message}`), { googleCode: code, googleStatus: status });
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
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return createData.id;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

type DriveSheetFile = { id: string; name: string; parents?: string[]; modifiedTime?: string };

async function findSheetsByNameInFolder(token: string, fileName: string, folderId: string): Promise<DriveSheetFile[]> {
  const safeName = escapeDriveQueryValue(fileName);
  const q = `mimeType='application/vnd.google-apps.spreadsheet' and name='${safeName}' and trashed=false and '${folderId}' in parents`;
  const searchData = await googleFetch(
    `${GOOGLE_DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name,parents,modifiedTime)&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    token
  );
  return (searchData.files || []) as DriveSheetFile[];
}

async function moveFileToFolder(token: string, fileId: string, addParentId: string, removeParentIds: string[]) {
  const params = new URLSearchParams({ supportsAllDrives: "true", addParents: addParentId });
  if (removeParentIds.length > 0) params.set("removeParents", removeParentIds.join(","));
  await googleFetch(`${GOOGLE_DRIVE_API}/${fileId}?${params.toString()}`, token, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

async function archiveDuplicateSheets(token: string, duplicates: DriveSheetFile[], chapterFolderId: string) {
  if (duplicates.length === 0) return;
  const archiveFolderId = await findOrCreateFolder(token, ARCHIVE_FOLDER_NAME, chapterFolderId);
  for (const dup of duplicates) {
    const removeParents = dup.parents?.length ? dup.parents : [chapterFolderId];
    try {
      await moveFileToFolder(token, dup.id, archiveFolderId, removeParents);
      console.log(`Archived duplicate sheet ${dup.id}`);
    } catch (e) { console.error(`Failed to archive duplicate ${dup.id} (non-fatal):`, e); }
  }
}

async function ensureFolderHierarchy(
  token: string, courseCode: string, chapterNumber: string | number, serviceAccountEmail: string
): Promise<{ courseFolderId: string; chapterFolderId: string }> {
  try {
    await googleFetch(`${GOOGLE_DRIVE_API}/${ROOT_FOLDER_ID}?fields=id,name&supportsAllDrives=true`, token);
  } catch (e) {
    throw new Error(`Cannot access shared root folder ${ROOT_FOLDER_ID}. Share with: ${serviceAccountEmail}`);
  }
  const courseFolderId = await findOrCreateFolder(token, courseCode, ROOT_FOLDER_ID);
  const chapterLabel = `Chapter ${String(chapterNumber).padStart(2, "0")}`;
  const chapterFolderId = await findOrCreateFolder(token, chapterLabel, courseFolderId);
  return { courseFolderId, chapterFolderId };
}

// ── Template copy with duplicate handling ────────────────────────────

async function copyTemplateWithArchive(
  token: string, templateFileId: string, name: string, parentFolderId: string
): Promise<{ fileId: string; isUpdate: boolean }> {
  const existing = await findSheetsByNameInFolder(token, name, parentFolderId);
  if (existing.length > 0) {
    await archiveDuplicateSheets(token, existing, parentFolderId);
  }
  
  const copyRes = await googleFetch(`${GOOGLE_DRIVE_API}/${templateFileId}/copy?supportsAllDrives=true`, token, {
    method: "POST",
    body: JSON.stringify({
      name,
      parents: [parentFolderId],
    }),
  });
  return { fileId: copyRes.id, isUpdate: existing.length > 0 };
}

// ── Ensure a tab exists ──────────────────────────────────────────────

async function ensureTabExists(token: string, spreadsheetId: string, tabName: string) {
  try {
    await googleFetch(
      `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/'${tabName}'!A1?majorDimension=ROWS`,
      token
    );
  } catch {
    try {
      await googleFetch(`${GOOGLE_SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
        method: "POST",
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: tabName } } }],
        }),
      });
    } catch (e) { console.error(`${tabName} tab creation failed:`, e); }
  }
}

// ── Write values to a range (preserves formatting) ───────────────────

async function writeValues(token: string, spreadsheetId: string, range: string, values: string[][]) {
  await googleFetch(
    `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    token,
    { method: "PUT", body: JSON.stringify({ range, majorDimension: "ROWS", values }) }
  );
}

// ── Metadata writer ──────────────────────────────────────────────────

interface MetadataParams {
  asset_code: string;
  course_code: string;
  chapter_number: string;
  exercise_number: string;
  asset_id: string;
  created_at: string;
  sheet_master_url: string;
  sheet_practice_url: string;
  sheet_promo_url: string;
  sheet_path_url: string;
  ebook_page_link: string;
  lw_video_link: string;
  lw_quiz_link: string;
  internal_asset_page: string;
  flag_issue_url: string;
  mark_verified_url: string;
  contact_lee_url: string;
  asset_type: string;
  variant_letter: string;
  variant_count: string;
  journal_entry_count: string;
  sheet_verified: string;
  sheet_ready_for_review: string;
}

function makeHyperlink(label: string, url: string): string {
  if (!url) return "";
  return `=HYPERLINK("${url.replace(/"/g, '""')}","${label.replace(/"/g, '""')}")`;
}

async function writeMetadata(token: string, spreadsheetId: string, params: MetadataParams) {
  const vaActionLinks = [
    makeHyperlink("✅ Mark Sheet Ready for Review", params.mark_verified_url),
    makeHyperlink("⚠️ Flag Issue", params.flag_issue_url),
    makeHyperlink("📂 Open Asset Library Page", params.internal_asset_page),
    makeHyperlink("📧 Contact Lee", params.contact_lee_url),
  ];

  const fieldRows: string[][] = [
    ["Field", "Value", "", "", "", "VA Action Links"],
    ["asset_code", params.asset_code, "", "", "", vaActionLinks[0]],
    ["course_code", params.course_code, "", "", "", vaActionLinks[1]],
    ["chapter_number", params.chapter_number, "", "", "", vaActionLinks[2]],
    ["exercise_number", params.exercise_number, "", "", "", vaActionLinks[3]],
    ["asset_id", params.asset_id, "", "", "", ""],
    ["created_at", params.created_at, "", "", "", ""],
    ["asset_type", params.asset_type, "", "", "", ""],
    ["variant_letter", params.variant_letter, "", "", "", ""],
    ["variant_count", params.variant_count, "", "", "", ""],
    ["journal_entry_count", params.journal_entry_count, "", "", "", ""],
    ["sheet_master_url", params.sheet_master_url, "", "", "", ""],
    ["sheet_practice_url", params.sheet_practice_url, "", "", "", ""],
    ["sheet_promo_url", params.sheet_promo_url, "", "", "", ""],
    ["sheet_path_url", params.sheet_path_url, "", "", "", ""],
    ["internal_asset_page", params.internal_asset_page, "", "", "", ""],
    ["flag_issue_url", params.flag_issue_url, "", "", "", ""],
    ["mark_verified_url", params.mark_verified_url, "", "", "", ""],
    ["contact_lee_url", params.contact_lee_url, "", "", "", ""],
    ["ebook_page_link", params.ebook_page_link, "", "", "", ""],
    ["lw_video_link", params.lw_video_link, "", "", "", ""],
    ["lw_quiz_link", params.lw_quiz_link, "", "", "", ""],
    ["sheet_verified", params.sheet_verified, "", "", "", ""],
    ["sheet_ready_for_review", params.sheet_ready_for_review, "", "", "", ""],
  ];

  await ensureTabExists(token, spreadsheetId, "METADATA");
  const range = `METADATA!A1:F${fieldRows.length}`;
  await writeValues(token, spreadsheetId, range, fieldRows);
}

// ── Hidden_Data writer ───────────────────────────────────────────────

interface HiddenDataParams {
  problem_text: string;
  problem_context: string;
  problem_instructions: string;
  problem_text_highlighted: string;
  answer_summary: string;
  journal_entry_raw: string;
  worked_steps: string;
  concept_notes: string;
  highlight_tags: string;
  validation_notes: string;
}

async function writeHiddenData(token: string, spreadsheetId: string, params: HiddenDataParams) {
  await ensureTabExists(token, spreadsheetId, "Hidden_Data");

  const fieldRows: string[][] = [
    ["Field", "Value"],
    ["problem_text", params.problem_text],
    ["problem_context", params.problem_context],
    ["problem_instructions", params.problem_instructions],
    ["problem_text_highlighted", params.problem_text_highlighted],
    ["answer_summary", params.answer_summary],
    ["journal_entry_raw", params.journal_entry_raw],
    ["worked_steps", params.worked_steps],
    ["concept_notes", params.concept_notes],
    ["highlight_tags", params.highlight_tags],
    ["validation_notes", params.validation_notes],
  ];

  const range = `Hidden_Data!A1:B${fieldRows.length}`;
  await writeValues(token, spreadsheetId, range, fieldRows);
}

// ── Highlight application ────────────────────────────────────────────

function applyHighlightsToText(text: string, highlights: any[]): string {
  if (!Array.isArray(highlights) || highlights.length === 0 || !text) return text;

  // Sort by position, apply non-overlapping highlights
  const matches: Array<{ start: number; end: number; text: string }> = [];
  for (const h of highlights) {
    if (!h?.text || typeof h.text !== "string") continue;
    const idx = text.indexOf(h.text);
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + h.text.length, text: h.text });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  // Remove overlaps
  const clean: typeof matches = [];
  for (const m of matches) {
    if (clean.length === 0 || m.start >= clean[clean.length - 1].end) {
      clean.push(m);
    }
  }

  // Build result with < > markers
  let result = "";
  let pos = 0;
  for (const m of clean) {
    result += text.slice(pos, m.start);
    result += `<${m.text}>`;
    pos = m.end;
  }
  result += text.slice(pos);
  return result;
}

function extractHighlightTags(highlights: any[]): string {
  if (!Array.isArray(highlights) || highlights.length === 0) return "";
  return highlights
    .filter(h => h?.text && h?.type)
    .map(h => `${h.type}: ${h.text}`)
    .join("\n");
}

// ── JournalEntries writer ────────────────────────────────────────────

interface JERow {
  account_name?: string;
  account?: string;
  debit?: number | null;
  credit?: number | null;
  side?: string;
}

interface JEDateEntry {
  date?: string;
  entry_date?: string;
  requirement?: string;
  rows?: JERow[];
  accounts?: JERow[];
}

function normalizeJEFromJson(json: any): JEDateEntry[] {
  if (!json) return [];
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;

    // Format: scenario_sections
    if (data.scenario_sections && Array.isArray(data.scenario_sections)) {
      const entries: JEDateEntry[] = [];
      for (const section of data.scenario_sections) {
        const dateEntries = section.entries_by_date || section.journal_entries || [];
        for (const entry of dateEntries) {
          entries.push({
            date: entry.date || entry.entry_date || entry.requirement || section.label || "",
            rows: entry.rows || entry.accounts || [],
          });
        }
      }
      return entries;
    }

    // Format: flat array
    if (Array.isArray(data)) {
      return data.map((entry: any) => ({
        date: entry.date || entry.entry_date || entry.requirement || "",
        rows: entry.accounts || entry.rows || [],
      }));
    }

    // Format: { parts: [...] }
    if (data.parts && Array.isArray(data.parts)) {
      const entries: JEDateEntry[] = [];
      for (const part of data.parts) {
        for (const entry of (part.journal_entries || part.entries || [])) {
          entries.push({
            date: entry.date || entry.requirement || "",
            rows: entry.accounts || entry.rows || [],
          });
        }
      }
      return entries;
    }

    // Format: { journal_entries: [...] }
    const arr = data.journal_entries || data.entries;
    if (Array.isArray(arr)) {
      return arr.map((entry: any) => ({
        date: entry.date || entry.entry_date || entry.requirement || "",
        rows: entry.accounts || entry.rows || [],
      }));
    }

    return [];
  } catch { return []; }
}

function jeToRawText(entries: JEDateEntry[]): string {
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

type JETemplateMode = "completed" | "accounts_only" | "amounts_only" | "blank";

function buildJETemplateRows(entries: JEDateEntry[], mode: JETemplateMode): string[][] {
  const rows: string[][] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (i > 0) rows.push(["", "", "", ""]); // blank separator

    // Date row
    const dateLabel = (entry.date || "").replace(/\s*\(.*?\)\s*$/, "").trim();
    rows.push([dateLabel, "", "", ""]);

    for (const row of (entry.rows || [])) {
      const acct = row.account_name || row.account || "";
      const isCredit = row.side === "credit" || (row.credit != null && row.credit !== 0 && (row.debit == null || row.debit === 0));
      const debitVal = row.debit != null && row.debit !== 0 ? String(row.debit) : "";
      const creditVal = row.credit != null && row.credit !== 0 ? String(row.credit) : "";

      switch (mode) {
        case "completed":
          rows.push([isCredit ? `    ${acct}` : acct, "", debitVal, creditVal]);
          break;
        case "accounts_only":
          // Show accounts, hide amounts
          rows.push([isCredit ? `    ${acct}` : acct, "", "", ""]);
          break;
        case "amounts_only":
          // Hide accounts, show amounts
          rows.push([isCredit ? "    ???" : "???", "", debitVal, creditVal]);
          break;
        case "blank":
          // All blanked out
          rows.push([isCredit ? "    ???" : "???", "", "", ""]);
          break;
      }
    }
  }
  return rows;
}

async function writeJournalEntries(token: string, spreadsheetId: string, jeJson: any) {
  await ensureTabExists(token, spreadsheetId, "JournalEntries");

  const entries = normalizeJEFromJson(jeJson);
  if (entries.length === 0) {
    await writeValues(token, spreadsheetId, "JournalEntries!A1:D1", [
      ["No journal entries for this asset."]
    ]);
    return;
  }

  const allRows: string[][] = [];

  // Header
  allRows.push(["COMPLETED JOURNAL ENTRIES"]);
  allRows.push(["Account", "", "Debit", "Credit"]);
  allRows.push(...buildJETemplateRows(entries, "completed"));
  allRows.push([""]); allRows.push([""]);

  // Accounts only template
  allRows.push(["TEMPLATE — ACCOUNT TITLES MISSING"]);
  allRows.push(["Account", "", "Debit", "Credit"]);
  allRows.push(...buildJETemplateRows(entries, "amounts_only"));
  allRows.push([""]); allRows.push([""]);

  // Amounts only template
  allRows.push(["TEMPLATE — AMOUNTS MISSING"]);
  allRows.push(["Account", "", "Debit", "Credit"]);
  allRows.push(...buildJETemplateRows(entries, "accounts_only"));
  allRows.push([""]); allRows.push([""]);

  // Fully blank template
  allRows.push(["TEMPLATE — FULLY BLANK"]);
  allRows.push(["Account", "", "Debit", "Credit"]);
  allRows.push(...buildJETemplateRows(entries, "blank"));

  const range = `JournalEntries!A1:D${allRows.length}`;
  await writeValues(token, spreadsheetId, range, allRows);
}

// ── VA Instructions writer ───────────────────────────────────────────

async function writeVaInstructions(token: string, spreadsheetId: string, params: MetadataParams) {
  await ensureTabExists(token, spreadsheetId, "VA Instructions");

  // Clear existing content
  try {
    await googleFetch(
      `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/'VA Instructions':clear`,
      token,
      { method: "POST", body: JSON.stringify({}) }
    );
  } catch (e) { console.error("VA Instructions clear failed (non-fatal):", e); }

  const rows: string[][] = [
    ["VA Instructions — Sheet Prep Workflow"],
    [""],
    ["Follow each step below to prepare this asset's Google Sheets for production."],
    [""],
    ["STEP 1: Open Asset Library"],
    ["Open the asset page to review the problem, solution, and journal entry."],
    [makeHyperlink("📂 Open Asset Library Page", params.internal_asset_page)],
    [""],
    ["STEP 2: Build or Refine the Master Whiteboard"],
    ["Open the Master Sheet and:"],
    ["  • Format the problem clearly"],
    ["  • Build the whiteboard layout"],
    ["  • Add tables if needed"],
    ["  • Add journal entry template if needed"],
    [""],
    ["If journal entries exist:"],
    ["Open the Asset Library page and use the Copy Journal Entry TSV feature"],
    ["to paste the entries into the JE table."],
    [makeHyperlink("📋 Open Master Sheet", params.sheet_master_url)],
    [""],
    ["STEP 3: Review Generated Sheets"],
    ["Open the Practice and Promo sheets. Verify formatting, tables, and layout."],
    [makeHyperlink("✏️ Open Practice Sheet (Study Pass)", params.sheet_practice_url)],
    [makeHyperlink("📣 Open Promo Sheet", params.sheet_promo_url)],
    [""],
    ["STEP 4: Verify Metadata Links"],
    ["Check if the following links exist in the Metadata tab:"],
    ["  • ebook_page_link"],
    ["  • lw_video_link"],
    ["  • lw_quiz_link"],
    [""],
    ["STEP 5: Submit for Review"],
    ["When the Master sheet is complete and generated sheets look correct,"],
    ["click below to change sheet_ready_for_review to Yes."],
    [makeHyperlink("✅ Mark Sheet Ready for Review", params.mark_verified_url)],
    [""],
    ["STEP 6: Report Issues"],
    ["Use Flag Issue or contact Lee if something is unclear."],
    [makeHyperlink("⚠️ Flag Issue", params.flag_issue_url)],
    [makeHyperlink("📧 Contact Lee", params.contact_lee_url)],
  ];

  const range = `'VA Instructions'!A1:A${rows.length}`;
  await writeValues(token, spreadsheetId, range, rows);
}

// ── DB fetch helper ──────────────────────────────────────────────────

async function fetchAssetData(supabaseUrl: string, serviceRoleKey: string, assetId: string) {
  const authHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };
  
  const assetRes = await fetch(
    `${supabaseUrl}/rest/v1/teaching_assets?id=eq.${assetId}&select=*`,
    { headers: authHeaders }
  );
  const assets = await assetRes.json();
  const asset = assets?.[0];
  if (!asset) throw new Error(`Teaching asset not found: ${assetId}`);

  let chapter: any = null;
  if (asset.chapter_id) {
    const chRes = await fetch(
      `${supabaseUrl}/rest/v1/chapters?id=eq.${asset.chapter_id}&select=id,chapter_number,chapter_name,course_id`,
      { headers: authHeaders }
    );
    const chapters = await chRes.json();
    chapter = chapters?.[0] || null;
  }

  let course: any = null;
  if (asset.course_id) {
    const coRes = await fetch(
      `${supabaseUrl}/rest/v1/courses?id=eq.${asset.course_id}&select=id,course_name,code`,
      { headers: authHeaders }
    );
    const courses = await coRes.json();
    course = courses?.[0] || null;
  }

  const flagRes = await fetch(
    `${supabaseUrl}/rest/v1/asset_flags?teaching_asset_id=eq.${assetId}&status=eq.open&select=id`,
    { headers: { ...authHeaders, Prefer: "count=exact" } }
  );
  const flagCount = parseInt(flagRes.headers.get("content-range")?.split("/")?.[1] || "0", 10);

  let variantCount = 1;
  if (asset.source_ref && asset.chapter_id) {
    const varRes = await fetch(
      `${supabaseUrl}/rest/v1/teaching_assets?chapter_id=eq.${asset.chapter_id}&source_ref=eq.${encodeURIComponent(asset.source_ref)}&select=id`,
      { headers: { ...authHeaders, Prefer: "count=exact" } }
    );
    variantCount = parseInt(varRes.headers.get("content-range")?.split("/")?.[1] || "1", 10);
  }

  let jeCount = 0;
  if (asset.journal_entry_completed_json) {
    const jeData = asset.journal_entry_completed_json;
    if (Array.isArray(jeData)) {
      jeCount = jeData.length;
    } else if (typeof jeData === "object") {
      const entries = jeData.entries || jeData.journal_entries || [];
      jeCount = Array.isArray(entries) ? entries.length : 1;
    }
  }

  // Fetch variant highlights if base_raw_problem_id exists
  let highlights: any[] = [];
  if (asset.base_raw_problem_id) {
    const hlRes = await fetch(
      `${supabaseUrl}/rest/v1/problem_variants?base_problem_id=eq.${asset.base_raw_problem_id}&variant_status=eq.approved&select=highlight_key_json&limit=1`,
      { headers: authHeaders }
    );
    const hlData = await hlRes.json();
    if (hlData?.[0]?.highlight_key_json && Array.isArray(hlData[0].highlight_key_json)) {
      highlights = hlData[0].highlight_key_json;
    }
  }

  return { asset, chapter, course, flagCount, variantCount, jeCount, highlights };
}

// ── Extract variant letter from asset_name ───────────────────────────

function extractVariantLetter(assetName: string): string {
  const match = assetName.match(/_P\d+([A-Z])(?:_V\d+)?$/i);
  return match ? match[1].toUpperCase() : "A";
}

// ── Resolve sheet_ready_for_review status ────────────────────────────

function resolveReadyForReview(status: string): string {
  if (status === "ready_for_review") return "Needs Review";
  if (status === "finalized") return "Finalized";
  return "No";
}

// ── Build answer summary from parts or solution text ─────────────────

function buildAnswerSummary(asset: any): string {
  const solutionText = asset.survive_solution_text || "";
  // If there's structured parts data, summarize it
  if (solutionText) {
    // Truncate very long solutions for the sheet
    return solutionText.length > 5000 ? solutionText.slice(0, 5000) + "…" : solutionText;
  }
  return "";
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
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
    const { asset_id, sheet_types } = body;
    // sheet_types is an optional array: ["master"], ["practice"], ["promo"], or any combination
    // If not provided, defaults to all three
    const typesToCreate: Set<string> = sheet_types && Array.isArray(sheet_types) && sheet_types.length > 0
      ? new Set(sheet_types.map((t: string) => t.toLowerCase()))
      : new Set(["master", "practice", "promo"]);

    if (!asset_id) {
      return new Response(JSON.stringify({ error: "Missing required field: asset_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // ── Fetch all asset data server-side ──────────────────────────────
    const { asset, chapter, course, flagCount, variantCount, jeCount, highlights } = await fetchAssetData(
      supabaseUrl, serviceRoleKey, asset_id
    );

    const assetCode = asset.asset_name || "";
    const courseCode = course?.code || "";
    const chapterNumber = chapter?.chapter_number ?? 0;

    // Get Google credentials
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    // Resolve folder hierarchy
    const { chapterFolderId } = await ensureFolderHierarchy(token, courseCode, chapterNumber, sa.client_email);
    const sheetPathUrl = `https://drive.google.com/drive/folders/${chapterFolderId}`;

    // ── Create 3 sheets ──────────────────────────────────────────────
    const sheetNames = {
      master: `${assetCode}_Master`,
      practice: `${assetCode}_Practice`,
      promo: `${assetCode}_Promo`,
    };

    const results: Record<string, { fileId: string; url: string; error?: string }> = {};
    const errors: string[] = [];

    // Master Sheet
    if (typesToCreate.has("master")) {
      try {
        const { fileId } = await copyTemplateWithArchive(token, MASTER_TEMPLATE_ID, sheetNames.master, chapterFolderId);
        results.master = { fileId, url: `https://docs.google.com/spreadsheets/d/${fileId}` };
        console.log(`Created Master sheet: ${sheetNames.master} (${fileId})`);
      } catch (e: any) {
        const msg = `Master sheet creation failed: ${e.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // Practice Sheet
    if (typesToCreate.has("practice")) {
      try {
        const { fileId } = await copyTemplateWithArchive(token, PRACTICE_TEMPLATE_ID, sheetNames.practice, chapterFolderId);
        results.practice = { fileId, url: `https://docs.google.com/spreadsheets/d/${fileId}` };
        console.log(`Created Practice sheet: ${sheetNames.practice} (${fileId})`);
      } catch (e: any) {
        const msg = `Practice sheet creation failed: ${e.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // Promo Sheet
    if (typesToCreate.has("promo")) {
      try {
        const { fileId } = await copyTemplateWithArchive(token, PROMO_TEMPLATE_ID, sheetNames.promo, chapterFolderId);
        results.promo = { fileId, url: `https://docs.google.com/spreadsheets/d/${fileId}` };
        console.log(`Created Promo sheet: ${sheetNames.promo} (${fileId})`);
      } catch (e: any) {
        const msg = `Promo sheet creation failed: ${e.message}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // If no sheets were created at all, fail
    const createdAny = Object.keys(results).length > 0;
    if (!createdAny) {
      throw new Error(`All sheet creations failed: ${errors.join("; ")}`);
    }

    const masterUrl = results.master?.url || asset.sheet_master_url || "";
    const practiceUrl = results.practice?.url || asset.sheet_practice_url || "";
    const promoUrl = results.promo?.url || asset.sheet_promo_url || "";

    // ── Populate tabs on Master Sheet ────────────────────────────────
    if (results.master) {
      const spreadsheetId = results.master.fileId;
      const appBaseUrl = "https://leeingram.lovable.app";
      const metadataParams: MetadataParams = {
        asset_code: assetCode,
        course_code: courseCode,
        chapter_number: String(chapterNumber),
        exercise_number: asset.source_number || "",
        asset_id: asset.id,
        created_at: asset.created_at || "",
        sheet_master_url: masterUrl,
        sheet_practice_url: practiceUrl,
        sheet_promo_url: promoUrl,
        sheet_path_url: sheetPathUrl,
        ebook_page_link: asset.lw_ebook_url || "",
        lw_video_link: asset.lw_video_url || "",
        lw_quiz_link: asset.lw_quiz_url || "",
        internal_asset_page: `${appBaseUrl}/assets-library?asset=${asset.id}`,
        flag_issue_url: `${appBaseUrl}/assets-library?asset=${asset.id}&action=flag`,
        mark_verified_url: `${appBaseUrl}/assets-library?asset=${asset.id}&action=verify`,
        contact_lee_url: `${appBaseUrl}/assets-library?asset=${asset.id}&action=contact`,
        asset_type: asset.problem_type || "",
        variant_letter: extractVariantLetter(assetCode),
        variant_count: String(variantCount),
        journal_entry_count: String(jeCount),
        sheet_verified: asset.google_sheet_status === "verified_by_va" ? "Yes" : "No",
        sheet_ready_for_review: resolveReadyForReview(asset.google_sheet_status || "none"),
      };

      // 1. METADATA tab
      await writeMetadata(token, spreadsheetId, metadataParams);
      console.log("Metadata populated on Master sheet");

      // 2. Hidden_Data tab
      const problemText = asset.survive_problem_text || "";
      const highlightedText = applyHighlightsToText(problemText, highlights);
      const jeEntries = normalizeJEFromJson(asset.journal_entry_completed_json);

      const hiddenDataParams: HiddenDataParams = {
        problem_text: problemText,
        problem_text_highlighted: highlightedText,
        answer_summary: buildAnswerSummary(asset),
        journal_entry_raw: jeToRawText(jeEntries),
        worked_steps: asset.survive_solution_text || "",
        concept_notes: "", // future use
        highlight_tags: extractHighlightTags(highlights),
        validation_notes: "", // future use
      };
      await writeHiddenData(token, spreadsheetId, hiddenDataParams);
      console.log("Hidden_Data populated on Master sheet");

      // 3. JournalEntries tab
      await writeJournalEntries(token, spreadsheetId, asset.journal_entry_completed_json);
      console.log("JournalEntries populated on Master sheet");

      // 4. VA Instructions tab
      await writeVaInstructions(token, spreadsheetId, metadataParams);
      console.log("VA Instructions populated on Master sheet");
    }

    // ── Persist sheet info back to DB ─────────────────────────────────
    const dbPayload: Record<string, any> = {
      sheet_last_synced_at: new Date().toISOString(),
      sheet_path_url: sheetPathUrl,
    };
    if (results.master) {
      dbPayload.google_sheet_url = masterUrl;
      dbPayload.google_sheet_file_id = results.master.fileId;
      dbPayload.google_sheet_status = "auto_created";
      dbPayload.sheet_master_url = masterUrl;
    }
    if (results.practice) {
      dbPayload.sheet_practice_url = practiceUrl;
    }
    if (results.promo) {
      dbPayload.sheet_promo_url = promoUrl;
    }

    const dbRes = await fetch(`${supabaseUrl}/rest/v1/teaching_assets?id=eq.${asset_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(dbPayload),
    });

    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error("DB update failed:", dbErr);
      throw new Error(`Failed to persist sheet metadata: ${dbErr}`);
    }
    await dbRes.text();

    return new Response(JSON.stringify({
      success: true,
      sheet_master_url: masterUrl,
      sheet_practice_url: practiceUrl,
      sheet_promo_url: promoUrl,
      sheet_path_url: sheetPathUrl,
      sheet_url: masterUrl,
      spreadsheet_id: results.master?.fileId || "",
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("create-asset-sheet error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    const httpStatus = err.googleCode && err.googleCode >= 400 && err.googleCode < 500 ? err.googleCode : 500;
    return new Response(JSON.stringify({ error: msg, google_status: err.googleStatus ?? null }), {
      status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
