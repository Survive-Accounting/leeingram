// Beta feedback AI summarization. Lee-only.
// Uses direct Anthropic API per project rule for admin/content generators.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEE_EMAILS = ["lee@survivestudios.com", "lee@surviveaccounting.com", "admin@surviveaccounting.com"];
const ANTHROPIC_MODEL = "claude-3-5-sonnet-20240620";

const CATEGORIES = [
  "Confusing explanation", "Incorrect answer", "Too wordy", "Too short",
  "UI confusion", "Slow loading", "Login/access issue", "Missing tool",
  "Missing chapter/problem", "Feature request", "Positive feedback", "Other",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    const email = (user?.email ?? "").toLowerCase();
    if (!LEE_EMAILS.includes(email)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "summarize";

    // ----- LIST PAST SUMMARIES -----
    if (action === "list_past") {
      const { data } = await db
        .from("beta_feedback_summaries")
        .select("id,created_at,date_range_start,date_range_end,feedback_count,model_used,filters")
        .order("created_at", { ascending: false }).limit(20);
      return new Response(JSON.stringify({ summaries: data ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_summary") {
      const { data } = await db
        .from("beta_feedback_summaries").select("*").eq("id", body.id).maybeSingle();
      return new Response(JSON.stringify({ summary: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- SUMMARIZE -----
    const range: "24h" | "7d" | "selected" | "custom" = body.range ?? "7d";
    const now = new Date();
    let startISO: string;
    let endISO: string = now.toISOString();
    let selectedIds: Array<{ source_table: string; source_id: string }> = body.selected ?? [];

    if (range === "24h") {
      startISO = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
    } else if (range === "7d") {
      startISO = new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
    } else if (range === "selected") {
      startISO = new Date(now.getTime() - 90 * 86400 * 1000).toISOString();
    } else {
      startISO = body.startDate ?? new Date(now.getTime() - 7 * 86400 * 1000).toISOString();
      endISO = body.endDate ?? endISO;
    }

    const [helperFb, responseFb, ideaFb, chapterQ, explanationFb, chapters, courses] = await Promise.all([
      db.from("student_helper_feedback")
        .select("id,created_at,email,course_id,chapter_id,asset_id,tool_type,action_type,rating,comment")
        .gte("created_at", startISO).lte("created_at", endISO).order("created_at", { ascending: false }).limit(400),
      db.from("study_tool_response_feedback")
        .select("id,created_at,course_id,chapter_id,asset_id,tool_type,action_type,rating,feedback_text")
        .gte("created_at", startISO).lte("created_at", endISO).order("created_at", { ascending: false }).limit(400),
      db.from("study_tool_idea_feedback")
        .select("id,created_at,course_id,chapter_id,idea_key,idea_label,vote,suggestion_text")
        .gte("created_at", startISO).lte("created_at", endISO).order("created_at", { ascending: false }).limit(400),
      db.from("chapter_questions")
        .select("id,created_at,student_email,chapter_id,asset_name,question,issue_type")
        .gte("created_at", startISO).lte("created_at", endISO).order("created_at", { ascending: false }).limit(400),
      db.from("explanation_feedback")
        .select("id,created_at,user_email,asset_id,asset_name,helpful,reason,note,section")
        .gte("created_at", startISO).lte("created_at", endISO).order("created_at", { ascending: false }).limit(400),
      db.from("chapters").select("id,chapter_name,chapter_number,course_id"),
      db.from("courses").select("id,course_name,course_code"),
    ]);

    const chapterMap = new Map((chapters.data ?? []).map((c: any) => [c.id, c]));
    const courseMap = new Map((courses.data ?? []).map((c: any) => [c.id, c]));
    const courseLabel = (courseId: string | null, chapterId: string | null) => {
      const ch = chapterId ? chapterMap.get(chapterId) : null;
      const cId = courseId ?? ch?.course_id ?? null;
      const c = cId ? courseMap.get(cId) : null;
      return c?.course_code ?? c?.course_name ?? null;
    };
    const chapterLabel = (chapterId: string | null) => {
      const ch = chapterId ? chapterMap.get(chapterId) : null;
      return ch ? `Ch ${ch.chapter_number} ${ch.chapter_name}` : null;
    };

    type Fb = {
      source: string; id: string; created_at: string; course: string | null;
      chapter: string | null; asset: string | null; tool: string | null;
      action: string | null; rating: string | null; text: string;
    };

    const all: Fb[] = [];
    (helperFb.data ?? []).forEach((r: any) => all.push({
      source: "student_helper_feedback", id: r.id, created_at: r.created_at,
      course: courseLabel(r.course_id, r.chapter_id), chapter: chapterLabel(r.chapter_id),
      asset: r.asset_id, tool: r.tool_type, action: r.action_type,
      rating: r.rating === 1 ? "up" : r.rating === -1 ? "down" : null,
      text: r.comment ?? "",
    }));
    (responseFb.data ?? []).forEach((r: any) => all.push({
      source: "study_tool_response_feedback", id: r.id, created_at: r.created_at,
      course: courseLabel(r.course_id, r.chapter_id), chapter: chapterLabel(r.chapter_id),
      asset: r.asset_id, tool: r.tool_type, action: r.action_type, rating: r.rating,
      text: r.feedback_text ?? "",
    }));
    (ideaFb.data ?? []).forEach((r: any) => all.push({
      source: "study_tool_idea_feedback", id: r.id, created_at: r.created_at,
      course: courseLabel(r.course_id, r.chapter_id), chapter: chapterLabel(r.chapter_id),
      asset: null, tool: r.idea_key, action: "feature_suggestion", rating: r.vote,
      text: r.suggestion_text ?? r.idea_label ?? "",
    }));
    (chapterQ.data ?? []).forEach((r: any) => all.push({
      source: "chapter_questions", id: r.id, created_at: r.created_at,
      course: courseLabel(null, r.chapter_id), chapter: chapterLabel(r.chapter_id),
      asset: r.asset_name, tool: null, action: r.issue_type, rating: null,
      text: r.question ?? "",
    }));
    (explanationFb.data ?? []).forEach((r: any) => all.push({
      source: "explanation_feedback", id: r.id, created_at: r.created_at,
      course: null, chapter: null, asset: r.asset_name ?? r.asset_id,
      tool: "explanation", action: r.section, rating: r.helpful ? "up" : "down",
      text: r.note ?? (Array.isArray(r.reason) ? r.reason.join(", ") : ""),
    }));

    let feedback = all;
    if (range === "selected" && selectedIds.length) {
      const set = new Set(selectedIds.map(s => `${s.source_table}:${s.source_id}`));
      feedback = all.filter(f => set.has(`${f.source}:${f.id}`));
    }

    const meaningful = feedback.filter(f => f.text && f.text.trim().length > 0);

    if (meaningful.length === 0) {
      return new Response(JSON.stringify({
        error: "No feedback with text in the selected range",
        feedback_count: feedback.length,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lines = meaningful.slice(0, 250).map((f, i) =>
      `${i + 1}. [${f.course ?? "?"} | ${f.chapter ?? "?"} | ${f.asset ?? "?"} | tool=${f.tool ?? "?"} | rating=${f.rating ?? "—"}] ${f.text.replace(/\s+/g, " ").slice(0, 400)}`
    ).join("\n");

    const systemPrompt = `You are an analyst helping Lee (founder of Survive Accounting) triage student beta feedback.
Be concise, specific, and actionable. Reference real chapters/assets/tools when possible.
Output strictly valid JSON matching the schema. No prose outside JSON.`;

    const userPrompt = `Analyze the following ${meaningful.length} pieces of student beta feedback.

Categorize each piece into ONE of these categories:
${CATEGORIES.map(c => `- ${c}`).join("\n")}

Then produce:
- top_issues: top 5 recurring issues (each: title, count_estimate, example_quote, affected_area)
- top_features: top 5 most requested features (each: title, count_estimate, example_quote)
- top_chapters: top confusing chapters/problems (each: label, why_confusing, example_quote)
- quick_wins: 3-6 fixes Lee should ship next, ordered by impact ÷ effort (each: title, why, effort: "small"|"medium"|"large")
- suggested_prompts: 3-6 ready-to-paste Lovable improvement prompts (each: title, target_area, prompt)
- categories: { "<category name>": <count> } for ALL 12 categories (zeros allowed)
- summary_text: 4-8 sentence executive summary

Lovable prompt style:
- Lead with the student problem and where it shows up.
- Reference the course/chapter/tool/asset when known.
- End with concrete acceptance criteria.
- Tone: terse, founder-to-coding-agent.

FEEDBACK:
${lines}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        tools: [{
          name: "emit_summary",
          description: "Emit the structured beta feedback summary.",
          input_schema: {
            type: "object",
            properties: {
              summary_text: { type: "string" },
              categories: { type: "object", additionalProperties: { type: "number" } },
              top_issues: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    count_estimate: { type: "number" },
                    example_quote: { type: "string" },
                    affected_area: { type: "string" },
                  },
                  required: ["title", "count_estimate", "example_quote", "affected_area"],
                },
              },
              top_features: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    count_estimate: { type: "number" },
                    example_quote: { type: "string" },
                  },
                  required: ["title", "count_estimate", "example_quote"],
                },
              },
              top_chapters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    why_confusing: { type: "string" },
                    example_quote: { type: "string" },
                  },
                  required: ["label", "why_confusing"],
                },
              },
              quick_wins: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    why: { type: "string" },
                    effort: { type: "string", enum: ["small", "medium", "large"] },
                  },
                  required: ["title", "why", "effort"],
                },
              },
              suggested_prompts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    target_area: { type: "string" },
                    prompt: { type: "string" },
                  },
                  required: ["title", "target_area", "prompt"],
                },
              },
            },
            required: ["summary_text", "categories", "top_issues", "top_features", "top_chapters", "quick_wins", "suggested_prompts"],
          },
        }],
        tool_choice: { type: "tool", name: "emit_summary" },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("Anthropic error", aiResp.status, t);
      return new Response(JSON.stringify({ error: `Anthropic error ${aiResp.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolUse = (aiData.content ?? []).find((b: any) => b.type === "tool_use");
    if (!toolUse) {
      return new Response(JSON.stringify({ error: "No structured output returned" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = toolUse.input;

    const { data: saved, error: saveErr } = await db.from("beta_feedback_summaries").insert({
      date_range_start: startISO,
      date_range_end: endISO,
      filters: { range, selected_count: selectedIds.length },
      summary_text: result.summary_text,
      categories: result.categories,
      suggested_prompts: result.suggested_prompts,
      top_issues: result.top_issues,
      top_features: result.top_features,
      top_chapters: result.top_chapters,
      quick_wins: result.quick_wins,
      feedback_count: meaningful.length,
      model_used: ANTHROPIC_MODEL,
      generated_by_user_id: user?.id ?? null,
    }).select("*").single();

    if (saveErr) console.error("save error", saveErr);

    return new Response(JSON.stringify({
      summary: saved ?? { ...result, model_used: ANTHROPIC_MODEL, feedback_count: meaningful.length },
      feedback_count: meaningful.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("summarize error", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
