const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"];

const ROOT_FOLDER_ID = "1Lu00SDbRHDxlMqAu_sa0aZbSw_HHfSbx";
const ARCHIVE_FOLDER_NAME = "Archive";

// Template file IDs
const MASTER_TEMPLATE_ID = "15yytFbb_tOLCIsR4dLoFVb0oNTFm9X6LfUVN1OKGY-A";
const PRACTICE_TEMPLATE_ID = "15yytFbb_tOLCIsR4dLoFVb0oNTFm9X6LfUVN1OKGY-A"; // TODO: Replace with actual Practice template ID
const PROMO_TEMPLATE_ID = "15yytFbb_tOLCIsR4dLoFVb0oNTFm9X6LfUVN1OKGY-A"; // TODO: Replace with actual Promo template ID

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
    throw Object.assign(new Error(`Google API ${code}: ${message}`), { googleCode: code, googleStatus: status });
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

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

type DriveSheetFile = { id: string; name: string; parents?: string[]; modifiedTime?: string };

async function findSheetsByNameInFolder(token: string, fileName: string, folderId: string): Promise<DriveSheetFile[]> {
  const safeName = escapeDriveQueryValue(fileName);
  const q = `mimeType='application/vnd.google-apps.spreadsheet' and name='${safeName}' and trashed=false and '${folderId}' in parents`;
  const searchData = await googleFetch(
    `${GOOGLE_DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name,parents,modifiedTime)&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    token
  );
  return (searchData.files || []) as DriveSheetFile[];
}

async function moveFileToFolder(token: string, fileId: string, addParentId: string, removeParentIds: string[]) {
  const params = new URLSearchParams({ supportsAllDrives: "true", addParents: addParentId });
  if (removeParentIds.length > 0) params.set("removeParents", removeParentIds.join(","));
  await googleFetch(`${GOOGLE_DRIVE_API}/${fileId}?${params.toString()}`, token, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

async function archiveDuplicateSheets(token: string, duplicates: DriveSheetFile[], chapterFolderId: string) {
  if (duplicates.length === 0) return;
  const archiveFolderId = await findOrCreateFolder(token, ARCHIVE_FOLDER_NAME, chapterFolderId);
  for (const dup of duplicates) {
    const removeParents = dup.parents?.length ? dup.parents : [chapterFolderId];
    try {
      await moveFileToFolder(token, dup.id, archiveFolderId, removeParents);
      console.log(`Archived duplicate sheet ${dup.id}`);
    } catch (e) { console.error(`Failed to archive duplicate ${dup.id} (non-fatal):`, e); }
  }
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

// ── Template copy with duplicate handling ────────────────────────────

async function copyTemplateWithArchive(
  token: string, templateFileId: string, name: string, parentFolderId: string
): Promise<{ fileId: string; isUpdate: boolean }> {
  // Check for existing sheets with this name
  const existing = await findSheetsByNameInFolder(token, name, parentFolderId);
  if (existing.length > 0) {
    // Archive all existing copies
    await archiveDuplicateSheets(token, existing, parentFolderId);
  }
  
  const copyRes = await googleFetch(`${GOOGLE_DRIVE_API}/${templateFileId}/copy?supportsAllDrives=true`, token, {
    method: "POST",
    body: JSON.stringify({
      name,
      parents: [parentFolderId],
    }),
  });
  return { fileId: copyRes.id, isUpdate: existing.length > 0 };
}

// ── Metadata writer (3-column: Field, Value, VA Actions) ─────────────

interface MetadataParams {
  asset_code: string;
  course_code: string;
  chapter_number: string;
  exercise_number: string;
  difficulty_estimate: string;
  asset_id: string;
  created_at: string;
  sheet_url: string;
  sheet_master_url: string;
  sheet_practice_url: string;
  sheet_promo_url: string;
  sheet_path_url: string;
  source_problem_link: string;
  source_solution_link: string;
  ebook_page_link: string;
  lw_video_link: string;
  lw_quiz_link: string;
  internal_asset_page: string;
  flag_issue_url: string;
  mark_verified_url: string;
  contact_lee_url: string;
  asset_type: string;
  variant_letter: string;
  va_creator: string;
  sheet_instance_id: string;
  variant_count: string;
  journal_entry_count: string;
  flag_status: string;
  sheet_verified: string;
  student_id_placeholder: string;
  session_audio_link: string;
  session_transcript_link: string;
}

function makeHyperlink(label: string, url: string): string {
  if (!url) return "";
  return `=HYPERLINK("${url.replace(/"/g, '""')}","${label.replace(/"/g, '""')}")`;
}

async function writeMetadata(token: string, spreadsheetId: string, params: MetadataParams) {
  // Build VA action links
  const vaActions: Record<string, string> = {
    mark_verified_url: makeHyperlink("Mark Sheet Ready", params.mark_verified_url),
    flag_issue_url: makeHyperlink("Flag Issue", params.flag_issue_url),
    internal_asset_page: makeHyperlink("Open Internal Asset Page", params.internal_asset_page),
    lw_video_link: makeHyperlink("Open LearnWorlds Video", params.lw_video_link),
    ebook_page_link: makeHyperlink("Open eBook Page", params.ebook_page_link),
    contact_lee_url: makeHyperlink("Contact Lee", params.contact_lee_url),
  };

  const fieldRows: [string, string, string][] = [
    ["Field", "Value", "VA Actions"],
    ["asset_code", params.asset_code, vaActions.mark_verified_url],
    ["course_code", params.course_code, vaActions.flag_issue_url],
    ["chapter_number", params.chapter_number, vaActions.internal_asset_page],
    ["exercise_number", params.exercise_number, vaActions.lw_video_link],
    ["difficulty_estimate", params.difficulty_estimate, vaActions.ebook_page_link],
    ["asset_id", params.asset_id, vaActions.contact_lee_url],
    ["created_at", params.created_at, ""],
    ["sheet_url", params.sheet_url, ""],
    ["sheet_master_url", params.sheet_master_url, ""],
    ["sheet_practice_url", params.sheet_practice_url, ""],
    ["sheet_promo_url", params.sheet_promo_url, ""],
    ["sheet_path_url", params.sheet_path_url, ""],
    ["", "", ""],
    ["source_problem_link", params.source_problem_link, ""],
    ["source_solution_link", params.source_solution_link, ""],
    ["ebook_page_link", params.ebook_page_link, ""],
    ["lw_video_link", params.lw_video_link, ""],
    ["lw_quiz_link", params.lw_quiz_link, ""],
    ["internal_asset_page", params.internal_asset_page, ""],
    ["flag_issue_url", params.flag_issue_url, ""],
    ["mark_verified_url", params.mark_verified_url, ""],
    ["contact_lee_url", params.contact_lee_url, ""],
    ["", "", ""],
    ["asset_type", params.asset_type, ""],
    ["variant_letter", params.variant_letter, ""],
    ["va_creator", params.va_creator, ""],
    ["sheet_instance_id", params.sheet_instance_id, ""],
    ["variant_count", params.variant_count, ""],
    ["journal_entry_count", params.journal_entry_count, ""],
    ["flag_status", params.flag_status, ""],
    ["sheet_verified", params.sheet_verified, ""],
    ["student_id_placeholder", params.student_id_placeholder, ""],
    ["session_audio_link", params.session_audio_link, ""],
    ["session_transcript_link", params.session_transcript_link, ""],
  ];

  const range = `METADATA!A1:C${fieldRows.length}`;
  await googleFetch(
    `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    token,
    { method: "PUT", body: JSON.stringify({ range, majorDimension: "ROWS", values: fieldRows }) }
  );
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

  const flagRes = await fetch(
    `${supabaseUrl}/rest/v1/asset_flags?teaching_asset_id=eq.${assetId}&status=eq.open&select=id`,
    { headers: { ...authHeaders, Prefer: "count=exact" } }
  );
  const flagCount = parseInt(flagRes.headers.get("content-range")?.split("/")?.[1] || "0", 10);

  let variantCount = 1;
  if (asset.source_ref && asset.chapter_id) {
    const varRes = await fetch(
      `${supabaseUrl}/rest/v1/teaching_assets?chapter_id=eq.${asset.chapter_id}&source_ref=eq.${encodeURIComponent(asset.source_ref)}&select=id`,
      { headers: { ...authHeaders, Prefer: "count=exact" } }
    );
    variantCount = parseInt(varRes.headers.get("content-range")?.split("/")?.[1] || "1", 10);
  }

  let jeCount = 0;
  if (asset.journal_entry_completed_json) {
    const jeData = asset.journal_entry_completed_json;
    if (Array.isArray(jeData)) {
      jeCount = jeData.length;
    } else if (typeof jeData === "object") {
      const entries = jeData.entries || jeData.journal_entries || [];
      jeCount = Array.isArray(entries) ? entries.length : 1;
    }
  }

  return { asset, chapter, course, flagCount, variantCount, jeCount };
}

