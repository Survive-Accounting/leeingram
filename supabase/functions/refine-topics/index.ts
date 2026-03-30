import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { chapterId, chapterNumber, courseCode } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

    const sb = createClient(supabaseUrl, serviceKey);

    // Fetch current topics
    const { data: topics } = await sb
      .from("chapter_topics")
      .select("*")
      .eq("chapter_id", chapterId)
      .eq("is_active", true)
      .order("display_order");

    // Fetch lw_items grouped by topic
    const { data: lwItems } = await sb
      .from("lw_items")
      .select("id, item_key, item_label, question_text, topic_id, status")
      .eq("chapter_id", chapterId)
      .limit(200);

    // Fetch existing topic_rules for context
    const { data: existingRules } = await sb
      .from("topic_rules")
      .select("topic_name, pattern, priority")
      .eq("course_short", courseCode)
      .eq("chapter_number", chapterNumber);

    // Build summary for AI
    const topicSummary = (topics ?? []).map((t: any) => {
      const items = (lwItems ?? []).filter((i: any) => i.topic_id === t.id);
      const sampleQuestions = items
        .slice(0, 5)
        .map((i: any) => i.question_text?.substring(0, 120) || i.item_key)
        .join("\n  - ");
      return `Topic: "${t.topic_name}" (${items.length} items)\n  Sample items:\n  - ${sampleQuestions || "(none)"}`;
    });

    const unassigned = (lwItems ?? []).filter(
      (i: any) => !i.topic_id
    );
    const unassignedSummary = unassigned
      .slice(0, 10)
      .map((i: any) => `${i.item_key}: ${i.question_text?.substring(0, 80) || "(empty)"}`)
      .join("\n  - ");

    const systemPrompt = `You are an expert in accounting exam prep content organization. You analyze chapter topics and their assigned practice items to suggest improvements.

You must return ONLY a JSON array of suggestion objects. Each suggestion has:
- type: "rename" | "merge" | "split" | "create" | "rule_add"
- description: human-readable explanation
- details: object with type-specific fields:
  For "rename": { topicId, oldName, newName }
  For "merge": { sourceTopicId, sourceName, targetTopicId, targetName, itemCount }
  For "split": { sourceTopicId, sourceName, newTopicName, itemKeysToMove: string[] }
  For "create": { newTopicName, itemKeysToMove: string[] }
  For "rule_add": { topicName, pattern, matchField, reason }

Be specific and actionable. Limit to 3-6 suggestions. Return [] if topics are well-organized.`;

    const userPrompt = `Course: ${courseCode} Chapter ${chapterNumber}

Current topics and their items:
${topicSummary.join("\n\n")}

Unassigned items (${unassigned.length} total):
  - ${unassignedSummary || "(none)"}

Existing matching rules: ${JSON.stringify(existingRules ?? [])}

Analyze the topic organization and suggest improvements. Consider:
1. Are any topics too broad or too narrow?
2. Are items assigned to the wrong topic?
3. Should any topics be merged or split?
4. Are there recurring keywords that could become topic_rules patterns?
5. Would renaming any topic improve clarity?`;

    const aiResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt },
          ],
          max_tokens: 4096,
          tools: [
            {
              name: "return_suggestions",
              description: "Return topic refinement suggestions",
              input_schema: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: [
                            "rename",
                            "merge",
                            "split",
                            "create",
                            "rule_add",
                          ],
                        },
                        description: { type: "string" },
                        details: { type: "object" },
                      },
                      required: ["type", "description", "details"],
                    },
                  },
                },
                required: ["suggestions"],
              },
            },
          ],
          tool_choice: {
            type: "tool",
            name: "return_suggestions",
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("Anthropic API error:", aiResponse.status, errText);
      throw new Error(`Anthropic API error ${aiResponse.status}: ${errText}`);
    }

    const aiData = await aiResponse.json();
    let suggestions = [];

    // Extract from Anthropic tool use response
    const toolBlock = aiData.content?.find((b: any) => b.type === "tool_use");
    if (toolBlock?.input) {
      suggestions = toolBlock.input.suggestions ?? [];
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("refine-topics error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
