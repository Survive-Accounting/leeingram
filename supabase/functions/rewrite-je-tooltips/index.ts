import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_ENRICH = `You are an accounting tutor. For each journal entry row below, provide two fields:
1. debit_credit_reason: 1-2 sentences explaining why this account is debited or credited in this context. Written for an accounting student. Use "you're" to address the student directly.
2. amount_source: 1-2 sentences explaining where the dollar amount comes from, referencing the problem when possible. Do NOT include specific dollar figures — explain HOW to find the amount.

Return JSON: { "rows": [ { "debit_credit_reason": "...", "amount_source": "..." } ] }
Rules: Return rows in SAME ORDER as provided. Be concise but specific. Return ONLY valid JSON.`;

const SYSTEM_REWRITE_REASONS = `You are rewriting accounting journal entry tooltip text for undergraduate students. Rewrite the debit_credit_reason for each row using this exact format:

'[Debit/Credit] [Account] because you're [action] and need to [increase/decrease] it — [account type]s [increase/decrease] with a [debit/credit].'

Keep it to one sentence. Use 'you're' to address the student. End with the account type rule.

Return ONLY valid JSON matching the input structure with updated debit_credit_reason fields.
Return JSON: { "rows": [ { "debit_credit_reason": "..." } ] }
Rules: Return rows in SAME ORDER as provided. Return ONLY valid JSON.`;

