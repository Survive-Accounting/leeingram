import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { problemImageUrls, solutionImageUrls, problemId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const allProblemUrls: string[] = problemImageUrls || [];
    const allSolutionUrls: string[] = solutionImageUrls || [];

    if (allProblemUrls.length === 0 && allSolutionUrls.length === 0) {
      // No images — mark as not applicable
      if (problemId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase.from("chapter_problems").update({ ocr_status: "no_images" }).eq("id", problemId);
      }
      return new Response(JSON.stringify({ success: true, ocr: null, status: "no_images" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as running
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    if (problemId) {
      await supabase.from("chapter_problems").update({ ocr_status: "running" }).eq("id", problemId);
    }

    // Build content array with images for Gemini vision
    const content: any[] = [];

    content.push({
      type: "text",
      text: `You are an expert OCR system for university accounting textbook screenshots.

Extract ALL text from the provided images with high fidelity. The images are from accounting textbooks.

EXTRACTION RULES:
- Preserve all numbers, account names, dates, and formatting exactly
- For journal entries, preserve the grid structure (Account | Debit | Credit)
- Identify and extract: problem label (e.g. "E13-3", "P14-2"), Learning Objective numbers (e.g. "LO 3"), title, and problem type (Exercise/Problem)
- Separate problem text from solution text based on the image categories provided
- Rate your confidence: "high" if text is clearly readable, "medium" if some parts are unclear, "low" if significant portions are illegible

Return results using the provided tool.`,
    });

    for (let i = 0; i < allProblemUrls.length; i++) {
      content.push({ type: "text", text: `--- PROBLEM IMAGE ${i + 1} of ${allProblemUrls.length} ---` });
      content.push({ type: "image_url", image_url: { url: allProblemUrls[i] } });
    }

    for (let i = 0; i < allSolutionUrls.length; i++) {
      content.push({ type: "text", text: `--- SOLUTION IMAGE ${i + 1} of ${allSolutionUrls.length} ---` });
      content.push({ type: "image_url", image_url: { url: allSolutionUrls[i] } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
        tools: [
          {
            type: "function",
            function: {
              name: "return_ocr_results",
              description: "Return structured OCR extraction results from accounting textbook screenshots",
              parameters: {
                type: "object",
                properties: {
                  detected_label: { type: "string", description: "Problem label e.g. 'E13-3'. Empty if not found." },
                  detected_lo: { type: "string", description: "Learning Objective numbers. Empty if not found." },
                  detected_title: { type: "string", description: "Problem title. Empty if not found." },
                  detected_type: { type: "string", description: "Exercise, Problem, or Custom. Empty if not found." },
                  extracted_problem_text: { type: "string", description: "Full extracted text from problem screenshots." },
                  extracted_solution_text: { type: "string", description: "Full extracted text from solution screenshots." },
                  confidence: { type: "string", enum: ["high", "medium", "low"], description: "Overall OCR confidence" },
                  confidence_notes: { type: "string", description: "Brief explanation of confidence issues." },
                },
                required: ["detected_label", "detected_lo", "detected_title", "detected_type", "extracted_problem_text", "extracted_solution_text", "confidence", "confidence_notes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_ocr_results" } },
      }),
    });

    if (!response.ok) {
      if (problemId) {
        await supabase.from("chapter_problems").update({ ocr_status: "failed" }).eq("id", problemId);
      }
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI OCR error:", response.status, t);
      throw new Error(`AI OCR failed: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      if (problemId) {
        await supabase.from("chapter_problems").update({ ocr_status: "failed" }).eq("id", problemId);
      }
      throw new Error("AI did not return structured OCR output");
    }

    const ocrResult = JSON.parse(toolCall.function.arguments);

    // Persist OCR results to DB
    if (problemId) {
      const updateData: any = {
        ocr_extracted_problem_text: ocrResult.extracted_problem_text || "",
        ocr_extracted_solution_text: ocrResult.extracted_solution_text || "",
        ocr_detected_label: ocrResult.detected_label || "",
        ocr_detected_lo: ocrResult.detected_lo || "",
        ocr_detected_title: ocrResult.detected_title || "",
        ocr_detected_type: ocrResult.detected_type || "",
        ocr_confidence: ocrResult.confidence || "",
        ocr_confidence_notes: ocrResult.confidence_notes || "",
        ocr_status: "success",
      };
      // Auto-fill empty fields from OCR detection
      const { data: existing } = await supabase.from("chapter_problems").select("source_label, title, problem_type, status").eq("id", problemId).single();
      if (existing) {
        if (!existing.source_label && ocrResult.detected_label) updateData.source_label = ocrResult.detected_label;
        if (!existing.title && ocrResult.detected_title) updateData.title = ocrResult.detected_title;
        if (existing.status === "raw") updateData.status = "tagged";
      }
      await supabase.from("chapter_problems").update(updateData).eq("id", problemId);
    }

    return new Response(JSON.stringify({ success: true, ocr: ocrResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-ocr error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
