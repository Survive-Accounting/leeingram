import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Pipe table detection ──
function parsePipeTable(lines: string[]): string[][] | null {
  const rows: string[][] = [];
  for (const line of lines) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells[0] === "") cells.shift();
    if (cells[cells.length - 1] === "") cells.pop();
    if (cells.every((c) => /^[-:]+$/.test(c))) continue;
    rows.push(cells);
  }
  return rows.length >= 2 ? rows : null;
}

function isNumeric(cell: string): boolean {
  return /^\$?[\d,]+(\.\d+)?%?$/.test(cell.trim());
}

// ── Convert problem text to HTML ──
function problemTextToHtml(text: string): string {
  if (!text.trim()) return "";
  const allLines = text.split("\n");
  const parts: string[] = [];
  let li = 0;

  while (li < allLines.length) {
    if (
      li < allLines.length - 1 &&
      allLines[li].includes("|") &&
      allLines[li + 1].includes("|")
    ) {
      const tableStart = li;
      while (li < allLines.length && allLines[li].includes("|")) li++;
      const tableLines = allLines.slice(tableStart, li);
      const tableRows = parsePipeTable(tableLines);
      if (tableRows) {
        const [header, ...body] = tableRows;
        let html = `<table class="problem-table"><thead><tr>`;
        for (const h of header) html += `<th>${escHtml(h)}</th>`;
        html += `</tr></thead><tbody>`;
        for (const row of body) {
          html += `<tr>`;
          for (const cell of row) {
            const align = isNumeric(cell) ? ' style="text-align:right"' : "";
            html += `<td${align}>${escHtml(cell)}</td>`;
          }
          html += `</tr>`;
        }
        html += `</tbody></table>`;
        parts.push(html);
      }
    } else {
      const line = allLines[li];
      li++;
      if (!line.trim()) {
        parts.push("<br/>");
        continue;
      }
      parts.push(`<p>${escHtml(line)}</p>`);
    }
  }
  return parts.join("\n");
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Work box size heuristic ──
function workBoxSize(instruction: string): string {
  const lower = instruction.toLowerCase();
  if (lower.includes("journal entr")) return "lg";
  if (lower.includes("prepare") || lower.includes("record")) return "lg";
  if (
    (lower.includes("compute") ||
      lower.includes("calculate") ||
      lower.includes("determine")) &&
    ["and", ",", "each", "both", "total"].some((k) => lower.includes(k))
  )
    return "md";
  if (instruction.length < 60) return "sm";
  return "md";
}

// ── Build instructions HTML ──
function instructionsToHtml(instructions: string[]): string {
  return instructions
    .map((inst, idx) => {
      const letter = String.fromCharCode(97 + idx);
      const size = workBoxSize(inst);
      return `<div class="instruction-row">
  <div class="instruction-text"><b>(${letter})</b> ${escHtml(inst)}</div>
  <div class="work-box ${size}"></div>
</div>`;
    })
    .join("\n");
}

// ── Build the full HTML template ──
function buildHtml(data: {
  sourceRef: string;
  problemTitle: string;
  courseName: string;
  chapterName: string;
  problemTextHtml: string;
  instructionsHtml: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 11px;
    color: #1e293b;
    background: #fff;
    width: 816px;
  }
  .header {
    background: #14213D;
    padding: 14px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header img.logo { height: 28px; width: auto; }
  .header .byline { color: rgba(255,255,255,0.6); font-size: 10px; }
  .cta {
    background: #f0fdf4;
    border-bottom: 1px solid #bbf7d0;
    padding: 9px 24px;
    font-size: 10px;
    color: #14213D;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cta .cta-left { color: #14213D; }
  .cta .cta-right { font-weight: 700; color: #14213D; }
  .content { padding: 20px 24px; }
  .based-on { font-size: 10px; color: #64748b; margin-bottom: 4px; }
  .problem-title { font-size: 16px; font-weight: 700; color: #14213D; margin-bottom: 4px; }
  .course-label { font-size: 10px; color: #64748b; margin-bottom: 16px; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin-bottom: 16px; }
  .section-label {
    font-size: 8px; font-weight: 700; letter-spacing: 1.2px;
    text-transform: uppercase; color: #94a3b8; margin-bottom: 8px;
  }
  .problem-text { font-size: 11px; line-height: 1.65; color: #1e293b; margin-bottom: 16px; }
  .problem-text p { margin-bottom: 4px; }
  table.problem-table {
    width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10.5px;
  }
  table.problem-table th {
    background: #14213D; color: white; padding: 7px 10px;
    text-align: left; font-size: 10px; font-weight: 600;
  }
  table.problem-table td {
    padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b;
  }
  table.problem-table tr:nth-child(even) td { background: #f8fafc; }
  .instructions-wrap { margin-top: 16px; }
  .instruction-row { margin-bottom: 10px; }
  .instruction-text { font-size: 11px; color: #1e293b; line-height: 1.6; margin-bottom: 8px; }
  .instruction-text b { font-weight: 700; }
  .work-box {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 16px;
  }
  .work-box.sm { height: 80px; }
  .work-box.md { height: 110px; }
  .work-box.lg { height: 140px; }
</style>
</head>
<body>
<div class="header">
  <img class="logo" src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png" alt="Survive Accounting" />
  <span class="byline">Created by Lee Ingram</span>
</div>
<div class="cta">
  <span class="cta-left">Get full solution + more study tools at</span>
  <span class="cta-right">SurviveAccounting.com →</span>
</div>
<div class="content">
  <div class="based-on">Practice problem based on ${escHtml(data.sourceRef)}</div>
  ${data.problemTitle ? `<div class="problem-title">${escHtml(data.problemTitle)}</div>` : ""}
  <div class="course-label">${escHtml(data.courseName)} · ${escHtml(data.chapterName)}</div>
  <hr class="divider" />
  <div class="section-label">Problem</div>
  <div class="problem-text">${data.problemTextHtml}</div>
  ${data.instructionsHtml ? `<div class="section-label">Instructions</div><div class="instructions-wrap">${data.instructionsHtml}</div>` : ""}
</div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { asset_name } = await req.json();
    if (!asset_name) throw new Error("asset_name is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Fetch teaching asset
    const { data: asset, error: assetErr } = await sb
      .from("teaching_assets")
      .select(
        `source_ref, problem_title, problem_context,
         chapter_id, course_id,
         chapters!teaching_assets_chapter_id_fkey ( chapter_number, chapter_name ),
         courses!teaching_assets_course_id_fkey ( course_name, code )`
      )
      .eq("asset_name", asset_name)
      .limit(1)
      .single();

    if (assetErr || !asset) throw new Error("Asset not found: " + asset_name);

    // 2. Fetch instructions
    const { data: instrData } = await sb
      .from("problem_instructions")
      .select("instruction_number, instruction_text")
      .eq("teaching_asset_id", (asset as any).id || "")
      .order("instruction_number");

    // Fallback: fetch asset id if needed for instructions
    let instructions: string[] = [];
    if (instrData && instrData.length > 0) {
      instructions = instrData
        .sort((a: any, b: any) => a.instruction_number - b.instruction_number)
        .filter((i: any) => i.instruction_text?.trim())
        .map((i: any) => i.instruction_text);
    }

    // If no instructions from problem_instructions, fetch from asset columns
    if (instructions.length === 0) {
      const { data: fullAsset } = await sb
        .from("teaching_assets")
        .select("id, instruction_1, instruction_2, instruction_3, instruction_4, instruction_5, instruction_list")
        .eq("asset_name", asset_name)
        .single();

      if (fullAsset) {
        // Try problem_instructions with proper id
        const { data: instrData2 } = await sb
          .from("problem_instructions")
          .select("instruction_number, instruction_text")
          .eq("teaching_asset_id", fullAsset.id)
          .order("instruction_number");

        if (instrData2 && instrData2.length > 0) {
          instructions = instrData2
            .filter((i: any) => i.instruction_text?.trim())
            .map((i: any) => i.instruction_text);
        } else {
          const i1 = (fullAsset as any).instruction_1;
          if (i1?.trim()) {
            instructions = [i1, (fullAsset as any).instruction_2, (fullAsset as any).instruction_3, (fullAsset as any).instruction_4, (fullAsset as any).instruction_5]
              .filter((v: string | null) => v?.trim()) as string[];
          } else if ((fullAsset as any).instruction_list?.trim()) {
            instructions = (fullAsset as any).instruction_list
              .split(/[\n|]/)
              .map((s: string) => s.trim())
              .filter(Boolean);
          }
        }
      }
    }

    const chapter = (asset as any).chapters;
    const course = (asset as any).courses;
    const sourceRef = (asset as any).source_ref || "";
    const problemTitle = (asset as any).problem_title || "";
    const problemContext = (asset as any).problem_context || "";
    const courseName = (() => {
      const code = (course?.code || "").toUpperCase();
      if (code === "IA2") return "Intermediate Accounting 2";
      if (code === "IA1") return "Intermediate Accounting 1";
      if (code === "MA2") return "Managerial Accounting";
      if (code === "FA1") return "Financial Accounting";
      return course?.course_name || code;
    })();
    const chapterName =
      chapter?.chapter_number && chapter?.chapter_name
        ? `Ch ${chapter.chapter_number} — ${chapter.chapter_name}`
        : "";

    // 3. Build HTML
    const problemTextHtml = problemTextToHtml(problemContext);
    const instructionsHtml = instructionsToHtml(instructions);
    const html = buildHtml({
      sourceRef,
      problemTitle,
      courseName,
      chapterName,
      problemTextHtml,
      instructionsHtml,
    });

    // 4. Generate PDF via HCTI
    const hctiUserId = Deno.env.get("HCTI_USER_ID");
    const hctiApiKey = Deno.env.get("HCTI_API_KEY");

    if (!hctiUserId || !hctiApiKey) {
      throw new Error("HCTI credentials not configured");
    }

    const hctiResp = await fetch("https://hcti.io/v1/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " + btoa(`${hctiUserId}:${hctiApiKey}`),
      },
      body: JSON.stringify({
        html,
        css: "",
        google_fonts: "Inter",
        viewport_width: 816,
        device_scale: 2,
      }),
    });

    if (!hctiResp.ok) {
      const errText = await hctiResp.text();
      console.error("HCTI error:", hctiResp.status, errText);
      throw new Error(`HCTI API error: ${hctiResp.status}`);
    }

    const hctiData = await hctiResp.json();
    const imageUrl = hctiData.url;

    if (!imageUrl) {
      throw new Error("HCTI returned no URL");
    }

    // Fetch the image as PDF by appending .pdf
    const pdfUrl = imageUrl.replace(/\.(png|jpg|jpeg)$/i, "") + ".pdf";
    const pdfResp = await fetch(pdfUrl);

    if (!pdfResp.ok) {
      // Fallback: return HTML with print CSS
      const safeRef = sourceRef.replace(/\s+/g, "-");
      return new Response(html, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="SurviveAccounting-${safeRef}-Practice.html"`,
        },
      });
    }

    const pdfBytes = await pdfResp.arrayBuffer();
    const safeRef = sourceRef.replace(/\s+/g, "-");

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="SurviveAccounting-${safeRef}-Practice.pdf"`,
      },
    });
  } catch (e) {
    console.error("generate-practice-pdf error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
