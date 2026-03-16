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

// ── Doc builder helpers ──────────────────────────────────────────────

interface DocSection {
  heading?: string;
  headingLevel?: "HEADING_1" | "HEADING_2";
  headingColor?: { red: number; green: number; blue: number };
  subSections?: Array<{
    label?: string;
    text: string;
    bgColor?: { red: number; green: number; blue: number };
    fontFamily?: string;
    fontSize?: number;
  }>;
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { red: r, green: g, blue: b };
}

const NAVY = hexToRgb("#131E35");
const GRAY = hexToRgb("#666666");
const DARK_GRAY = hexToRgb("#333333");
const RED = hexToRgb("#C0392B");
const LIGHT_GRAY = hexToRgb("#AAAAAA");

function buildDocSections(
  asset: any, course: any, chapter: any, problemInstructions: any[], jeRawText: string
): DocSection[] {
  const sections: DocSection[] = [];
  const assetName = asset.asset_name || "";
  const courseCode = course?.code || "";
  const courseName = course?.course_name || "";
  const chNum = chapter?.chapter_number ?? "";
  const chName = chapter?.chapter_name || "";
  const sourceRef = asset.source_ref || "";

  // HEADER
  sections.push({
    heading: assetName,
    headingLevel: "HEADING_1",
    headingColor: NAVY,
    subSections: [{
      text: `${courseName} · Ch ${chNum} — ${chName} · Source: ${sourceRef}`,
      fontSize: 10,
      bgColor: undefined,
    }],
  });

  // PROBLEM
  const problemSubs: DocSection["subSections"] = [];
  if (asset.problem_context?.trim()) {
    problemSubs.push({ label: "Context", text: asset.problem_context, fontSize: 11 });
  }
  if (asset.survive_problem_text?.trim()) {
    problemSubs.push({ label: "Problem", text: asset.survive_problem_text, fontSize: 11 });
  }
  if (problemSubs.length > 0) {
    sections.push({ heading: "PROBLEM", headingLevel: "HEADING_2", headingColor: NAVY, subSections: problemSubs });
  }

  // INSTRUCTIONS
  const sortedInstr = [...problemInstructions].sort((a, b) => a.instruction_number - b.instruction_number);
  const instrTexts = sortedInstr.filter(i => i.instruction_text?.trim()).map((i, idx) => {
    const letter = String.fromCharCode(97 + idx); // a, b, c...
    return `(${letter}) ${i.instruction_text}`;
  });
  if (instrTexts.length > 0) {
    sections.push({
      heading: "REQUIRED",
      headingLevel: "HEADING_2",
      headingColor: NAVY,
      subSections: [{ text: instrTexts.join("\n"), fontSize: 11 }],
    });
  }

  // ANSWER SUMMARY
  const answerSummary = asset.survive_solution_text || "";
  if (answerSummary.trim()) {
    sections.push({
      heading: "ANSWER SUMMARY",
      headingLevel: "HEADING_2",
      headingColor: NAVY,
      subSections: [{ text: answerSummary, fontSize: 11, bgColor: hexToRgb("#E8F5E9") }],
    });
  }

  // JOURNAL ENTRIES
  if (jeRawText.trim()) {
    sections.push({
      heading: "JOURNAL ENTRIES",
      headingLevel: "HEADING_2",
      headingColor: NAVY,
      subSections: [{ text: jeRawText, fontSize: 10, fontFamily: "Courier New", bgColor: hexToRgb("#F5F5F5") }],
    });
  }

  // WORKED STEPS
  const workedSteps = asset.survive_solution_text || "";
  // Only include if different from answer_summary or if there's dedicated worked_steps
  // Note: the spec says worked_steps field but asset uses survive_solution_text
  // We'll check if there's explicit worked_steps-like content via important_formulas etc.

  // IMPORTANT FORMULAS
  if (asset.important_formulas?.trim()) {
    sections.push({
      heading: "IMPORTANT FORMULAS",
      headingLevel: "HEADING_2",
      headingColor: NAVY,
      subSections: [{ text: asset.important_formulas, fontSize: 10, fontFamily: "Courier New", bgColor: hexToRgb("#FFF8E1") }],
    });
  }

  // CONCEPT NOTES
  if (asset.concept_notes?.trim()) {
    sections.push({
      heading: "CONCEPTS",
      headingLevel: "HEADING_2",
      headingColor: NAVY,
      subSections: [{ text: asset.concept_notes, fontSize: 11 }],
    });
  }

  // EXAM TRAPS
  if (asset.exam_traps?.trim()) {
    sections.push({
      heading: "⚠ EXAM TRAPS",
      headingLevel: "HEADING_2",
      headingColor: RED,
      subSections: [{ text: asset.exam_traps, fontSize: 11, bgColor: hexToRgb("#FFEBEE") }],
    });
  }

  return sections;
}

