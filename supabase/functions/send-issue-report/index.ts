import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { student_email, message, issue_type_label, asset_name, source_ref, problem_title, course_name, chapter_number, chapter_name } = await req.json();

    if (!student_email || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = `Issue report: ${source_ref || asset_name || "Unknown"} from ${student_email}`;
    const body = [
      `PROBLEM: ${source_ref || "N/A"}`,
      problem_title ? problem_title : "",
      `COURSE: ${course_name || "Unknown"}`,
      `CHAPTER: Ch ${chapter_number || "?"} — ${chapter_name || "Unknown"}`,
      `ASSET: ${asset_name || "N/A"}`,
      "",
      `ISSUE TYPE:`,
      issue_type_label || "Not specified",
      "",
      "MESSAGE:",
      message,
      "",
      "---",
      `Reply directly to this email to respond to ${student_email}.`,
      "Their reply-to is set.",
    ].filter(l => l !== undefined).join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "lee@mail.surviveaccounting.com",
        to: "lee@surviveaccounting.com",
        reply_to: student_email,
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-issue-report error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
