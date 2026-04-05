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
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600&display=swap');
body { margin:0; padding:0; background:#14213D; }
.card {
  width:800px; height:400px; background:#14213D;
  display:flex; flex-direction:column;
  justify-content:center; align-items:center;
  padding:48px; box-sizing:border-box; position:relative;
}
.name {
  font-family:'DM Serif Display',serif;
  font-size:28px; color:#ffffff;
  text-align:center; margin-bottom:20px;
}
.expression {
  font-family:'Inter',monospace; font-weight:600;
  font-size:22px; color:#CE1126;
  text-align:center; margin-bottom:16px;
  letter-spacing:0.02em;
}
.explanation {
  font-family:'Inter',sans-serif; font-size:14px;
  color:rgba(255,255,255,0.65);
  text-align:center; max-width:620px; line-height:1.6;
}
.footer {
  position:absolute; bottom:24px; right:32px;
}
.logo { height:28px; opacity:0.7; }
</style>
</head>
<body>
<div class="card">
  <div class="name">${escapeHtml(name)}</div>
  <div class="expression">${escapeHtml(expression)}</div>
  ${explanation ? `<div class="explanation">${escapeHtml(explanation)}</div>` : ""}
  <div class="footer">
    <img class="logo" src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/ab9844f22ec569cdc37f3bf9da363c50.jpg" alt="SA" />
  </div>
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
    const body = await req.json();
    // Support both camelCase and snake_case
    const chapterId = body.chapterId || body.chapter_id;
    const formulaId = body.formulaId || body.formula_id;

    if (!chapterId && !formulaId) throw new Error("Provide chapterId or formulaId");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const hctiUserId = Deno.env.get("HCTI_USER_ID");
    const hctiApiKey = Deno.env.get("HCTI_API_KEY");

    if (!hctiUserId || !hctiApiKey) throw new Error("HCTI credentials not configured");

    const sb = createClient(supabaseUrl, serviceKey);

    let formulas: any[] = [];

    if (formulaId) {
      // Single formula regen — fetch just that one
      const { data, error } = await sb
        .from("chapter_formulas")
        .select("id, chapter_id, formula_name, formula_expression, formula_explanation, image_url, is_approved")
        .eq("id", formulaId)
        .single();
      if (error || !data) throw new Error(`Formula not found: ${error?.message}`);
      // Clear image_url for regen
      await sb.from("chapter_formulas").update({ image_url: null }).eq("id", formulaId);
      formulas = [data];
    } else {
      // All approved formulas in chapter missing image_url
      const { data, error } = await sb
        .from("chapter_formulas")
        .select("id, chapter_id, formula_name, formula_expression, formula_explanation, image_url, is_approved")
        .eq("chapter_id", chapterId)
        .eq("is_approved", true)
        .order("sort_order");
      if (error) throw new Error(`Failed to fetch formulas: ${error.message}`);
      formulas = data || [];
    }

    if (!formulas.length) {
      return new Response(
        JSON.stringify({ generated: 0, skipped: 0, errors: [], total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const toGenerate = formulaId ? formulas : formulas.filter((f: any) => !f.image_url);
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

    // Log HCTI cost
    const effectiveChapterId = chapterId || formulas[0]?.chapter_id;
    if (generated > 0 && effectiveChapterId) {
      logCost(sb, {
        operation_type: "image_generation",
        chapter_id: effectiveChapterId,
        image_count: generated,
        metadata: { total_formulas: formulas.length, skipped, errors: errors.length },
      });
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
