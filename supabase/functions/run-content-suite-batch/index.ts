/**
 * run-content-suite-batch — Processes all 6 content types for a SINGLE chapter.
 * Designed to be called in a client-side polling loop, one chapter at a time.
 * 
 * Input: { chapterId: string }
 * Output: { success: boolean, chapterId: string, chapterName: string, completedTypes: string[], failedTypes: { type: string, error: string }[] }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INTER_CALL_DELAY_MS = 1500;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CONTENT_TYPES = ["purpose", "key_terms", "exam_mistakes", "accounts", "formulas", "journal_entries"] as const;
type ContentType = typeof CONTENT_TYPES[number];

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  purpose: "Purpose",
  key_terms: "Key Terms",
  exam_mistakes: "Exam Mistakes",
  accounts: "Accounts",
  formulas: "Formulas",
  journal_entries: "Journal Entries",
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chapterId } = await req.json();
    if (!chapterId) {
      return new Response(JSON.stringify({ error: "chapterId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up chapter info
    const { data: chapterData, error: chErr } = await sb
      .from("chapters")
      .select("chapter_name, course_id, courses!chapters_course_id_fkey(code)")
      .eq("id", chapterId)
      .single();

    if (chErr || !chapterData) {
      return new Response(JSON.stringify({ error: `Chapter not found: ${chapterId}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chapterName = chapterData.chapter_name;
    const courseCode = (chapterData as any).courses?.code || "UNK";

    const completedTypes: string[] = [];
    const failedTypes: { type: string; error: string }[] = [];

    for (let i = 0; i < CONTENT_TYPES.length; i++) {
      const contentType = CONTENT_TYPES[i];

      // Add delay between API calls (not before the first one)
      if (i > 0) {
        await delay(INTER_CALL_DELAY_MS);
      }

      try {
        console.log(`[${chapterName}] Generating ${CONTENT_TYPE_LABELS[contentType]}...`);

        // Delegate to the existing generate-chapter-content-suite function with `only` param
        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-chapter-content-suite`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chapterId,
            chapterName,
            courseCode,
            only: contentType,
          }),
        });

        const body = await response.text();
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${body.substring(0, 300)}`);
        }

        let parsed: any;
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = { raw: body.substring(0, 200) };
        }

        if (parsed.errors?.length) {
          throw new Error(parsed.errors.join("; "));
        }

        completedTypes.push(contentType);
        console.log(`[${chapterName}] ✓ ${CONTENT_TYPE_LABELS[contentType]}`);
      } catch (err: any) {
        const errMsg = err?.message || "Unknown error";
        console.error(`[${chapterName}] ✗ ${CONTENT_TYPE_LABELS[contentType]}: ${errMsg}`);
        failedTypes.push({ type: contentType, error: errMsg });
        // Continue to next content type — never abort
      }
    }

    const success = failedTypes.length === 0;

    return new Response(JSON.stringify({
      success,
      chapterId,
      chapterName,
      completedTypes,
      failedTypes,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("run-content-suite-batch error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