const SYSTEM_REWRITE_AMOUNTS = `You are rewriting accounting tooltip text that explains where journal entry amounts come from. Rewrite each amount_source to be a plain English explanation of HOW to find or calculate the amount — without mentioning any specific dollar figures, percentages, or numbers. Focus on the method, not the result. Keep it to 1-2 sentences.

Return ONLY valid JSON matching the input structure with updated amount_source fields.
Return JSON: { "rows": [ { "amount_source": "..." } ] }
Rules: Return rows in SAME ORDER as provided. Return ONLY valid JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { teaching_asset_id, mode } = await req.json();
    if (!teaching_asset_id) throw new Error("Missing teaching_asset_id");
    if (!["enrich", "rewrite_reasons", "rewrite_amounts"].includes(mode)) {
      throw new Error("Invalid mode. Must be 'enrich', 'rewrite_reasons', or 'rewrite_amounts'");
    }

    const { data: asset, error: aErr } = await sb
      .from("teaching_assets")
      .select("id, asset_name, journal_entry_completed_json, supplementary_je_json, problem_context, survive_problem_text, survive_solution_text")
      .eq("id", teaching_asset_id)
      .single();
    if (aErr || !asset) throw new Error("Asset not found: " + (aErr?.message ?? ""));

    let totalUpdated = 0;

    for (const jsonField of ["journal_entry_completed_json", "supplementary_je_json"] as const) {
      const jeJson = (asset as any)[jsonField];
      if (!jeJson?.scenario_sections && !jeJson?.entries) continue;

      // Build row summaries for AI
      const rowSummaries: string[] = [];
      const isSupplementary = jsonField === "supplementary_je_json";

      if (isSupplementary && jeJson.entries) {
        for (const entry of jeJson.entries) {
          for (const row of entry.rows || []) {
            const side = row.side || "debit";
            rowSummaries.push(`Account: ${row.account_name}, Side: ${side}, Section: ${entry.label || "N/A"}`);
          }
        }
      } else if (jeJson.scenario_sections) {
        for (const section of jeJson.scenario_sections) {
          for (const entry of section.entries_by_date || []) {
            for (const row of entry.rows || []) {
              const side = row.credit != null && row.credit !== 0 ? "Credit" : "Debit";
              const amount = row.credit != null && row.credit !== 0 ? row.credit : row.debit;
              rowSummaries.push(`Account: ${row.account_name}, ${side}: $${amount}, Date: ${entry.entry_date || entry.date || "N/A"}, Section: ${section.label}`);
            }
          }
        }
      }

      if (rowSummaries.length === 0) continue;

      // For enrich mode, check if any rows actually need it
      if (mode === "enrich") {
        let hasMissing = false;
        if (isSupplementary && jeJson.entries) {
          for (const entry of jeJson.entries) {
            for (const row of entry.rows || []) {
              if (!row.debit_credit_reason || !row.amount_source) { hasMissing = true; break; }
            }
            if (hasMissing) break;
          }
        } else if (jeJson.scenario_sections) {
          for (const section of jeJson.scenario_sections) {
            for (const entry of section.entries_by_date || []) {
              for (const row of entry.rows || []) {
                if (!row.debit_credit_reason || !row.amount_source) { hasMissing = true; break; }
              }
              if (hasMissing) break;
            }
            if (hasMissing) break;
          }
        }
        if (!hasMissing) continue;
      }

      const systemPrompt = mode === "enrich" ? SYSTEM_ENRICH
        : mode === "rewrite_reasons" ? SYSTEM_REWRITE_REASONS
        : SYSTEM_REWRITE_AMOUNTS;

      const userPrompt = `Problem:\n${asset.problem_context || asset.survive_problem_text || "N/A"}\n\nSolution:\n${asset.survive_solution_text || "N/A"}\n\nJE rows (${rowSummaries.length}):\n${rowSummaries.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}`;

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AI error: ${res.status} ${errText}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let parsed: any;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse AI response:", cleaned.slice(0, 200));
        continue;
      }

      if (!parsed?.rows || !Array.isArray(parsed.rows)) continue;

      // Apply updates
      const enriched = JSON.parse(JSON.stringify(jeJson));
      let rowIdx = 0;

      if (isSupplementary && enriched.entries) {
        for (const entry of enriched.entries) {
          for (const row of entry.rows || []) {
            if (rowIdx < parsed.rows.length) {
              if (mode === "enrich") {
                if (!row.debit_credit_reason && parsed.rows[rowIdx].debit_credit_reason) {
                  row.debit_credit_reason = parsed.rows[rowIdx].debit_credit_reason;
                }
                if (!row.amount_source && parsed.rows[rowIdx].amount_source) {
                  row.amount_source = parsed.rows[rowIdx].amount_source;
                }
              } else if (mode === "rewrite_reasons" && parsed.rows[rowIdx].debit_credit_reason) {
                row.debit_credit_reason = parsed.rows[rowIdx].debit_credit_reason;
              } else if (mode === "rewrite_amounts" && parsed.rows[rowIdx].amount_source) {
                row.amount_source = parsed.rows[rowIdx].amount_source;
              }
            }
            rowIdx++;
          }
        }
      } else if (enriched.scenario_sections) {
        for (const section of enriched.scenario_sections) {
          for (const entry of section.entries_by_date || []) {
            for (const row of entry.rows || []) {
              if (rowIdx < parsed.rows.length) {
                if (mode === "enrich") {
                  if (!row.debit_credit_reason && parsed.rows[rowIdx].debit_credit_reason) {
                    row.debit_credit_reason = parsed.rows[rowIdx].debit_credit_reason;
                  }
                  if (!row.amount_source && parsed.rows[rowIdx].amount_source) {
                    row.amount_source = parsed.rows[rowIdx].amount_source;
                  }
                } else if (mode === "rewrite_reasons" && parsed.rows[rowIdx].debit_credit_reason) {
                  row.debit_credit_reason = parsed.rows[rowIdx].debit_credit_reason;
                } else if (mode === "rewrite_amounts" && parsed.rows[rowIdx].amount_source) {
                  row.amount_source = parsed.rows[rowIdx].amount_source;
                }
              }
              rowIdx++;
            }
          }
        }
      }

      // Save back
      const { error: updateErr } = await sb
        .from("teaching_assets")
        .update({ [jsonField]: enriched })
        .eq("id", teaching_asset_id);
      if (updateErr) throw new Error("Failed to save: " + updateErr.message);

      totalUpdated += rowIdx;
    }

    return new Response(
      JSON.stringify({ success: true, rows_processed: totalUpdated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("rewrite-je-tooltips error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