// ── Extract variant letter from asset_name ───────────────────────────

function extractVariantLetter(assetName: string): string {
  const match = assetName.match(/_P\d+([A-Z])(?:_V\d+)?$/i);
  return match ? match[1].toUpperCase() : "A";
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
    const { asset_id } = body;

    if (!asset_id) {
      return new Response(JSON.stringify({ error: "Missing required field: asset_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // ── Fetch all asset data server-side ──────────────────────────────
    const { asset, chapter, course, flagCount, variantCount, jeCount } = await fetchAssetData(
      supabaseUrl, serviceRoleKey, asset_id
    );

    const assetCode = asset.asset_name || "";
    const courseCode = course?.code || "";
    const chapterNumber = chapter?.chapter_number ?? 0;

    // Get Google credentials
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    // Resolve folder hierarchy
    const { chapterFolderId } = await ensureFolderHierarchy(token, courseCode, chapterNumber, sa.client_email);
    const sheetPathUrl = `https://drive.google.com/drive/folders/${chapterFolderId}`;

    // ── Create 3 sheets ──────────────────────────────────────────────
    const sheetNames = {
      master: `${assetCode}_Master`,
      practice: `${assetCode}_Practice`,
      promo: `${assetCode}_Promo`,
    };

    const results: Record<string, { fileId: string; url: string; error?: string }> = {};
    const errors: string[] = [];

    // Master Sheet
    try {
      const { fileId } = await copyTemplateWithArchive(token, MASTER_TEMPLATE_ID, sheetNames.master, chapterFolderId);
      results.master = { fileId, url: `https://docs.google.com/spreadsheets/d/${fileId}` };
      console.log(`Created Master sheet: ${sheetNames.master} (${fileId})`);
    } catch (e: any) {
      const msg = `Master sheet creation failed: ${e.message}`;
      console.error(msg);
      errors.push(msg);
    }

    // Practice Sheet
    try {
      const { fileId } = await copyTemplateWithArchive(token, PRACTICE_TEMPLATE_ID, sheetNames.practice, chapterFolderId);
      results.practice = { fileId, url: `https://docs.google.com/spreadsheets/d/${fileId}` };
      console.log(`Created Practice sheet: ${sheetNames.practice} (${fileId})`);
    } catch (e: any) {
      const msg = `Practice sheet creation failed: ${e.message}`;
      console.error(msg);
      errors.push(msg);
    }

    // Promo Sheet
    try {
      const { fileId } = await copyTemplateWithArchive(token, PROMO_TEMPLATE_ID, sheetNames.promo, chapterFolderId);
      results.promo = { fileId, url: `https://docs.google.com/spreadsheets/d/${fileId}` };
      console.log(`Created Promo sheet: ${sheetNames.promo} (${fileId})`);
    } catch (e: any) {
      const msg = `Promo sheet creation failed: ${e.message}`;
      console.error(msg);
      errors.push(msg);
    }

    // If no sheets were created at all, fail
    if (!results.master && !results.practice && !results.promo) {
      throw new Error(`All sheet creations failed: ${errors.join("; ")}`);
    }

    const masterUrl = results.master?.url || "";
    const practiceUrl = results.practice?.url || "";
    const promoUrl = results.promo?.url || "";

    // ── Populate Metadata tab on Master Sheet (if created) ───────────
    if (results.master) {
      const spreadsheetId = results.master.fileId;
      const appBaseUrl = "https://leeingram.lovable.app";
      const metadataParams: MetadataParams = {
        asset_code: assetCode,
        course_code: courseCode,
        chapter_number: String(chapterNumber),
        exercise_number: asset.source_number || "",
        difficulty_estimate: asset.difficulty || "",
        asset_id: asset.id,
        created_at: asset.created_at || "",
        sheet_url: masterUrl,
        sheet_master_url: masterUrl,
        sheet_practice_url: practiceUrl,
        sheet_promo_url: promoUrl,
        sheet_path_url: sheetPathUrl,
        source_problem_link: "",
        source_solution_link: "",
        ebook_page_link: asset.lw_ebook_url || "",
        lw_video_link: asset.lw_video_url || "",
        lw_quiz_link: asset.lw_quiz_url || "",
        internal_asset_page: `${appBaseUrl}/assets?asset=${asset.id}`,
        flag_issue_url: `${appBaseUrl}/assets?asset=${asset.id}&action=flag`,
        mark_verified_url: `${appBaseUrl}/assets?asset=${asset.id}&action=verify`,
        contact_lee_url: `${appBaseUrl}/assets?asset=${asset.id}&action=contact`,
        asset_type: asset.problem_type || "",
        variant_letter: extractVariantLetter(assetCode),
        va_creator: "",
        sheet_instance_id: spreadsheetId,
        variant_count: String(variantCount),
        journal_entry_count: String(jeCount),
        flag_status: flagCount > 0 ? `${flagCount} open` : "clear",
        sheet_verified: asset.google_sheet_status === "verified" ? "Yes" : "No",
        student_id_placeholder: "",
        session_audio_link: "",
        session_transcript_link: "",
      };

      // Ensure METADATA tab exists
      try {
        await googleFetch(
          `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/METADATA!A1?majorDimension=ROWS`,
          token
        );
      } catch {
        try {
          await googleFetch(`${GOOGLE_SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
            method: "POST",
            body: JSON.stringify({
              requests: [{ addSheet: { properties: { title: "METADATA" } } }],
            }),
          });
        } catch (e) { console.error("METADATA tab creation failed:", e); }
      }

      try {
        await googleFetch(
          `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/METADATA:clear`,
          token,
          { method: "POST", body: JSON.stringify({}) }
        );
      } catch (e) { console.error("Metadata clear failed (non-fatal):", e); }

      await writeMetadata(token, spreadsheetId, metadataParams);
      console.log("Metadata populated on Master sheet");
    }

    // ── Persist sheet info back to DB ─────────────────────────────────
    const dbPayload: Record<string, any> = {
      google_sheet_url: masterUrl,
      google_sheet_file_id: results.master?.fileId || asset.google_sheet_file_id || "",
      sheet_last_synced_at: new Date().toISOString(),
      google_sheet_status: "auto_created",
      sheet_master_url: masterUrl,
      sheet_practice_url: practiceUrl,
      sheet_promo_url: promoUrl,
      sheet_path_url: sheetPathUrl,
    };

    const dbRes = await fetch(`${supabaseUrl}/rest/v1/teaching_assets?id=eq.${asset_id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(dbPayload),
    });

    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error("DB update failed:", dbErr);
      throw new Error(`Failed to persist sheet metadata: ${dbErr}`);
    }
    await dbRes.text();

    return new Response(JSON.stringify({
      success: true,
      sheet_master_url: masterUrl,
      sheet_practice_url: practiceUrl,
      sheet_promo_url: promoUrl,
      sheet_path_url: sheetPathUrl,
      sheet_url: masterUrl,
      spreadsheet_id: results.master?.fileId || "",
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("create-asset-sheet error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    const httpStatus = err.googleCode && err.googleCode >= 400 && err.googleCode < 500 ? err.googleCode : 500;
    return new Response(JSON.stringify({ error: msg, google_status: err.googleStatus ?? null }), {
      status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