function buildBatchUpdateRequests(sections: DocSection[], assetName: string): any[] {
  // Build text content first, then create requests
  // Google Docs API inserts text at index, and we need to build from end to start
  // OR build content sequentially and track index.
  // Easier approach: build full text, then apply styles.

  const textParts: Array<{
    text: string;
    style: {
      bold?: boolean;
      fontSize?: number;
      fontFamily?: string;
      foregroundColor?: { red: number; green: number; blue: number };
      backgroundColor?: { red: number; green: number; blue: number };
      namedStyleType?: string;
      indentStart?: number;
    };
  }> = [];

  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];

    // Heading
    if (section.heading) {
      textParts.push({
        text: section.heading + "\n",
        style: {
          bold: true,
          fontSize: section.headingLevel === "HEADING_1" ? 18 : 13,
          foregroundColor: section.headingColor,
          namedStyleType: section.headingLevel,
        },
      });
    }

    // Sub-sections
    if (section.subSections) {
      for (const sub of section.subSections) {
        if (sub.label) {
          textParts.push({
            text: sub.label + "\n",
            style: { bold: true, fontSize: 11, foregroundColor: DARK_GRAY },
          });
        }
        textParts.push({
          text: sub.text + "\n",
          style: {
            fontSize: sub.fontSize || 11,
            fontFamily: sub.fontFamily,
            backgroundColor: sub.bgColor,
            indentStart: 14,
          },
        });
      }
    }

    // Add blank line between sections
    textParts.push({ text: "\n", style: { fontSize: 10 } });
  }

  // Footer
  const today = new Date().toISOString().split("T")[0];
  textParts.push({
    text: `Generated by Survive Accounting · ${assetName} · ${today}\n`,
    style: { fontSize: 8, foregroundColor: LIGHT_GRAY },
  });

  // Now build the requests: insert all text first, then style
  const fullText = textParts.map(p => p.text).join("");
  const requests: any[] = [];

  // Insert all text at index 1 (after the initial newline that docs start with)
  requests.push({
    insertText: { location: { index: 1 }, text: fullText },
  });

  // Apply styles
  let idx = 1;
  for (const part of textParts) {
    const endIdx = idx + part.text.length;
    if (part.text.trim().length === 0) { idx = endIdx; continue; }

    // Paragraph style (heading)
    if (part.style.namedStyleType) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: idx, endIndex: endIdx },
          paragraphStyle: { namedStyleType: part.style.namedStyleType },
          fields: "namedStyleType",
        },
      });
    }

    // Indent
    if (part.style.indentStart) {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: idx, endIndex: endIdx },
          paragraphStyle: { indentStart: { magnitude: part.style.indentStart, unit: "PT" } },
          fields: "indentStart",
        },
      });
    }

    // Text style
    const textStyle: any = {};
    const fields: string[] = [];

    if (part.style.bold !== undefined) { textStyle.bold = part.style.bold; fields.push("bold"); }
    if (part.style.fontSize) {
      textStyle.fontSize = { magnitude: part.style.fontSize, unit: "PT" };
      fields.push("fontSize");
    }
    if (part.style.fontFamily) {
      textStyle.weightedFontFamily = { fontFamily: part.style.fontFamily };
      fields.push("weightedFontFamily");
    }
    if (part.style.foregroundColor) {
      textStyle.foregroundColor = { color: { rgbColor: part.style.foregroundColor } };
      fields.push("foregroundColor");
    }
    if (part.style.backgroundColor) {
      textStyle.backgroundColor = { color: { rgbColor: part.style.backgroundColor } };
      fields.push("backgroundColor");
    }

    if (fields.length > 0) {
      requests.push({
        updateTextStyle: {
          range: { startIndex: idx, endIndex: endIdx },
          textStyle,
          fields: fields.join(","),
        },
      });
    }

    idx = endIdx;
  }

  return requests;
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

    // Build JE text
    const jeEntries = normalizeJEFromJson(asset.journal_entry_completed_json);
    const jeRawText = jeToRawText(jeEntries);

    // Create a blank Google Doc
    const docTitle = `${assetCode} — Tutoring Prep`;
    const docCreateRes = await googleFetch(GOOGLE_DOCS_API, token, {
      method: "POST",
      body: JSON.stringify({ title: docTitle }),
    });
    const docId = docCreateRes.documentId;
    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
    console.log(`Created doc: ${docId}`);

    // Move doc to asset folder
    // Get current parents first
    const fileInfo = await googleFetch(`${GOOGLE_DRIVE_API}/${docId}?fields=parents&supportsAllDrives=true`, token);
    const currentParents = (fileInfo.parents || []).join(",");
    await googleFetch(
      `${GOOGLE_DRIVE_API}/${docId}?addParents=${assetFolderId}&removeParents=${currentParents}&supportsAllDrives=true`,
      token,
      { method: "PATCH", body: JSON.stringify({}) }
    );

    // Build and apply document content
    const docSections = buildDocSections(asset, course, chapter, problemInstructions, jeRawText);
    const batchRequests = buildBatchUpdateRequests(docSections, assetCode);

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
