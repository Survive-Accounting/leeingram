const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// ── Google Auth helpers (same as create-asset-sheet) ──────────────────

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
    throw new Error(`Google API ${code}: ${message}`);
  }
  return data;
}

// ── T-Accounts / Tables converters (same as create-asset-sheet) ──────

function tAccountsToTsv(json: any): string {
  if (!json) return "";
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!Array.isArray(data)) return "";
    const lines: string[] = ["Account\tDebits\tCredits"];
    for (const acct of data) {
      const name = acct.account_name || "";
      const debits = Array.isArray(acct.debits) ? acct.debits.join(", ") : "";
      const credits = Array.isArray(acct.credits) ? acct.credits.join(", ") : "";
      lines.push(`${name}\t${debits}\t${credits}`);
    }
    return lines.join("\n");
  } catch { return ""; }
}

function structuredTablesToTsv(json: any): string {
  if (!json) return "";
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!Array.isArray(data)) return "";
    return data.map((t: any) => {
      const title = t.title || "Untitled";
      const tsv = t.tsv || "";
      return `--- ${title} ---\n${tsv}`;
    }).join("\n\n");
  } catch { return ""; }
}

function applyHighlightsToText(text: string, highlights: any[]): string {
  if (!Array.isArray(highlights) || highlights.length === 0 || !text) return text;
  const matches: Array<{ start: number; end: number; text: string }> = [];
  for (const h of highlights) {
    if (!h?.text || typeof h.text !== "string") continue;
    const idx = text.indexOf(h.text);
    if (idx !== -1) matches.push({ start: idx, end: idx + h.text.length, text: h.text });
  }
  matches.sort((a, b) => a.start - b.start);
  const clean: typeof matches = [];
  for (const m of matches) {
    if (clean.length === 0 || m.start >= clean[clean.length - 1].end) clean.push(m);
  }
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
  return highlights.filter(h => h?.text && h?.type).map(h => `${h.type}: ${h.text}`).join("\n");
}

function jeToRawText(jeJson: any): string {
  if (!jeJson) return "";
  try {
    const data = typeof jeJson === "string" ? JSON.parse(jeJson) : jeJson;
    let entries: any[] = [];
    if (Array.isArray(data)) entries = data;
    else if (data?.entries) entries = data.entries;
    else if (data?.journal_entries) entries = data.journal_entries;
    else return "";
    return entries.map((e: any, i: number) => {
      const lines: string[] = [`Entry ${i + 1}:`];
      const items = e.lines || e.items || [];
      for (const item of items) {
        const acct = item.account || item.account_name || "";
        const dr = item.debit || item.dr || "";
        const cr = item.credit || item.cr || "";
        if (dr) lines.push(`  Dr ${acct}  ${dr}`);
        if (cr) lines.push(`    Cr ${acct}  ${cr}`);
      }
      return lines.join("\n");
    }).join("\n\n");
  } catch { return ""; }
}

function buildAnswerSummary(asset: any): string {
  const text = asset.survive_solution_text || "";
  return text.length > 5000 ? text.slice(0, 5000) + "…" : text;
}

function buildInstructionList(instructions: any[]): string {
  if (!instructions || instructions.length === 0) return "";
  return instructions
    .sort((a: any, b: any) => a.instruction_number - b.instruction_number)
    .map((i: any) => `${i.instruction_number}. ${i.instruction_text}`)
    .join("\n");
}

// ── Hidden_Data field map (row index → field key) ────────────────────
// Row 1 is the header row, so data starts at row 2 (index 1)

