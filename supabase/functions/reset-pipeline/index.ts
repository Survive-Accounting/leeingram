import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPES = ["https://www.googleapis.com/auth/drive"];
const ROOT_FOLDER_ID = "1Lu00SDbRHDxlMqAu_sa0aZbSw_HHfSbx";
const ARCHIVE_FOLDER_NAME = "Archive";

// ── Google Auth ──
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

async function googleFetch(url: string, token: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { rawBody: text }; }
  if (!res.ok) throw new Error(`Google API ${res.status}: ${data?.error?.message ?? text}`);
  return data;
}

// ── Drive helpers ──
async function findOrCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false and '${parentId}' in parents`;
  const searchData = await googleFetch(
    `${GOOGLE_DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    token
  );
  if (searchData.files?.length) return searchData.files[0].id;
  const createData = await googleFetch(`${GOOGLE_DRIVE_API}?supportsAllDrives=true`, token, {
    method: "POST",
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  return createData.id;
}

async function moveFileToArchive(token: string, fileId: string, chapterFolderId: string, archiveFolderId: string) {
  const params = new URLSearchParams({ supportsAllDrives: "true", addParents: archiveFolderId, removeParents: chapterFolderId });
  await googleFetch(`${GOOGLE_DRIVE_API}/${fileId}?${params.toString()}`, token, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

async function listAllSheetsInFolder(token: string, folderId: string): Promise<{ id: string; name: string }[]> {
  const allFiles: { id: string; name: string }[] = [];
  let pageToken = "";
  do {
    const q = `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and '${folderId}' in parents`;
    let url = `${GOOGLE_DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name),nextPageToken&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const data = await googleFetch(url, token);
    allFiles.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return allFiles;
}

async function listCourseFolders(token: string): Promise<{ id: string; name: string }[]> {
  const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and '${ROOT_FOLDER_ID}' in parents`;
  const data = await googleFetch(
    `${GOOGLE_DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    token
  );
  return data.files || [];
}

async function listChapterFolders(token: string, courseFolderId: string): Promise<{ id: string; name: string }[]> {
  const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and '${courseFolderId}' in parents and name contains 'Chapter'`;
  const data = await googleFetch(
    `${GOOGLE_DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    token
  );
  return data.files || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, dry_run = true, archive_drive_sheets = false } = await req.json();

    if (password !== "Stax420!#") {
      return new Response(JSON.stringify({ error: "Invalid password" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // ── Gather counts ──
    const { count: variantsActive } = await sb
      .from("problem_variants")
      .select("*", { count: "exact", head: true })
      .neq("variant_status", "archived");

    const { count: assetsTotal } = await sb
      .from("teaching_assets")
      .select("*", { count: "exact", head: true });

    const { count: assetsWithSheets } = await sb
      .from("teaching_assets")
      .select("*", { count: "exact", head: true })
      .or("google_sheet_url.not.is.null,sheet_master_url.not.is.null");

    const { count: problemsBeyondImport } = await sb
      .from("chapter_problems")
      .select("*", { count: "exact", head: true })
      .neq("pipeline_status", "imported");

    // Count Drive sheets if requested
    let driveSheetCount = 0;
    if (archive_drive_sheets) {
      try {
        const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
        if (saJson) {
          const sa = JSON.parse(saJson);
          const token = await getAccessToken(sa);
          const courseFolders = await listCourseFolders(token);
          for (const cf of courseFolders) {
            const chapterFolders = await listChapterFolders(token, cf.id);
            for (const chf of chapterFolders) {
              if (chf.name === ARCHIVE_FOLDER_NAME) continue;
              const sheets = await listAllSheetsInFolder(token, chf.id);
              driveSheetCount += sheets.length;
            }
          }
        }
      } catch (e) {
        console.error("Error counting Drive sheets:", e);
      }
    }

    const summary = {
      variants_to_archive: variantsActive ?? 0,
      teaching_assets_to_archive: assetsTotal ?? 0,
      sheet_links_to_clear: assetsWithSheets ?? 0,
      source_problems_to_reset: problemsBeyondImport ?? 0,
      drive_sheets_to_archive: archive_drive_sheets ? driveSheetCount : 0,
    };

    if (dry_run) {
      return new Response(
        JSON.stringify({ dry_run: true, summary }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Execute reset ──
    const errors: string[] = [];

    // 1. Archive active variants
    const { error: e1 } = await sb
      .from("problem_variants")
      .update({ variant_status: "archived" })
      .neq("variant_status", "archived");
    if (e1) errors.push(`Archive variants: ${e1.message}`);

    // 2. Archive teaching assets (clear sheet URLs, mark as archived)
    const { error: e2 } = await sb
      .from("teaching_assets")
      .update({
        google_sheet_status: "archived",
        google_sheet_url: null,
        google_sheet_file_id: null,
        sheet_master_url: null,
        sheet_practice_url: null,
        sheet_promo_url: null,
        sheet_path_url: null,
        sheet_last_synced_at: null,
        sheet_template_version: null,
      })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (e2) errors.push(`Archive teaching assets: ${e2.message}`);

    // 3. Reset chapter_problems pipeline_status back to 'imported'
    const { error: e3 } = await sb
      .from("chapter_problems")
      .update({ pipeline_status: "imported" })
      .neq("pipeline_status", "imported");
    if (e3) errors.push(`Reset pipeline status: ${e3.message}`);

    // 4. Archive Google Drive sheets if requested
    let driveArchived = 0;
    if (archive_drive_sheets) {
      try {
        const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
        if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
        const sa = JSON.parse(saJson);
        const token = await getAccessToken(sa);
        const courseFolders = await listCourseFolders(token);

        for (const cf of courseFolders) {
          const chapterFolders = await listChapterFolders(token, cf.id);
          for (const chf of chapterFolders) {
            if (chf.name === ARCHIVE_FOLDER_NAME) continue;
            const sheets = await listAllSheetsInFolder(token, chf.id);
            if (sheets.length === 0) continue;

            const archiveFolderId = await findOrCreateFolder(token, ARCHIVE_FOLDER_NAME, chf.id);
            for (const sheet of sheets) {
              try {
                await moveFileToArchive(token, sheet.id, chf.id, archiveFolderId);
                driveArchived++;
                console.log(`Archived Drive sheet: ${sheet.name} (${sheet.id}) → ${chf.name}/Archive`);
              } catch (e) {
                console.error(`Failed to archive ${sheet.name}: ${e}`);
                errors.push(`Drive archive ${sheet.name}: ${e}`);
              }
            }
          }
        }
      } catch (e) {
        errors.push(`Drive archive: ${e}`);
      }
    }

    // 5. Log the reset event
    const { error: e4 } = await sb.from("activity_log").insert({
      entity_id: "00000000-0000-0000-0000-000000000000",
      entity_type: "system",
      event_type: "pipeline_reset",
      message: `Pipeline Reset Performed. Archived ${summary.variants_to_archive} variants, ${summary.teaching_assets_to_archive} teaching assets, cleared ${summary.sheet_links_to_clear} sheet links, reset ${summary.source_problems_to_reset} source problems.${archive_drive_sheets ? ` Archived ${driveArchived} Drive sheets.` : ""}`,
      severity: "warn",
      payload_json: { ...summary, drive_sheets_archived: driveArchived },
    });
    if (e4) errors.push(`Log entry: ${e4.message}`);

    return new Response(
      JSON.stringify({
        dry_run: false,
        summary: { ...summary, drive_sheets_archived: driveArchived },
        errors: errors.length ? errors : null,
        success: errors.length === 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
