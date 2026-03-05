const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"];

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

// ── Google API helpers ───────────────────────────────────────────────

async function googleFetch(url: string, token: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) {
    const ge = data?.error;
    const code = ge?.code ?? res.status;
    const status = ge?.status ?? "UNKNOWN";
    const message = ge?.message ?? JSON.stringify(data);
    console.error(`Google API ${code} (${status}): ${message}`, { url: url.split("?")[0], errors: ge?.errors });
    throw Object.assign(new Error(`Google API ${code}: ${message}`), { googleCode: code, googleStatus: status });
  }
  return data;
}

// ── Drive helpers ────────────────────────────────────────────────────

async function findOrCreateFolder(token: string, name: string, parentId?: string): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false${parentId ? ` and '${parentId}' in parents` : ""}`;
  const searchData = await googleFetch(`${GOOGLE_DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name)`, token);
  if (searchData.files?.length) return searchData.files[0].id;

  const createData = await googleFetch(GOOGLE_DRIVE_API, token, {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return createData.id;
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: accept service-role or anon with valid JWT
    const authHeader = req.headers.get("Authorization") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      // Verify JWT via Supabase
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

    const { asset_id, asset_code, course_code, chapter_number, exercise_code, difficulty_estimate, created_at } = await req.json();

    if (!asset_id || !asset_code || !course_code || !chapter_number) {
      return new Response(JSON.stringify({ error: "Missing required fields: asset_id, asset_code, course_code, chapter_number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google credentials
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    // Build folder structure: Survive Accounting Assets / COURSE / Chapter XX
    const rootFolderId = await findOrCreateFolder(token, "Survive Accounting Assets");
    const courseFolderId = await findOrCreateFolder(token, course_code, rootFolderId);
    const chapterLabel = `Chapter ${String(chapter_number).padStart(2, "0")}`;
    const chapterFolderId = await findOrCreateFolder(token, chapterLabel, courseFolderId);

    // Create spreadsheet
    const sheetsRes = await fetch(GOOGLE_SHEETS_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { title: asset_code },
        sheets: [
          { properties: { title: "BRANDED", index: 0 } },
          { properties: { title: "WHITEBOARD", index: 1 } },
          { properties: { title: "SOLUTION", index: 2 } },
          { properties: { title: "HIGHLIGHTED", index: 3 } },
          { properties: { title: "METADATA", index: 4 } },
        ],
      }),
    });
    const spreadsheet = await sheetsRes.json();
    if (!sheetsRes.ok) throw new Error(`Sheets create failed: ${JSON.stringify(spreadsheet)}`);

    const spreadsheetId = spreadsheet.spreadsheetId;
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    // Move spreadsheet into chapter folder
    const getFileRes = await fetch(`${GOOGLE_DRIVE_API}/${spreadsheetId}?fields=parents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const fileData = await getFileRes.json();
    const previousParents = (fileData.parents || []).join(",");

    const moveRes = await fetch(
      `${GOOGLE_DRIVE_API}/${spreadsheetId}?addParents=${chapterFolderId}&removeParents=${previousParents}`,
      { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );
    if (!moveRes.ok) {
      const moveErr = await moveRes.json();
      console.error("Move failed (non-fatal):", moveErr);
    } else {
      await moveRes.text();
    }

    // Populate METADATA sheet
    const metadataValues = [
      ["Field", "Value"],
      ["asset_code", asset_code],
      ["course_code", course_code],
      ["chapter_number", String(chapter_number)],
      ["exercise_number", exercise_code || ""],
      ["difficulty_estimate", String(difficulty_estimate ?? "")],
      ["asset_id", asset_id],
      ["created_at", created_at || ""],
      ["sheet_url", sheetUrl],
    ];

    const updateRes = await fetch(
      `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/METADATA!A1:B9?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ range: "METADATA!A1:B9", majorDimension: "ROWS", values: metadataValues }),
      }
    );
    if (!updateRes.ok) {
      const updateErr = await updateRes.json();
      console.error("Metadata write failed (non-fatal):", updateErr);
    } else {
      await updateRes.text();
    }

    // Update asset in DB with sheet URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const dbRes = await fetch(`${supabaseUrl}/rest/v1/assets?id=eq.${asset_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ google_sheet_url: sheetUrl }),
    });
    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error("DB update failed:", dbErr);
    } else {
      await dbRes.text();
    }

    return new Response(JSON.stringify({ success: true, sheet_url: sheetUrl, spreadsheet_id: spreadsheetId }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    console.error("create-asset-sheet error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