const FIELD_MAP: { row: number; key: string }[] = [
  { row: 2, key: "problem_context" },
  { row: 3, key: "problem_text" },
  { row: 4, key: "problem_text_highlighted" },
  { row: 5, key: "instruction_list" },
  { row: 6, key: "instruction_1" },
  { row: 7, key: "instruction_2" },
  { row: 8, key: "instruction_3" },
  { row: 9, key: "instruction_4" },
  { row: 10, key: "instruction_5" },
  { row: 11, key: "problem_solution" },
  { row: 12, key: "answer_summary" },
  { row: 13, key: "journal_entry_raw" },
  { row: 14, key: "t_accounts_raw" },
  { row: 15, key: "tables_raw" },
  { row: 16, key: "financial_statements_raw" },
  { row: 17, key: "worked_steps" },
  { row: 18, key: "important_formulas" },
  { row: 19, key: "concept_notes" },
  { row: 20, key: "exam_traps" },
  { row: 21, key: "validation_notes" },
  { row: 22, key: "highlight_tags" },
];

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

    const { teaching_asset_id } = await req.json();
    if (!teaching_asset_id) {
      return new Response(JSON.stringify({ error: "Missing teaching_asset_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };

    // ── Step 1: Fetch teaching asset ─────────────────────────────────
    const assetRes = await fetch(
      `${supabaseUrl}/rest/v1/teaching_assets?id=eq.${teaching_asset_id}&select=*`,
      { headers: authHeaders }
    );
    const assets = await assetRes.json();
    const asset = assets?.[0];
    if (!asset) {
      return new Response(JSON.stringify({ error: "Teaching asset not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!asset.sheet_master_url) {
      return new Response(JSON.stringify({ error: "No sheet_master_url set on this asset. Create a sheet first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch chapter & course names
    let chapterName = "";
    let courseName = "";
    if (asset.chapter_id) {
      const chRes = await fetch(
        `${supabaseUrl}/rest/v1/chapters?id=eq.${asset.chapter_id}&select=chapter_name`,
        { headers: authHeaders }
      );
      const chs = await chRes.json();
      chapterName = chs?.[0]?.chapter_name || "";
    }
    if (asset.course_id) {
      const coRes = await fetch(
        `${supabaseUrl}/rest/v1/courses?id=eq.${asset.course_id}&select=course_name`,
        { headers: authHeaders }
      );
      const cos = await coRes.json();
      courseName = cos?.[0]?.course_name || "";
    }

    // Fetch variant highlights
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

    // Fetch problem instructions
    const instrRes = await fetch(
      `${supabaseUrl}/rest/v1/problem_instructions?teaching_asset_id=eq.${teaching_asset_id}&select=instruction_number,instruction_text&order=instruction_number`,
      { headers: authHeaders }
    );
    const instrData = await instrRes.json();
    const problemInstructions = Array.isArray(instrData) ? instrData : [];

    // ── Step 2: Extract Sheet file ID ────────────────────────────────
    const sheetUrlMatch = asset.sheet_master_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetUrlMatch) {
      return new Response(JSON.stringify({ error: "Cannot parse spreadsheet ID from sheet_master_url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const spreadsheetId = sheetUrlMatch[1];

    // ── Step 3: Google auth ──────────────────────────────────────────
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    // ── Step 4: Read existing Hidden_Data values ─────────────────────
    let existingValues: string[][] = [];
    try {
      const readRes = await googleFetch(
        `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/'Hidden_Data'!A1:B30?majorDimension=ROWS`,
        token
      );
      existingValues = readRes.values || [];
    } catch (e: any) {
      if (e.message.includes("400") || e.message.includes("Unable to parse range")) {
        return new Response(JSON.stringify({ error: "Hidden_Data tab not found in this spreadsheet. Create a sheet first to populate the Hidden_Data tab." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    // ── Step 5: Build new values, only for empty cells ───────────────
    const problemText = asset.survive_problem_text || "";
    const highlightedText = applyHighlightsToText(problemText, highlights);
    const instrSlots = ["", "", "", "", ""];
    for (const instr of problemInstructions) {
      const idx = instr.instruction_number - 1;
      if (idx >= 0 && idx < 5) instrSlots[idx] = instr.instruction_text || "";
    }

    const newValues: Record<string, string> = {
      problem_context: asset.problem_context || "",
      problem_text: problemText,
      problem_text_highlighted: highlightedText,
      instruction_list: buildInstructionList(problemInstructions),
      instruction_1: instrSlots[0],
      instruction_2: instrSlots[1],
      instruction_3: instrSlots[2],
      instruction_4: instrSlots[3],
      instruction_5: instrSlots[4],
      problem_solution: asset.survive_solution_text || "",
      answer_summary: buildAnswerSummary(asset),
      journal_entry_raw: jeToRawText(asset.journal_entry_completed_json),
      t_accounts_raw: tAccountsToTsv(asset.t_accounts_json),
      tables_raw: structuredTablesToTsv(asset.tables_json),
      financial_statements_raw: structuredTablesToTsv(asset.financial_statements_json),
      worked_steps: asset.survive_solution_text || "",
      important_formulas: asset.important_formulas || "",
      concept_notes: asset.concept_notes || "",
      exam_traps: asset.exam_traps || "",
      validation_notes: "",
      highlight_tags: extractHighlightTags(highlights),
    };

    const fieldsWritten: string[] = [];
    const fieldsSkipped: string[] = [];
    const updateData: { range: string; values: string[][] }[] = [];

    for (const field of FIELD_MAP) {
      const rowIdx = field.row - 1; // 0-based
      const existingRow = existingValues[rowIdx];
      const existingB = existingRow?.[1]?.trim() || "";

      if (existingB) {
        fieldsSkipped.push(field.key);
      } else {
        const val = newValues[field.key] || "";
        if (val) {
          updateData.push({
            range: `'Hidden_Data'!B${field.row}`,
            values: [[val]],
          });
          fieldsWritten.push(field.key);
        } else {
          fieldsSkipped.push(field.key);
        }
      }
    }

    // ── Step 6: Batch write all empty fields ─────────────────────────
    if (updateData.length > 0) {
      await googleFetch(
        `${GOOGLE_SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
        token,
        {
          method: "POST",
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: updateData,
          }),
        }
      );
    }

    const sheetUrl = asset.sheet_master_url;

    return new Response(JSON.stringify({
      success: true,
      fields_written: fieldsWritten,
      fields_skipped: fieldsSkipped,
      sheet_url: sheetUrl,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("sync-hidden-data error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
