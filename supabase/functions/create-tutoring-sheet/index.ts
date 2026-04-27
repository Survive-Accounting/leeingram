// Creates a fresh Google Sheet from scratch (in our service-account Drive)
// pre-filled with problem text + instructions, shared "anyone with link → viewer",
// and returns a /copy URL so the requester drops a personal copy in their own Drive.
//
// V0 for live tutoring. Reuses the same JWT auth pattern as create-asset-sheet.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

// ── Google auth ──────────────────────────────────────────────────────
function base64url(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(pem: string): Promise<CryptoKey> {
  const lines = pem.split("\n").filter(l => !l.startsWith("-----")).join("");
  const binary = Uint8Array.from(atob(lines), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const key = await importKey(sa.private_key);
  const sig = base64url(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  ));
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
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { rawBody: text }; }
  if (!res.ok) {
    const code = data?.error?.code ?? res.status;
    const message = data?.error?.message ?? text;
    console.error(`Google API ${code}: ${message}`, { url: url.split("?")[0] });
    throw new Error(`Google API ${code}: ${message}`);
  }
  return data;
}

// ── Helpers ──────────────────────────────────────────────────────────
function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function chunkInstructions(raw: string): string {
  // If instructions are stored as markdown bullets / lettered parts, normalize to plain lines
  if (!raw) return "";
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const assetId: string | undefined = body?.assetId;
    const userEmail: string | null = body?.email ?? null;
    if (!assetId || typeof assetId !== "string") {
      return new Response(JSON.stringify({ error: "assetId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Fetch asset + chapter + course server-side (don't trust client payload)
    const { data: asset, error: assetErr } = await supabase
      .from("teaching_assets")
      .select("id, asset_name, source_ref, survive_problem_text, problem_context, chapter_id, course_id")
      .eq("id", assetId)
      .maybeSingle();

    if (assetErr || !asset) {
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: chapter }, { data: course }] = await Promise.all([
      supabase.from("chapters")
        .select("id, chapter_number, chapter_name, course_id")
        .eq("id", asset.chapter_id ?? "")
        .maybeSingle(),
      supabase.from("courses")
        .select("id, code, course_name")
        .eq("id", asset.course_id ?? "")
        .maybeSingle(),
    ]);

    // Pull instructions: prefer problem_context, fall back to message in body
    const problemText = stripHtml(asset.survive_problem_text || "");
    const instructionsText = chunkInstructions(stripHtml(asset.problem_context || ""))
      || "See problem text above.";

    const courseLabel = course?.course_name || course?.code || "—";
    const chapterLabel = chapter
      ? `Ch ${chapter.chapter_number} — ${chapter.chapter_name}`
      : "—";
    const problemLabel = asset.source_ref || asset.asset_name || "—";
    const originalUrl = asset.asset_name
      ? `https://learn.surviveaccounting.com/v2/solutions/${asset.asset_name}`
      : "";

    const fileTitle = `Survive Accounting - ${course?.code || "Course"} Ch ${chapter?.chapter_number ?? "?"} - ${problemLabel}`;

    // ── Google auth ──
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    // 1. Create empty spreadsheet
    const created = await googleFetch(GOOGLE_SHEETS_API, token, {
      method: "POST",
      body: JSON.stringify({
        properties: { title: fileTitle },
        sheets: [{ properties: { title: "Problem", sheetId: 0, gridProperties: { rowCount: 60, columnCount: 6 } } }],
      }),
    });
    const spreadsheetId: string = created.spreadsheetId;

    // 2. Write values (USER_ENTERED so we get formatting later)
    const values = [
      ["Survive Accounting Problem Sheet"],          // A1
      [`Course: ${courseLabel}`],                    // A2
      [`Chapter: ${chapterLabel}`],                  // A3
      [`Problem: ${problemLabel}`],                  // A4
      [""],                                          // A5
      ["Problem Text"],                              // A6
      [problemText || "—"],                          // A7
      [""], [""], [""], [""],                        // A8–A11
      ["Instructions"],                              // A12
      [instructionsText],                            // A13
      [""], [""], [""], [""],                        // A14–A17
      ["Work Area"],                                 // A18
      [""], [""], [""], [""], [""], [""],            // A19–A24 — blank for tutoring
      ["Original Problem Link"],                     // A25
      [originalUrl || "—"],                          // A26
    ];
    await googleFetch(
      `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/Problem!A1:A${values.length}?valueInputOption=USER_ENTERED`,
      token,
      { method: "PUT", body: JSON.stringify({ range: `Problem!A1:A${values.length}`, majorDimension: "ROWS", values }) },
    );

    // 3. Formatting via batchUpdate
    const SHEET_ID = 0;
    const headerRows = [0, 5, 11, 17, 24]; // A1, A6, A12, A18, A25 (zero-indexed)
    const requests: any[] = [
      // Title row: bold, larger
      {
        repeatCell: {
          range: { sheetId: SHEET_ID, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 16 } } },
          fields: "userEnteredFormat(textFormat)",
        },
      },
      // Section headers: bold + light grey background
      ...headerRows.slice(1).map((rowIdx) => ({
        repeatCell: {
          range: { sheetId: SHEET_ID, startRowIndex: rowIdx, endRowIndex: rowIdx + 1, startColumnIndex: 0, endColumnIndex: 4 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 12 },
              backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
            },
          },
          fields: "userEnteredFormat(textFormat,backgroundColor)",
        },
      })),
      // Wrap text on column A
      {
        repeatCell: {
          range: { sheetId: SHEET_ID, startRowIndex: 0, endRowIndex: values.length, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
          fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
        },
      },
      // Widen column A
      {
        updateDimensionProperties: {
          range: { sheetId: SHEET_ID, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 720 },
          fields: "pixelSize",
        },
      },
      // Freeze top row
      {
        updateSheetProperties: {
          properties: { sheetId: SHEET_ID, gridProperties: { frozenRowCount: 1 } },
          fields: "gridProperties.frozenRowCount",
        },
      },
    ];

    await googleFetch(`${GOOGLE_SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });

    // 4. Make readable by anyone with link (so /copy works without sign-in to our account)
    await googleFetch(`${GOOGLE_DRIVE_API}/${spreadsheetId}/permissions?supportsAllDrives=true`, token, {
      method: "POST",
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });

    // 5. Build /copy URL — Google shows a "Make a copy" prompt, drops it in *their* Drive
    const copyUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/copy?title=${encodeURIComponent(fileTitle)}`;
    const editUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // 6. Log success event (best-effort)
    try {
      await supabase.from("export_events").insert({
        event_name: "google_sheet_export_created",
        asset_id: asset.id,
        asset_code: asset.asset_name,
        chapter_id: chapter?.id ?? null,
        course_id: course?.id ?? null,
        email: userEmail,
        sheet_url: copyUrl,
        metadata: { spreadsheet_id: spreadsheetId, edit_url: editUrl, file_title: fileTitle },
      });
    } catch (e) {
      console.warn("export_events insert failed (non-fatal):", e);
    }

    return new Response(
      JSON.stringify({ success: true, copyUrl, editUrl, spreadsheetId, fileTitle }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("create-tutoring-sheet failed:", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
