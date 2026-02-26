import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { problemImageUrls, solutionImageUrls } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const allProblemUrls: string[] = problemImageUrls || [];
    const allSolutionUrls: string[] = solutionImageUrls || [];

    if (allProblemUrls.length === 0 && allSolutionUrls.length === 0) {
      return new Response(JSON.stringify({
        error: "No image URLs provided for OCR extraction.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Add problem images
    for (let i = 0; i < allProblemUrls.length; i++) {
      content.push({
        type: "text",
        text: `--- PROBLEM IMAGE ${i + 1} of ${allProblemUrls.length} ---`,
      });
      content.push({
        type: "image_url",
        image_url: { url: allProblemUrls[i] },
      });
    }

    // Add solution images
    for (let i = 0; i < allSolutionUrls.length; i++) {
      content.push({
        type: "text",
        text: `--- SOLUTION IMAGE ${i + 1} of ${allSolutionUrls.length} ---`,
      });
      content.push({
        type: "image_url",
        image_url: { url: allSolutionUrls[i] },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_ocr_results",
              description: "Return structured OCR extraction results from accounting textbook screenshots",
              parameters: {
                type: "object",
                properties: {
                  detected_label: {
                    type: "string",
                    description: "The problem label/number detected, e.g. 'E13-3' or 'P14-2'. Empty string if not found.",
                  },
                  detected_lo: {
                    type: "string",
                    description: "Learning Objective number(s), e.g. 'LO 3' or 'LO 2, 3'. Empty string if not found.",
                  },
                  detected_title: {
                    type: "string",
                    description: "The problem title, e.g. 'Bond Amortization'. Empty string if not found.",
                  },
                  detected_type: {
                    type: "string",
                    description: "Problem type: 'Exercise', 'Problem', or 'Custom'. Empty string if not found.",
                  },
                  extracted_problem_text: {
                    type: "string",
                    description: "Full extracted text from problem screenshot(s). Include all details exactly as shown.",
                  },
                  extracted_solution_text: {
                    type: "string",
                    description: "Full extracted text from solution screenshot(s). Include all numbers, journal entries, and working. Empty string if no solution images.",
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Overall OCR confidence level",
                  },
                  confidence_notes: {
                    type: "string",
                    description: "Brief explanation of any issues affecting confidence (blurry text, cut off content, etc.)",
                  },
                },
                required: [
                  "detected_label",
                  "detected_lo",
                  "detected_title",
                  "detected_type",
                  "extracted_problem_text",
                  "extracted_solution_text",
                  "confidence",
                  "confidence_notes",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_ocr_results" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI OCR error:", response.status, t);
      throw new Error(`AI OCR failed: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured OCR output");
    }

    const ocrResult = JSON.parse(toolCall.function.arguments);

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
