import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const ROOT_FOLDER_ID = "1Lu00SDbRHDxlMqAu_sa0aZbSw_HHfSbx";
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
];

// ── Google Auth helpers (same as create-prep-doc) ────────────────────

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
    throw Object.assign(new Error(`Google API ${code}: ${message}`), { googleCode: code });
  }
  return data;
}

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

// ── HTML builder ─────────────────────────────────────────────────────

function buildFlowchartHtml(flowchart: any): string {
  const steps = flowchart.steps || [];
  const reminders = flowchart.key_reminders || [];
  const formulas = flowchart.formula_recap || [];

  let stepsHtml = "";
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    stepsHtml += `<div class="step" style="background:${s.color || '#2C3E7A'}">
      <div class="step-title">Step ${s.step_number}: ${escapeHtml(s.title)}</div>
      <div class="step-desc">${escapeHtml(s.description)}</div>
    </div>`;
    if (i < steps.length - 1) {
      stepsHtml += `<div class="arrow">▼</div>`;
    }
  }

  let remindersHtml = "";
  if (reminders.length > 0) {
    remindersHtml = `<div class="reminders">`;
    for (const r of reminders) {
      remindersHtml += `<div class="reminder" style="background:${r.color || '#F5F5F5'};color:#333">
        <div class="reminder-label">${escapeHtml(r.label)}</div>
        <div>${escapeHtml(r.text)}</div>
      </div>`;
    }
    remindersHtml += `</div>`;
  }

  let formulaHtml = "";
  if (formulas.length > 0) {
    formulaHtml = `<div class="formula-recap">
      <div class="formula-recap-title">Key Formulas</div>
      ${formulas.map((f: string) => `<div class="formula-line">${escapeHtml(f)}</div>`).join("")}
    </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: Arial, sans-serif;
    background: #FFFFFF;
    margin: 0;
    padding: 24px;
    width: 600px;
  }
  .title {
    background: #131E35;
    color: white;
    padding: 14px 20px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 20px;
  }
  .step {
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 8px;
    color: white;
  }
  .step-title {
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 4px;
  }
  .step-desc {
    font-size: 12px;
    opacity: 0.9;
    line-height: 1.4;
  }
  .arrow {
    text-align: center;
    color: #999;
    font-size: 18px;
    margin: 2px 0;
  }
  .reminders {
    display: flex;
    gap: 10px;
    margin-top: 16px;
    flex-wrap: wrap;
  }
  .reminder {
    flex: 1;
    min-width: 150px;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 11px;
  }
  .reminder-label {
    font-weight: bold;
    margin-bottom: 4px;
  }
  .formula-recap {
    background: #131E35;
    border-radius: 8px;
    padding: 14px 18px;
    margin-top: 16px;
  }
  .formula-recap-title {
    color: #AAAAAA;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 8px;
  }
  .formula-line {
    color: white;
    font-size: 12px;
    margin-bottom: 4px;
    font-family: monospace;
  }
</style>
</head>
<body>
  <div class="title">${escapeHtml(flowchart.title || "How to Solve This")}</div>
  ${stepsHtml}
  ${remindersHtml}
  ${formulaHtml}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };

    // Auth check
    const reqAuthHeader = req.headers.get("Authorization") || "";
    const isServiceRole = reqAuthHeader === `Bearer ${serviceRoleKey}`;
    if (!isServiceRole) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const sb = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: reqAuthHeader } },
      });
      const token = reqAuthHeader.replace("Bearer ", "");
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { teaching_asset_id } = body;
    if (!teaching_asset_id) {
      return new Response(JSON.stringify({ error: "Missing teaching_asset_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 1 — Fetch asset
    const assetRes = await fetch(
      `${supabaseUrl}/rest/v1/teaching_assets?id=eq.${teaching_asset_id}&select=id,asset_name,worked_steps,important_formulas,concept_notes,problem_context,source_ref,chapter_id,course_id`,
      { headers: authHeaders }
    );
    const assets = await assetRes.json();
    const asset = assets?.[0];
    if (!asset) {
      return new Response(JSON.stringify({ error: "Asset not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if there's enough content to generate a flowchart
    if (!asset.worked_steps?.trim() && !asset.problem_context?.trim()) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No worked_steps or problem_context" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 2 — Generate flowchart JSON via AI
    const prompt = `You are an accounting educator creating a step-by-step solution flowchart for students.

Analyze the worked steps and problem context below.

Generate a flowchart as a JSON object with this exact structure:
{
  "title": "How to Solve This",
  "steps": [
    {
      "step_number": 1,
      "title": "5 words max",
      "description": "1-2 sentences explaining this step",
      "color": "#2C3E7A"
    }
  ],
  "key_reminders": [
    {
      "label": "short label",
      "text": "brief reminder text",
      "color": "#F0F0F0"
    }
  ],
  "formula_recap": [
    "Formula = Components"
  ]
}

Color guide for steps:
- Use a progression from #2C3E7A (dark blue) through #1B6B45 (dark green) for normal steps
- Use #8B3A0F (dark amber/brown) for warning steps or loss recognition steps
- First step always #2C3E7A

Only generate a flowchart if the problem involves a multi-step calculation process (e.g. revenue recognition, bond amortization, lease accounting, depreciation schedules, percentage-of-completion, EPS calculations).

If the problem is a simple single-step journal entry with no multi-step process, return exactly: {"skip": true}

Maximum 6 main steps. Maximum 3 key reminders. Maximum 4 formula recap items.

Return valid JSON only, no explanation.

PROBLEM CONTEXT:
${(asset.problem_context || "").slice(0, 2000)}

WORKED STEPS:
${(asset.worked_steps || "").slice(0, 3000)}

IMPORTANT FORMULAS:
${(asset.important_formulas || "").slice(0, 1000)}`;

    const aiRes = await fetch(`${supabaseUrl}/functions/v1/generate-ai-output`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "lovable",
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_output_tokens: 2000,
      }),
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok || aiData.error) {
      console.error("AI generation failed:", aiData.error);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: `AI error: ${aiData.error || "unknown"}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 3 — Parse and handle skip
    let flowchart = aiData.parsed;
    if (!flowchart) {
      // Try to parse raw
      try {
        let raw = aiData.raw || "";
        raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        flowchart = JSON.parse(raw);
      } catch {
        console.warn("Could not parse flowchart JSON from AI response");
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "Could not parse AI response" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (flowchart.skip === true) {
      console.log(`Flowchart skipped for ${asset.asset_name} — simple problem`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Simple problem, no flowchart needed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!flowchart.steps || !Array.isArray(flowchart.steps) || flowchart.steps.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No steps in flowchart" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 4 — Build HTML
    const html = buildFlowchartHtml(flowchart);

    // STEP 5 — Convert HTML to PNG via HCTI
    const hctiUserId = Deno.env.get("HCTI_USER_ID");
    const hctiApiKey = Deno.env.get("HCTI_API_KEY");

    if (!hctiUserId || !hctiApiKey) {
      console.warn("HCTI credentials not configured");
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "HCTI credentials not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hctiAuth = btoa(`${hctiUserId}:${hctiApiKey}`);
    const hctiRes = await fetch("https://hcti.io/v1/image", {
      method: "POST",
      headers: {
        Authorization: `Basic ${hctiAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        viewport_width: 640,
        viewport_height: 800,
        device_scale: 2,
      }),
    });

    const hctiData = await hctiRes.json();
    if (!hctiRes.ok || !hctiData.url) {
      console.error("HCTI error:", hctiData);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: `HCTI error: ${JSON.stringify(hctiData)}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrl = hctiData.url;
    console.log(`Flowchart image created: ${imageUrl}`);

    // STEP 6 — Upload to Google Drive
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) {
      // No Google creds — just save the HCTI URL directly
      console.warn("No GOOGLE_SERVICE_ACCOUNT_JSON — saving HCTI URL directly");
      await fetch(`${supabaseUrl}/rest/v1/teaching_assets?id=eq.${teaching_asset_id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ flowchart_image_url: imageUrl, flowchart_image_id: null }),
      });

      return new Response(JSON.stringify({
        success: true, skipped: false, image_url: imageUrl, file_id: null, asset_name: asset.asset_name,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sa = JSON.parse(saJson);
    const gToken = await getAccessToken(sa);

    // Fetch chapter and course for folder hierarchy
    let courseCode = "IA2";
    let chapterNumber = 0;
    if (asset.chapter_id) {
      const chRes = await fetch(`${supabaseUrl}/rest/v1/chapters?id=eq.${asset.chapter_id}&select=chapter_number`, { headers: authHeaders });
      const chs = await chRes.json();
      chapterNumber = chs?.[0]?.chapter_number ?? 0;
    }
    if (asset.course_id) {
      const coRes = await fetch(`${supabaseUrl}/rest/v1/courses?id=eq.${asset.course_id}&select=code`, { headers: authHeaders });
      const cos = await coRes.json();
      courseCode = cos?.[0]?.code || "IA2";
    }

    // Navigate folder hierarchy
    const courseFolderId = await findOrCreateFolder(gToken, courseCode, ROOT_FOLDER_ID);
    const chapterLabel = `Chapter ${String(chapterNumber).padStart(2, "0")}`;
    const chapterFolderId = await findOrCreateFolder(gToken, chapterLabel, courseFolderId);
    const assetFolderId = await findOrCreateFolder(gToken, asset.asset_name, chapterFolderId);

    // Download the PNG
    const pngRes = await fetch(imageUrl);
    const pngBlob = await pngRes.blob();
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

    // Upload to Google Drive using multipart upload
    const fileName = `${asset.asset_name}_flowchart.png`;
    const boundary = "flowchart_boundary_" + Date.now();
    const metadata = JSON.stringify({
      name: fileName,
      parents: [assetFolderId],
      mimeType: "image/png",
    });

    const multipartBody = new Uint8Array(
      await new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: image/png\r\n\r\n`,
        pngBytes,
        `\r\n--${boundary}--`,
      ]).arrayBuffer()
    );

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      console.error("Drive upload error:", uploadData);
      // Fall back to HCTI URL
      await fetch(`${supabaseUrl}/rest/v1/teaching_assets?id=eq.${teaching_asset_id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ flowchart_image_url: imageUrl, flowchart_image_id: null }),
      });
      return new Response(JSON.stringify({
        success: true, skipped: false, image_url: imageUrl, file_id: null, asset_name: asset.asset_name,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fileId = uploadData.id;

    // Make file public
    await googleFetch(`${GOOGLE_DRIVE_API}/${fileId}/permissions?supportsAllDrives=true`, gToken, {
      method: "POST",
      body: JSON.stringify({ type: "anyone", role: "reader" }),
    });

    const driveViewUrl = `https://drive.google.com/uc?id=${fileId}&export=view`;

    // STEP 7 — Save to database
    await fetch(`${supabaseUrl}/rest/v1/teaching_assets?id=eq.${teaching_asset_id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ flowchart_image_url: driveViewUrl, flowchart_image_id: fileId }),
    });

    console.log(`Flowchart saved for ${asset.asset_name}: ${driveViewUrl}`);

    // STEP 8 — Return
    return new Response(JSON.stringify({
      success: true,
      skipped: false,
      image_url: driveViewUrl,
      file_id: fileId,
      asset_name: asset.asset_name,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("generate-flowchart error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
