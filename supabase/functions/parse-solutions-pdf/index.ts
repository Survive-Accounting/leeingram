import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Regex patterns for accounting solution block boundaries
const BLOCK_PATTERNS = [
  { type: "BE", regex: /(?:Brief\s+Exercise|BE)\s*([0-9]+[-–.][0-9]+[A-Za-z]?)/gi },
  { type: "E", regex: /(?:Exercise|E)\s*([0-9]+[-–.][0-9]+[A-Za-z]?)/gi },
  { type: "P", regex: /(?:Problem|P)\s*([0-9]+[-–.][0-9]+[A-Za-z]?)/gi },
];

interface DetectedBlock {
  source_code: string;
  source_type: string;
  page_start: number;
  page_end: number;
  raw_text: string;
  cleaned_text: string;
  confidence: number;
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectBlocks(pages: { pageNum: number; text: string }[]): DetectedBlock[] {
  // Combine all pages into one big string with page markers
  const fullText = pages.map((p) => `<<<PAGE_${p.pageNum}>>>\n${p.text}`).join("\n");

  // Find all block starts
  type Match = { type: string; code: string; index: number; fullMatch: string };
  const matches: Match[] = [];

  for (const pat of BLOCK_PATTERNS) {
    const re = new RegExp(pat.regex.source, pat.regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(fullText)) !== null) {
      matches.push({
        type: pat.type,
        code: `${pat.type}${m[1]}`,
        index: m.index,
        fullMatch: m[0],
      });
    }
  }

  // Sort by position
  matches.sort((a, b) => a.index - b.index);

  // Deduplicate: if same code appears multiple times, keep first
  const seen = new Set<string>();
  const unique = matches.filter((m) => {
    const key = m.code.toUpperCase().replace(/[–.]/g, "-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Extract text between boundaries
  const blocks: DetectedBlock[] = [];
  for (let i = 0; i < unique.length; i++) {
    const start = unique[i].index;
    const end = i + 1 < unique.length ? unique[i + 1].index : fullText.length;
    const rawText = fullText.slice(start, end);

    // Determine page range
    const pageMarkers = rawText.matchAll(/<<<PAGE_(\d+)>>>/g);
    const pageNums: number[] = [];
    for (const pm of pageMarkers) pageNums.push(parseInt(pm[1]));

    // Also check what page the start is on
    const beforeStart = fullText.slice(0, start);
    const lastPageBefore = [...beforeStart.matchAll(/<<<PAGE_(\d+)>>>/g)];
    const startPage = lastPageBefore.length > 0 ? parseInt(lastPageBefore[lastPageBefore.length - 1][1]) : 1;
    const allPages = [startPage, ...pageNums];
    const pageStart = Math.min(...allPages);
    const pageEnd = Math.max(...allPages);

    const cleaned = cleanText(rawText.replace(/<<<PAGE_\d+>>>/g, ""));

    // Confidence heuristic
    let confidence = 0.8;
    if (cleaned.length < 50) confidence = 0.3;
    else if (cleaned.length < 150) confidence = 0.5;
    if (/\d/.test(cleaned) && /[a-zA-Z]/.test(cleaned)) confidence = Math.min(confidence + 0.1, 1);
    if (/debit|credit|journal|entry|cash|revenue|expense/i.test(cleaned)) confidence = Math.min(confidence + 0.1, 1);

    blocks.push({
      source_code: unique[i].code,
      source_type: unique[i].type,
      page_start: pageStart,
      page_end: pageEnd,
      raw_text: rawText.replace(/<<<PAGE_\d+>>>/g, ""),
      cleaned_text: cleaned,
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  return blocks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_id, course_id, chapter_id, storage_path } = await req.json();

    if (!file_id || !course_id || !chapter_id || !storage_path) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: file_id, course_id, chapter_id, storage_path" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download the PDF from storage
    const { data: fileData, error: dlError } = await supabase.storage
      .from("chapter-resources")
      .download(storage_path);
    if (dlError || !fileData) {
      throw new Error(`Failed to download PDF: ${dlError?.message || "no data"}`);
    }

    // Use pdf-parse to extract text
    const pdfParse = (await import("npm:pdf-parse@1.1.1")).default;
    const buffer = await fileData.arrayBuffer();
    const pdfData = await pdfParse(Buffer.from(buffer));

    // Build per-page text (pdf-parse gives us combined text; we split by form feeds or use numpages)
    // pdf-parse doesn't give per-page easily, so we'll use a page-marker approach
    const rawText = pdfData.text || "";
    const numPages = pdfData.numpages || 1;

    // Simple page splitting: split by form feed or estimate
    const pageTexts = rawText.split(/\f/);
    const pages = pageTexts.map((text: string, i: number) => ({
      pageNum: i + 1,
      text,
    }));

    // Detect blocks
    const blocks = detectBlocks(pages);

    // Store parsed blocks in database
    if (blocks.length > 0) {
      const inserts = blocks.map((b) => ({
        file_id,
        course_id,
        chapter_id,
        source_code: b.source_code,
        source_type: b.source_type,
        page_start: b.page_start,
        page_end: b.page_end,
        raw_text: b.raw_text,
        cleaned_text: b.cleaned_text,
        confidence: b.confidence,
        status: "pending",
      }));

      const { error: insertError } = await supabase.from("parsed_solution_blocks").insert(inserts);
      if (insertError) throw new Error(`Failed to insert blocks: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_pages: numPages,
        blocks_found: blocks.length,
        blocks: blocks.map((b) => ({
          source_code: b.source_code,
          source_type: b.source_type,
          page_start: b.page_start,
          page_end: b.page_end,
          confidence: b.confidence,
          text_preview: b.cleaned_text.slice(0, 200),
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("parse-solutions-pdf error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
