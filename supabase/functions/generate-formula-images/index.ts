import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logCost } from "../_shared/cost.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildFormulaHtml(name: string, expression: string, explanation: string | null): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 800px; height: 400px;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Inter', sans-serif;
  color: #fff;
  overflow: hidden;
}
.card {
  width: 720px;
  padding: 48px 56px;
  text-align: center;
}
.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  margin-bottom: 20px;
}
.name {
  font-family: 'DM Serif Display', serif;
  font-size: 28px;
  color: #e2e8f0;
  margin-bottom: 24px;
  line-height: 1.3;
}
.expression {
  font-family: 'Inter', monospace;
  font-size: 32px;
  font-weight: 600;
  color: #60a5fa;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(96,165,250,0.2);
  border-radius: 12px;
  padding: 20px 32px;
  margin-bottom: 20px;
  display: inline-block;
  max-width: 100%;
  word-wrap: break-word;
}
.explanation {
  font-size: 14px;
  color: rgba(255,255,255,0.6);
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto;
}
</style>
</head>
<body>
<div class="card">
  <div class="label">Formula to memorize</div>
  <div class="name">${escapeHtml(name)}</div>
  <div class="expression">${escapeHtml(expression)}</div>
  ${explanation ? `<div class="explanation">${escapeHtml(explanation)}</div>` : ""}
</div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chapter_id, formula_id } = await req.json();
    if (!chapter_id) throw new Error("chapter_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const hctiUserId = Deno.env.get("HCTI_USER_ID");
    const hctiApiKey = Deno.env.get("HCTI_API_KEY");

    if (!hctiUserId || !hctiApiKey) throw new Error("HCTI credentials not configured");

    const sb = createClient(supabaseUrl, serviceKey);

    // Build query for formulas
    let query = sb
      .from("chapter_formulas")
      .select("id, formula_name, formula_expression, formula_explanation, image_url, is_approved")
      .eq("chapter_id", chapter_id)
      .eq("is_approved", true)
      .order("sort_order");

    // If single formula_id provided, only process that one
    if (formula_id) {
      query = query.eq("id", formula_id);
    }

    const { data: formulas, error: fErr } = await query;
    if (fErr) throw new Error(`Failed to fetch formulas: ${fErr.message}`);
    if (!formulas?.length) {
      return new Response(
        JSON.stringify({ error: "No approved formulas found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If single formula regeneration, clear image_url first
    if (formula_id) {
      await sb.from("chapter_formulas").update({ image_url: null }).eq("id", formula_id);
    }

    const toGenerate = formula_id
      ? formulas
      : formulas.filter((f: any) => !f.image_url);
    const skipped = formulas.length - toGenerate.length;

    let generated = 0;
    const errors: string[] = [];
    const basicAuth = btoa(`${hctiUserId}:${hctiApiKey}`);

    for (const formula of toGenerate) {
      try {
        const html = buildFormulaHtml(
          formula.formula_name,
          formula.formula_expression,
          formula.formula_explanation
        );

        const res = await fetch("https://hcti.io/v1/image", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            html,
            viewport_width: 800,
            viewport_height: 400,
            device_pixel_ratio: 2,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          errors.push(`${formula.formula_name}: HCTI ${res.status} - ${errText}`);
          continue;
        }

        const data = await res.json();
        if (!data.url) {
          errors.push(`${formula.formula_name}: No URL in response`);
          continue;
        }

        const { error: updateErr } = await sb
          .from("chapter_formulas")
          .update({ image_url: data.url })
          .eq("id", formula.id);

        if (updateErr) {
          errors.push(`${formula.formula_name}: DB update failed - ${updateErr.message}`);
          continue;
        }

        generated++;

        // Rate limit delay
        if (toGenerate.indexOf(formula) < toGenerate.length - 1) {
          await delay(500);
        }
      } catch (e: any) {
        errors.push(`${formula.formula_name}: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({ generated, skipped, errors, total: formulas.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-formula-images error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
