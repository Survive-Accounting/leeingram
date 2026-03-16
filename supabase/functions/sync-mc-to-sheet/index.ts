const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

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

// ── JE answer formatter ──────────────────────────────────────────────

function formatJEAnswer(text: string): string {
  // Already formatted or plain text — return as-is
  if (!text) return "";
  return text;
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

    const { teaching_asset_id, export_set_id } = await req.json();
    if (!teaching_asset_id || !export_set_id) {
      return new Response(JSON.stringify({ error: "Missing teaching_asset_id or export_set_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };

    // ── Step 1: Fetch teaching asset ─────────────────────────────────
    const assetRes = await fetch(
      `${supabaseUrl}/rest/v1/teaching_assets?id=eq.${teaching_asset_id}&select=id,asset_name,sheet_master_url`,
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

    // Extract spreadsheet ID
    const sheetUrlMatch = asset.sheet_master_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetUrlMatch) {
      return new Response(JSON.stringify({ error: "Cannot parse spreadsheet ID from sheet_master_url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const spreadsheetId = sheetUrlMatch[1];

    // ── Step 2: Fetch export set name ────────────────────────────────
    const setRes = await fetch(
      `${supabaseUrl}/rest/v1/export_sets?id=eq.${export_set_id}&select=id,name`,
      { headers: authHeaders }
    );
    const sets = await setRes.json();
    const exportSet = sets?.[0];
    if (!exportSet) {
      return new Response(JSON.stringify({ error: "Export set not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 3: Fetch approved banked_questions in this export set for this asset ──
    // First get question IDs from the junction table
    const junctionRes = await fetch(
      `${supabaseUrl}/rest/v1/export_set_questions?export_set_id=eq.${export_set_id}&select=banked_question_id&order=order_index`,
      { headers: authHeaders }
    );
    const junctionRows = await junctionRes.json();
    if (!Array.isArray(junctionRows) || junctionRows.length === 0) {
      return new Response(JSON.stringify({ error: "No questions found in this export set" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questionIds = junctionRows.map((r: any) => r.banked_question_id);

    // Fetch the actual questions, filtered by teaching_asset_id and approved status
    const qIdsParam = questionIds.map((id: string) => `"${id}"`).join(",");
    const questionsRes = await fetch(
      `${supabaseUrl}/rest/v1/banked_questions?id=in.(${qIdsParam})&teaching_asset_id=eq.${teaching_asset_id}&review_status=eq.approved&select=id,question_type,question_text,answer_a,answer_b,answer_c,answer_d,correct_answer,short_explanation&order=question_type.asc,created_at.asc`,
      { headers: authHeaders }
    );
    const questions = await questionsRes.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "No approved questions for this asset in the selected export set" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 4: Google auth & read Hidden_Data ───────────────────────
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    // Read column A to find last occupied row
    let existingValues: string[][] = [];
    try {
      const readRes = await googleFetch(
        `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/'Hidden_Data'!A1:A200?majorDimension=ROWS`,
        token
      );
      existingValues = readRes.values || [];
    } catch (e: any) {
      if (e.message.includes("400") || e.message.includes("Unable to parse range")) {
        return new Response(JSON.stringify({ error: "Hidden_Data tab not found in this spreadsheet." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    // Find last non-empty row in column A
    let lastOccupiedRow = 0;
    for (let i = existingValues.length - 1; i >= 0; i--) {
      if (existingValues[i]?.[0]?.trim()) {
        lastOccupiedRow = i + 1; // 1-indexed
        break;
      }
    }

    // ── Step 5: Build rows to append ─────────────────────────────────
    const startRow = lastOccupiedRow + 2; // Two rows below last data

    // Convert correct_answer letter to number
    function letterToNum(letter: string): number {
      const map: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };
      const upper = (letter || "").trim().toUpperCase();
      if (map[upper]) return map[upper];
      const parsed = parseInt(upper);
      if (!isNaN(parsed)) return parsed;
      return 1;
    }

    const appendRows: string[][] = [];

    // Section marker row
    appendRows.push([
      "MC_QUESTIONS",
      export_set_id,
      new Date().toISOString(),
      String(questions.length),
    ]);

    // Column headers row
    appendRows.push([
      "question_type",
      "question_text",
      "answer_1",
      "answer_2",
      "answer_3",
      "answer_4",
      "correct_answer_index",
      "explanation",
      "export_set_id",
    ]);

    // Data rows
    for (const q of questions) {
      appendRows.push([
        q.question_type || "MC",
        q.question_text || "",
        q.answer_a || "",
        q.answer_b || "",
        q.answer_c || "",
        q.answer_d || "",
        String(letterToNum(q.correct_answer)),
        q.short_explanation || "",
        export_set_id,
      ]);
    }

    // ── Step 6: Write to sheet ───────────────────────────────────────
    const range = `'Hidden_Data'!A${startRow}`;
    await googleFetch(
      `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({
          range: `'Hidden_Data'!A${startRow}`,
          majorDimension: "ROWS",
          values: appendRows,
        }),
      }
    );

    return new Response(JSON.stringify({
      success: true,
      questions_added: questions.length,
      export_set_name: exportSet.name,
      sheet_url: asset.sheet_master_url,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("sync-mc-to-sheet error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
