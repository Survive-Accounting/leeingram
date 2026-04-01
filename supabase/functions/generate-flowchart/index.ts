import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Google Auth helpers ────────────────────────────────────────────

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(pem: string): Promise<CryptoKey> {
  const lines = pem.split("\n").filter(l => !l.startsWith("-----")).join("");
  const binary = Uint8Array.from(atob(lines), c => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", binary, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
];

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

// ── HTML builder ─────────────────────────────────────────────────────

function buildFlowchartHtml(flowchart: any): string {
  const steps = flowchart.steps || [];
  const reminders = flowchart.key_reminders || [];

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

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {
    font-family: Arial, sans-serif;
    background: #FFFFFF;
    margin: 0;
    padding: 20px;
    width: 600px;
  }
  .title {
    background: #131E35;
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 14px;
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
  .branding {
    margin-top: 24px;
    padding-top: 14px;
    border-top: 2px solid #D1D5DB;
    text-align: center;
    padding-bottom: 8px;
  }
  .branding-label {
    display: inline-block;
    font-size: 13px;
    color: #6B7280;
  }
</style>
</head>
<body>
  <div class="title">${escapeHtml(flowchart.title || "How to Solve This")}</div>
  ${stepsHtml}
  ${remindersHtml}
  <div class="branding">
    <span class="branding-label"><b style="color:#131E35">SurviveAccounting</b>.com</span>
  </div>
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

// ── Generate a single flowchart image via AI + HCTI ─────────────────

async function generateSingleFlowchart(
  supabaseUrl: string,
  serviceRoleKey: string,
  hctiAuth: string,
  problemContext: string,
  workedSteps: string,
  instructionText: string | null,
  instructionLabel: string | null,
): Promise<{ skipped: boolean; reason?: string; imageUrl?: string }> {
  // Build prompt
  const instructionBlock = instructionText
    ? `\n\nSPECIFIC INSTRUCTION TO SOLVE:\n${instructionLabel ? `${instructionLabel} ` : ""}${instructionText}`
    : "";

  const prompt = `You are an accounting educator creating a step-by-step solution flowchart for students.

Analyze the worked steps and problem context below.${instructionText ? " Focus specifically on the instruction provided." : ""}

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
  ]
}

IMPORTANT: Do NOT include a "formula_recap" section. Formulas are already displayed separately on the page.

Color guide for steps:
- Use a progression from #2C3E7A (dark blue) through #1B6B45 (dark green) for normal steps
- Use #8B3A0F (dark amber/brown) for warning steps or loss recognition steps
- First step always #2C3E7A

Only generate a flowchart if the problem involves a multi-step calculation process (e.g. revenue recognition, bond amortization, lease accounting, depreciation schedules, percentage-of-completion, EPS calculations).

If the problem is a simple single-step journal entry with no multi-step process, return exactly: {"skip": true}

Maximum 6 main steps. Maximum 3 key reminders.

Return valid JSON only, no explanation.

PROBLEM CONTEXT:
${(problemContext || "").slice(0, 2000)}

WORKED STEPS:
${(workedSteps || "").slice(0, 3000)}${instructionBlock}`;

  const aiRes = await fetch(`${supabaseUrl}/functions/v1/generate-ai-output`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "lovable",
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_output_tokens: 2000,
    }),
  });

  const aiData = await aiRes.json();
  if (!aiRes.ok || aiData.error) {
    return { skipped: true, reason: `AI error: ${aiData.error || "unknown"}` };
  }

  let flowchart = aiData.parsed;
  if (!flowchart) {
    try {
      let raw = aiData.raw || "";
      raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      flowchart = JSON.parse(raw);
    } catch {
      return { skipped: true, reason: "Could not parse AI response" };
    }
  }

  if (flowchart.skip === true) {
    return { skipped: true, reason: "Simple problem, no flowchart needed" };
  }

  if (!flowchart.steps || !Array.isArray(flowchart.steps) || flowchart.steps.length === 0) {
    return { skipped: true, reason: "No steps in flowchart" };
  }

  // Build HTML and convert to PNG
  const html = buildFlowchartHtml(flowchart);

  const hctiRes = await fetch("https://hcti.io/v1/image", {
    method: "POST",
    headers: {
      Authorization: `Basic ${hctiAuth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      html,
      viewport_width: 640,
      viewport_height: 2000,
      device_scale: 2,
    }),
  });

  const hctiData = await hctiRes.json();
  if (!hctiRes.ok || !hctiData.url) {
    return { skipped: true, reason: `HCTI error: ${JSON.stringify(hctiData)}` };
  }

  const imageUrl = hctiData.url + ".png";
  return { skipped: false, imageUrl };
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

    // Check if there's enough content
    if (!asset.worked_steps?.trim() && !asset.problem_context?.trim()) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "No worked_steps or problem_context" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check HCTI credentials
    const hctiUserId = Deno.env.get("HCTI_USER_ID");
    const hctiApiKey = Deno.env.get("HCTI_API_KEY");
    if (!hctiUserId || !hctiApiKey) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "HCTI credentials not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const hctiAuth = btoa(`${hctiUserId}:${hctiApiKey}`);

    // STEP 2 — Fetch instructions from problem_instructions table
    const instrRes = await fetch(
      `${supabaseUrl}/rest/v1/problem_instructions?teaching_asset_id=eq.${teaching_asset_id}&select=instruction_number,instruction_text&order=instruction_number`,
      { headers: authHeaders }
    );
    const instrData = await instrRes.json();
    const instructions: { instruction_number: number; instruction_text: string }[] =
      Array.isArray(instrData) ? instrData.filter((i: any) => i.instruction_text?.trim()) : [];

    // STEP 3 — Delete existing flowcharts for this asset
    await fetch(
      `${supabaseUrl}/rest/v1/asset_flowcharts?teaching_asset_id=eq.${teaching_asset_id}`,
      { method: "DELETE", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" } }
    );

    // STEP 4 — Generate flowcharts
    const results: { instruction_number: number; instruction_label: string | null; imageUrl: string }[] = [];

    if (instructions.length <= 1) {
      // Single or no instructions — generate one whole-problem flowchart
      const instrText = instructions.length === 1 ? instructions[0].instruction_text : null;
      const result = await generateSingleFlowchart(
        supabaseUrl, serviceRoleKey, hctiAuth,
        asset.problem_context || "", asset.worked_steps || "",
        instrText, null,
      );
      if (!result.skipped && result.imageUrl) {
        results.push({ instruction_number: 0, instruction_label: null, imageUrl: result.imageUrl });
      }
    } else {
      // Multiple instructions — generate one flowchart per instruction
      for (const instr of instructions) {
        const label = `(${String.fromCharCode(96 + instr.instruction_number)})`;
        const result = await generateSingleFlowchart(
          supabaseUrl, serviceRoleKey, hctiAuth,
          asset.problem_context || "", asset.worked_steps || "",
          instr.instruction_text, label,
        );
        if (!result.skipped && result.imageUrl) {
          results.push({ instruction_number: instr.instruction_number, instruction_label: label, imageUrl: result.imageUrl });
        }
      }
    }

    if (results.length === 0) {
      console.log(`No flowcharts generated for ${asset.asset_name}`);
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "AI skipped all instructions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 5 — Insert into asset_flowcharts
    const rows = results.map(r => ({
      teaching_asset_id,
      instruction_number: r.instruction_number,
      instruction_label: r.instruction_label,
      flowchart_image_url: r.imageUrl,
      flowchart_image_id: null,
    }));

    await fetch(`${supabaseUrl}/rest/v1/asset_flowcharts`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });

    // STEP 6 — Also update the legacy flowchart_image_url on teaching_assets
    // Use the first (or only) flowchart for backward compat
    await fetch(`${supabaseUrl}/rest/v1/teaching_assets?id=eq.${teaching_asset_id}`, {
      method: "PATCH",
      headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ flowchart_image_url: results[0].imageUrl, flowchart_image_id: null }),
    });

    console.log(`Generated ${results.length} flowchart(s) for ${asset.asset_name}`);

    return new Response(JSON.stringify({
      success: true,
      skipped: false,
      flowcharts: results.map(r => ({
        instruction_number: r.instruction_number,
        instruction_label: r.instruction_label,
        image_url: r.imageUrl,
      })),
      asset_name: asset.asset_name,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("generate-flowchart error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
