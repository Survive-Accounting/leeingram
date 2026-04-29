// Generate concise transaction descriptions for JE Helper cards.
// Calls Anthropic directly (per project rule — bypass Lovable gateway).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface IncomingEntry {
  key: string;
  scenario_label?: string;
  instructions_snippet?: string;
  date?: string;
  rows: { account_name: string; side: "debit" | "credit" }[];
}

interface OutLabel {
  key: string;
  description: string;
}

const SYSTEM = `You write very short transaction descriptions for accounting journal entries shown to students.

Rules:
- 3 to 8 words. Title case. No trailing period.
- Describe WHAT the transaction is, not which "Part" of the textbook problem it belongs to.
- Prefer the economic event (e.g. "Initial ROU asset and lease liability", "Initial lease payment", "Lease expense and ROU amortization", "Issued bonds at a discount", "Record bond interest expense", "Pay accrued interest").
- Do NOT start with "Record" / "Recognize" / "To" unless it reads more naturally that way.
- Never include dollar amounts, dates, or "Part (a)/(b)/etc." in the description.
- Use the account names + sides as the primary signal. Use the instructions snippet only as context.

Return your answer ONLY by calling the provided tool.`;

async function callAnthropic(entries: IncomingEntry[]): Promise<OutLabel[]> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const userPayload = {
    entries: entries.map((e) => ({
      key: e.key,
      scenario_label: e.scenario_label ?? null,
      instructions_snippet: (e.instructions_snippet ?? "").slice(0, 600),
      date: e.date ?? null,
      rows: e.rows.map((r) => ({ account: r.account_name, side: r.side })),
    })),
  };

  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM,
    tools: [
      {
        name: "return_labels",
        description: "Return one short transaction description per entry.",
        input_schema: {
          type: "object",
          properties: {
            labels: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  description: { type: "string" },
                },
                required: ["key", "description"],
              },
            },
          },
          required: ["labels"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "return_labels" },
    messages: [
      {
        role: "user",
        content:
          "Write a short transaction description for each entry below.\n\n" +
          JSON.stringify(userPayload, null, 2),
      },
    ],
  };

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  const toolUse = (data.content ?? []).find((b: any) => b.type === "tool_use");
  const labels: OutLabel[] = toolUse?.input?.labels ?? [];
  return labels;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { entries } = (await req.json()) as { entries: IncomingEntry[] };
    if (!Array.isArray(entries) || entries.length === 0) {
      return new Response(JSON.stringify({ labels: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (entries.length > 30) {
      return new Response(
        JSON.stringify({ error: "Too many entries (max 30 per call)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const labels = await callAnthropic(entries);
    return new Response(JSON.stringify({ labels }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-je-transaction-labels] error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
