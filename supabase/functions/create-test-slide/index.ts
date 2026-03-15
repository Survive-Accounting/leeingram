const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_SLIDES_API = "https://slides.googleapis.com/v1/presentations";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPES = [
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/drive",
];

const ROOT_FOLDER_ID = "1Lu00SDbRHDxlMqAu_sa0aZbSw_HHfSbx";

// ── Google Auth helpers ──────────────────────────────────────────────

function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importKey(pem: string): Promise<CryptoKey> {
  const lines = pem.split("\n").filter(l => !l.startsWith("-----")).join("");
  const binary = Uint8Array.from(atob(lines), c => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", binary, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    iss: sa.client_email, scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })));
  const key = await importKey(sa.private_key);
  const sig = base64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`)));
  const jwt = `${header}.${payload}.${sig}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Google API helper ────────────────────────────────────────────────

async function googleFetch(url: string, token: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { rawBody: text }; }
  if (!res.ok) {
    const ge = data?.error;
    const code = ge?.code ?? res.status;
    const status = ge?.status ?? "UNKNOWN";
    const message = ge?.message ?? text;
    console.error(`Google API ${code} (${status}): ${message}`, { url: url.split("?")[0], errors: ge?.errors });
    throw Object.assign(new Error(`Google API ${code}: ${message}`), { googleCode: code, googleStatus: status, responseBody: data });
  }
  return data;
}

// ── Drive helpers ────────────────────────────────────────────────────

async function findOrCreateFolder(token: string, name: string, parentId?: string): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false${parentId ? ` and '${parentId}' in parents` : ""}`;
  const searchData = await googleFetch(
    `${GOOGLE_DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    token
  );
  if (searchData.files?.length) return searchData.files[0].id;

  const createData = await googleFetch(`${GOOGLE_DRIVE_API}?supportsAllDrives=true`, token, {
    method: "POST",
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  return createData.id;
}

async function ensureFolderHierarchy(
  token: string, courseCode: string, chapterNumber: string | number, serviceAccountEmail: string
): Promise<{ courseFolderId: string; chapterFolderId: string }> {
  try {
    await googleFetch(`${GOOGLE_DRIVE_API}/${ROOT_FOLDER_ID}?fields=id,name&supportsAllDrives=true`, token);
  } catch (e) {
    throw new Error(`Cannot access shared root folder ${ROOT_FOLDER_ID}. Share with: ${serviceAccountEmail}`);
  }
  const courseFolderId = await findOrCreateFolder(token, courseCode, ROOT_FOLDER_ID);
  const chapterLabel = `Chapter ${String(chapterNumber).padStart(2, "0")}`;
  const chapterFolderId = await findOrCreateFolder(token, chapterLabel, courseFolderId);
  return { courseFolderId, chapterFolderId };
}

async function moveFileToFolder(token: string, fileId: string, addParentId: string, removeParentIds: string[]) {
  const params = new URLSearchParams({ supportsAllDrives: "true", addParents: addParentId });
  if (removeParentIds.length > 0) params.set("removeParents", removeParentIds.join(","));
  await googleFetch(`${GOOGLE_DRIVE_API}/${fileId}?${params.toString()}`, token, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

// ── DB fetch helper ──────────────────────────────────────────────────

async function fetchAssetData(supabaseUrl: string, serviceRoleKey: string, assetId: string) {
  const authHeaders = { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey };

  const assetRes = await fetch(
    `${supabaseUrl}/rest/v1/teaching_assets?id=eq.${assetId}&select=*`,
    { headers: authHeaders }
  );
  const assets = await assetRes.json();
  const asset = assets?.[0];
  if (!asset) throw new Error(`Teaching asset not found: ${assetId}`);

  let chapter: any = null;
  if (asset.chapter_id) {
    const chRes = await fetch(
      `${supabaseUrl}/rest/v1/chapters?id=eq.${asset.chapter_id}&select=id,chapter_number,chapter_name,course_id`,
      { headers: authHeaders }
    );
    const chapters = await chRes.json();
    chapter = chapters?.[0] || null;
  }

  let course: any = null;
  if (asset.course_id) {
    const coRes = await fetch(
      `${supabaseUrl}/rest/v1/courses?id=eq.${asset.course_id}&select=id,course_name,code`,
      { headers: authHeaders }
    );
    const courses = await coRes.json();
    course = courses?.[0] || null;
  }

  // Fetch problem instructions
  let problemInstructions: { instruction_number: number; instruction_text: string }[] = [];
  const instrRes = await fetch(
    `${supabaseUrl}/rest/v1/problem_instructions?teaching_asset_id=eq.${assetId}&select=instruction_number,instruction_text&order=instruction_number`,
    { headers: authHeaders }
  );
  const instrData = await instrRes.json();
  if (Array.isArray(instrData)) {
    problemInstructions = instrData;
  }

  return { asset, chapter, course, problemInstructions };
}

// ── JE normalizer (same as create-asset-sheet) ───────────────────────

function normalizeJEFromJson(json: any): any[] {
  if (!json) return [];
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (data.scenario_sections && Array.isArray(data.scenario_sections)) {
      const entries: any[] = [];
      for (const section of data.scenario_sections) {
        const dateEntries = section.entries_by_date || section.journal_entries || [];
        for (const entry of dateEntries) {
          entries.push({ date: entry.date || entry.entry_date || entry.requirement || section.label || "", rows: entry.rows || entry.accounts || [] });
        }
      }
      return entries;
    }
    if (Array.isArray(data)) return data.map((e: any) => ({ date: e.date || e.entry_date || e.requirement || "", rows: e.accounts || e.rows || [] }));
    if (data.parts && Array.isArray(data.parts)) {
      const entries: any[] = [];
      for (const part of data.parts) {
        for (const entry of (part.journal_entries || part.entries || [])) {
          entries.push({ date: entry.date || entry.requirement || "", rows: entry.accounts || entry.rows || [] });
        }
      }
      return entries;
    }
    const arr = data.journal_entries || data.entries;
    if (Array.isArray(arr)) return arr.map((e: any) => ({ date: e.date || e.entry_date || e.requirement || "", rows: e.accounts || e.rows || [] }));
    return [];
  } catch { return []; }
}

function jeToRawText(entries: any[]): string {
  if (entries.length === 0) return "";
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.date) lines.push(entry.date);
    for (const row of (entry.rows || [])) {
      const acct = row.account_name || row.account || "";
      const isCredit = row.side === "credit" || (row.credit != null && row.credit !== 0 && (row.debit == null || row.debit === 0));
      const indent = isCredit ? "    " : "";
      const amt = isCredit
        ? (row.credit != null ? `  ${Number(row.credit).toLocaleString()}` : "")
        : (row.debit != null ? `  ${Number(row.debit).toLocaleString()}` : "");
      lines.push(`${indent}${acct}${amt}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

function buildInstructionList(instructions: { instruction_number: number; instruction_text: string }[]): string {
  if (!instructions || instructions.length === 0) return "";
  return instructions.sort((a, b) => a.instruction_number - b.instruction_number).map(i => `${i.instruction_number}. ${i.instruction_text}`).join("\n");
}

function buildAnswerSummary(asset: any): string {
  const solutionText = asset.survive_solution_text || "";
  return solutionText.length > 5000 ? solutionText.slice(0, 5000) + "…" : solutionText;
}

// ── Slides builder ───────────────────────────────────────────────────

function truncate(val: string, max = 500): string {
  if (!val || val.length <= max) return val || "";
  return val.slice(0, max) + "... [truncated]";
}

interface SlideField {
  label: string;
  value: string;
}

function buildFieldList(asset: any, course: any, chapter: any, problemInstructions: any[]): SlideField[] {
  const instrSlots = ["", "", "", "", ""];
  for (const instr of problemInstructions) {
    const idx = instr.instruction_number - 1;
    if (idx >= 0 && idx < 5) instrSlots[idx] = instr.instruction_text || "";
  }

  const jeEntries = normalizeJEFromJson(asset.journal_entry_completed_json);
  const jeRaw = jeToRawText(jeEntries);

  const fields: SlideField[] = [
    { label: "ASSET CODE", value: asset.asset_name || "" },
    { label: "COURSE", value: course?.code ? `${course.code} — ${course.course_name}` : "" },
    { label: "CHAPTER", value: chapter ? `Ch ${chapter.chapter_number} — ${chapter.chapter_name}` : "" },
    { label: "PROBLEM CONTEXT", value: asset.problem_context || "" },
    { label: "PROBLEM TEXT", value: asset.survive_problem_text || "" },
    { label: "INSTRUCTIONS", value: buildInstructionList(problemInstructions) },
    { label: "INSTRUCTION 1", value: instrSlots[0] },
    { label: "INSTRUCTION 2", value: instrSlots[1] },
    { label: "INSTRUCTION 3", value: instrSlots[2] },
    { label: "INSTRUCTION 4", value: instrSlots[3] },
    { label: "INSTRUCTION 5", value: instrSlots[4] },
    { label: "WORKED STEPS / SOLUTION", value: asset.survive_solution_text || "" },
    { label: "ANSWER SUMMARY", value: buildAnswerSummary(asset) },
    { label: "JOURNAL ENTRIES (RAW)", value: jeRaw },
    { label: "IMPORTANT FORMULAS", value: asset.important_formulas || "" },
    { label: "CONCEPT NOTES", value: asset.concept_notes || "" },
    { label: "EXAM TRAPS", value: asset.exam_traps || "" },
  ];

  // Filter out empty fields
  return fields.filter(f => f.value.trim().length > 0);
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: authHeader, apikey: anonKey },
      });
      if (!verifyRes.ok) {
        await verifyRes.text();
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await verifyRes.text();
    }

    const body = await req.json();
    const { teaching_asset_id } = body;

    if (!teaching_asset_id) {
      return new Response(JSON.stringify({ error: "Missing required field: teaching_asset_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Fetch asset data
    const { asset, chapter, course, problemInstructions } = await fetchAssetData(
      supabaseUrl, serviceRoleKey, teaching_asset_id
    );

    const assetCode = asset.asset_name || "";
    const courseCode = course?.code || "";
    const chapterNumber = chapter?.chapter_number ?? 0;

    // Get Google credentials
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    // ── Step 1: Navigate to asset subfolder and find/create "Test Slides" ──
    const { chapterFolderId } = await ensureFolderHierarchy(token, courseCode, chapterNumber, sa.client_email);
    const assetFolderId = await findOrCreateFolder(token, assetCode, chapterFolderId);
    const testSlidesFolderId = await findOrCreateFolder(token, "Test Slides", assetFolderId);

    console.log(`Test Slides folder: ${testSlidesFolderId} inside asset ${assetCode}`);

    // ── Step 2: Create Google Slides presentation via Drive API ──────
    const presentationTitle = assetCode;

    const driveCreateRes = await googleFetch(`${GOOGLE_DRIVE_API}?supportsAllDrives=true`, token, {
      method: "POST",
      body: JSON.stringify({
        name: presentationTitle,
        mimeType: "application/vnd.google-apps.presentation",
      }),
    });

    const presentationId = driveCreateRes.id;
    const slideUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
    console.log(`Created presentation via Drive API: ${presentationId}`);

    // Try to fetch presentation details and add content via Slides API
    let defaultSlideId: string | undefined;
    let slidesApiAvailable = true;
    try {
      const presData = await googleFetch(`${GOOGLE_SLIDES_API}/${presentationId}`, token);
      defaultSlideId = presData.slides?.[0]?.objectId;
    } catch (e: any) {
      console.warn("Slides API not available, presentation created but content not populated:", e.message);
      slidesApiAvailable = false;
    }

    // ── Step 3: Build text content for the slide ─────────────────────
    const fields = buildFieldList(asset, course, chapter, problemInstructions);

    // Build combined text block
    const textLines: string[] = [];
    for (const field of fields) {
      textLines.push(`${field.label}:`);
      textLines.push(truncate(field.value));
      textLines.push(""); // blank separator
    }
    const fullText = textLines.join("\n");

    // ── Step 4: Add a single large text box to the default slide ─────
    // Standard 16:9 slide is 10" x 5.625" (in EMU: 1 inch = 914400 EMU)
    const slideRequests: any[] = [];

    if (defaultSlideId) {
      // Delete the default empty text elements on the blank slide
      for (const element of (createRes.slides?.[0]?.pageElements || [])) {
        slideRequests.push({ deleteObject: { objectId: element.objectId } });
      }
    }

    const textBoxId = "dataTextBox";
    slideRequests.push({
      createShape: {
        objectId: textBoxId,
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: defaultSlideId,
          size: {
            width: { magnitude: 8800000, unit: "EMU" }, // ~9.6 inches
            height: { magnitude: 4800000, unit: "EMU" }, // ~5.25 inches
          },
          transform: {
            scaleX: 1, scaleY: 1, translateX: 200000, translateY: 200000,
            unit: "EMU",
          },
        },
      },
    });

    slideRequests.push({
      insertText: {
        objectId: textBoxId,
        text: fullText,
        insertionIndex: 0,
      },
    });

    // Style the entire text box: Arial 10pt
    slideRequests.push({
      updateTextStyle: {
        objectId: textBoxId,
        style: {
          fontFamily: "Arial",
          fontSize: { magnitude: 10, unit: "PT" },
        },
        textRange: { type: "ALL" },
        fields: "fontFamily,fontSize",
      },
    });

    // Bold the field labels
    let charIdx = 0;
    for (const field of fields) {
      const labelEnd = charIdx + field.label.length + 1; // +1 for ":"
      slideRequests.push({
        updateTextStyle: {
          objectId: textBoxId,
          style: {
            bold: true,
            fontSize: { magnitude: 11, unit: "PT" },
          },
          textRange: { type: "FIXED_RANGE", startIndex: charIdx, endIndex: labelEnd },
          fields: "bold,fontSize",
        },
      });
      // Move past: "LABEL:\nvalue\n\n"
      const valueText = truncate(field.value);
      charIdx = labelEnd + 1 + valueText.length + 1 + 1; // \n after label, value text, \n after value, \n blank
    }

    // Execute all slide modifications
    await googleFetch(`${GOOGLE_SLIDES_API}/${presentationId}:batchUpdate`, token, {
      method: "POST",
      body: JSON.stringify({ requests: slideRequests }),
    });

    // ── Step 5: Move presentation to Test Slides folder ──────────────
    // Get current parents
    const fileInfo = await googleFetch(
      `${GOOGLE_DRIVE_API}/${presentationId}?fields=parents&supportsAllDrives=true`,
      token
    );
    const currentParents = fileInfo.parents || [];
    await moveFileToFolder(token, presentationId, testSlidesFolderId, currentParents);
    console.log(`Moved presentation to Test Slides folder`);

    // ── Step 6: Update Supabase ──────────────────────────────────────
    await fetch(`${supabaseUrl}/rest/v1/teaching_assets?id=eq.${teaching_asset_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: anonKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        test_slide_id: presentationId,
        test_slide_url: slideUrl,
      }),
    });

    return new Response(JSON.stringify({
      success: true,
      presentation_id: presentationId,
      test_slide_url: slideUrl,
      test_slides_folder_url: `https://drive.google.com/drive/folders/${testSlidesFolderId}`,
      asset_code: assetCode,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("create-test-slide error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    const httpStatus = err.googleCode && err.googleCode >= 400 && err.googleCode < 500 ? err.googleCode : 500;
    return new Response(JSON.stringify({
      success: false,
      error: msg,
      google_status: err.googleStatus ?? null,
      response_body: err.responseBody ?? null,
    }), {
      status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
