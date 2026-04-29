// Beta Feedback Inbox – normalized read + status updates across feedback tables.
// Lee-only (admin allowlist).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEE_EMAILS = ["lee@survivestudios.com", "lee@surviveaccounting.com", "admin@surviveaccounting.com"];

type InboxItem = {
  id: string;                  // composite: `${source_table}:${source_id}`
  source_table: string;
  source_id: string;
  created_at: string;
  email: string | null;
  student_name: string | null;
  course_id: string | null;
  course_name: string | null;
  chapter_id: string | null;
  chapter_name: string | null;
  asset_id: string | null;
  asset_code: string | null;
  tool: string | null;
  action: string | null;
  rating: "up" | "down" | "neutral" | null;
  feedback_text: string | null;
  category: string;            // e.g. Helper rating, Response feedback, Suggestion, Issue, Question
  issue_type: string | null;
  status: string;              // new | reviewing | copied_to_lovable | fixed | wont_fix | needs_more_info | archived
  status_meta: {
    copied_at: string | null;
    reviewed_at: string | null;
    fixed_at: string | null;
    archived_at: string | null;
    notes: string | null;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    const email = (user?.email ?? "").toLowerCase();
    if (!LEE_EMAILS.includes(email)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "list";

    // ----- STATUS UPDATE -----
    if (action === "update_status") {
      const { source_table, source_id, status, notes } = body;
      if (!source_table || !source_id || !status) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const now = new Date().toISOString();
      const patch: Record<string, any> = { status, updated_by: user?.id ?? null };
      if (status === "copied_to_lovable") patch.copied_at = now;
      if (status === "reviewing") patch.reviewed_at = now;
      if (status === "fixed") patch.fixed_at = now;
      if (status === "archived") patch.archived_at = now;
      if (notes !== undefined) patch.notes = notes;

      const { data: existing } = await db
        .from("feedback_inbox_status")
        .select("id")
        .eq("source_table", source_table)
        .eq("source_id", source_id)
        .maybeSingle();

      if (existing) {
        await db.from("feedback_inbox_status").update(patch).eq("id", existing.id);
      } else {
        await db.from("feedback_inbox_status").insert({ source_table, source_id, ...patch });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ----- LIST (default) -----
    const startISO: string = body.startDate ?? new Date(Date.now() - 30 * 86400000).toISOString();

    // Pull from each source table in parallel.
    const [
      helperFb, responseFb, ideaFb, chapterQ, explanationFb,
      chapters, courses, assets, statuses,
    ] = await Promise.all([
      db.from("student_helper_feedback")
        .select("id,created_at,email,user_id,course_id,chapter_id,asset_id,tool_type,action_type,rating,comment")
        .gte("created_at", startISO).order("created_at", { ascending: false }).limit(500),
      db.from("study_tool_response_feedback")
        .select("id,created_at,user_id,course_id,chapter_id,asset_id,problem_id,tool_type,action_type,rating,feedback_text")
        .gte("created_at", startISO).order("created_at", { ascending: false }).limit(500),
      db.from("study_tool_idea_feedback")
        .select("id,created_at,user_id,course_id,chapter_id,idea_key,idea_label,vote,suggestion_text")
        .gte("created_at", startISO).order("created_at", { ascending: false }).limit(500),
      db.from("chapter_questions")
        .select("id,created_at,student_email,student_name,chapter_id,asset_name,question,issue_type,status,fixed,responded")
        .gte("created_at", startISO).order("created_at", { ascending: false }).limit(500),
      db.from("explanation_feedback")
        .select("id,created_at,user_email,asset_id,asset_name,helpful,reason,note,section")
        .gte("created_at", startISO).order("created_at", { ascending: false }).limit(500),
      db.from("chapters").select("id,chapter_name,chapter_number,course_id"),
      db.from("courses").select("id,course_name,course_code"),
      db.from("teaching_assets").select("id,asset_code,asset_name"),
      db.from("feedback_inbox_status").select("source_table,source_id,status,copied_at,reviewed_at,fixed_at,archived_at,notes"),
    ]);

    const chapterMap = new Map((chapters.data ?? []).map((c: any) => [c.id, c]));
    const courseMap = new Map((courses.data ?? []).map((c: any) => [c.id, c]));
    const assetMap = new Map((assets.data ?? []).map((a: any) => [a.id, a]));
    const assetByName = new Map((assets.data ?? []).map((a: any) => [a.asset_name, a]));
    const statusMap = new Map(
      (statuses.data ?? []).map((s: any) => [`${s.source_table}:${s.source_id}`, s]),
    );

    const resolveCourse = (courseId: string | null, chapterId: string | null) => {
      if (courseId) return courseMap.get(courseId) ?? null;
      if (chapterId) {
        const ch = chapterMap.get(chapterId);
        if (ch?.course_id) return courseMap.get(ch.course_id) ?? null;
      }
      return null;
    };

    const buildItem = (
      source_table: string, row: any, fields: Partial<InboxItem>,
    ): InboxItem => {
      const key = `${source_table}:${row.id}`;
      const status = statusMap.get(key);
      const ch = row.chapter_id ? chapterMap.get(row.chapter_id) : null;
      const course = resolveCourse(row.course_id ?? null, row.chapter_id ?? null);
      const asset = row.asset_id ? assetMap.get(row.asset_id) : (row.asset_name ? assetByName.get(row.asset_name) : null);
      return {
        id: key,
        source_table,
        source_id: row.id,
        created_at: row.created_at,
        email: null, student_name: null,
        course_id: course?.id ?? null,
        course_name: course?.course_code ?? course?.course_name ?? null,
        chapter_id: row.chapter_id ?? null,
        chapter_name: ch ? `Ch ${ch.chapter_number} – ${ch.chapter_name}` : null,
        asset_id: asset?.id ?? row.asset_id ?? null,
        asset_code: asset?.asset_code ?? row.asset_name ?? null,
        tool: null, action: null, rating: null, feedback_text: null,
        category: "",
        issue_type: null,
        status: status?.status ?? "new",
        status_meta: {
          copied_at: status?.copied_at ?? null,
          reviewed_at: status?.reviewed_at ?? null,
          fixed_at: status?.fixed_at ?? null,
          archived_at: status?.archived_at ?? null,
          notes: status?.notes ?? null,
        },
        ...fields,
      };
    };

    const items: InboxItem[] = [];

    (helperFb.data ?? []).forEach((r: any) => items.push(buildItem("student_helper_feedback", r, {
      email: r.email,
      tool: r.tool_type, action: r.action_type,
      rating: r.rating === 1 ? "up" : r.rating === -1 ? "down" : null,
      feedback_text: r.comment,
      category: "Helper rating",
      issue_type: r.rating === -1 ? "thumbs_down" : "thumbs_up",
    })));

    (responseFb.data ?? []).forEach((r: any) => items.push(buildItem("study_tool_response_feedback", r, {
      tool: r.tool_type, action: r.action_type,
      rating: r.rating, feedback_text: r.feedback_text,
      category: "AI response",
      issue_type: r.rating,
    })));

    (ideaFb.data ?? []).forEach((r: any) => items.push(buildItem("study_tool_idea_feedback", r, {
      tool: r.idea_key, action: "feature_suggestion",
      rating: r.vote === "up" || r.vote === "want" ? "up" : r.vote === "down" || r.vote === "not_for_me" ? "down" : null,
      feedback_text: r.suggestion_text || r.idea_label || null,
      category: "Feature suggestion",
      issue_type: r.vote ?? "suggestion",
    })));

    (chapterQ.data ?? []).forEach((r: any) => items.push(buildItem("chapter_questions", r, {
      email: r.student_email, student_name: r.student_name,
      feedback_text: r.question,
      category: r.issue_type === "issue" ? "Issue report"
              : r.issue_type === "feedback" ? "General feedback"
              : r.issue_type === "quiz_feedback" ? "Quiz feedback"
              : "Question",
      issue_type: r.issue_type,
    })));

    (explanationFb.data ?? []).forEach((r: any) => items.push(buildItem("explanation_feedback", r, {
      email: r.user_email,
      tool: "explanation", action: r.section ?? "explanation",
      rating: r.helpful ? "up" : "down",
      feedback_text: r.note || (Array.isArray(r.reason) ? r.reason.join(", ") : null),
      category: "Explanation feedback",
      issue_type: r.helpful ? "helpful" : "not_helpful",
    })));

    items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return new Response(JSON.stringify({ items, count: items.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
