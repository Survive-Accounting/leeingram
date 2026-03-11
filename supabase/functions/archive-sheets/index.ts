import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  if (!res.ok) {
    const ge = data?.error;
    throw new Error(`Google API ${ge?.code ?? res.status}: ${ge?.message ?? text}`);
  }
  return data;
}

async function findOrCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false and '${parentId}' in parents`;
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
      parents: [parentId],
    }),
  });
  return createData.id;
}

function extractFileIdFromUrl(url: string): string | null {
  // Match /d/{id}/ or /spreadsheets/d/{id}/
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function moveFileToFolder(token: string, fileId: string, archiveFolderId: string) {
  // Get current parents
  const meta = await googleFetch(
    `${GOOGLE_DRIVE_API}/${fileId}?fields=parents&supportsAllDrives=true`,
    token
  );
  const removeParents = (meta.parents || []).join(",");
  const params = new URLSearchParams({
    supportsAllDrives: "true",
    addParents: archiveFolderId,
    ...(removeParents ? { removeParents } : {}),
  });
  await googleFetch(`${GOOGLE_DRIVE_API}/${fileId}?${params.toString()}`, token, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { teaching_asset_ids, sheet_prep_log_ids } = await req.json();
    if (!Array.isArray(teaching_asset_ids) || teaching_asset_ids.length === 0) {
      throw new Error("teaching_asset_ids[] required");
    }

    // Get Google credentials
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    // Fetch the teaching assets
    const { data: assets, error: aErr } = await sb.from("teaching_assets")
      .select("id, asset_name, chapter_id, course_id, sheet_master_url, sheet_practice_url, sheet_promo_url, google_sheet_url")
      .in("id", teaching_asset_ids);
    if (aErr) throw aErr;
    if (!assets || assets.length === 0) throw new Error("No assets found");

    // Get chapter + course info for folder hierarchy
    const chapterIds = [...new Set(assets.map(a => a.chapter_id))];
    const courseIds = [...new Set(assets.map(a => a.course_id))];

    const { data: chapters } = await sb.from("chapters").select("id, chapter_number").in("id", chapterIds);
    const { data: courses } = await sb.from("courses").select("id, code").in("id", courseIds);

    const chapterMap = new Map((chapters || []).map(c => [c.id, c]));
    const courseMap = new Map((courses || []).map(c => [c.id, c]));

    // Cache for archive folder IDs per chapter
    const archiveFolderCache = new Map<string, string>();

    let archivedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const asset of assets) {
      const chapter = chapterMap.get(asset.chapter_id);
      const course = courseMap.get(asset.course_id);
      if (!chapter || !course) {
        errors.push(`${asset.asset_name}: missing chapter/course data`);
        failedCount++;
        continue;
      }

      // Collect all sheet URLs for this asset
      const sheetUrls = [
        asset.sheet_master_url,
        asset.sheet_practice_url,
        asset.sheet_promo_url,
        asset.google_sheet_url,
      ].filter(Boolean) as string[];

      const fileIds = sheetUrls
        .map(url => extractFileIdFromUrl(url))
        .filter(Boolean) as string[];

      // Deduplicate
      const uniqueFileIds = [...new Set(fileIds)];

      if (uniqueFileIds.length === 0) {
        // No sheets to archive, just mark as archived in DB
        await sb.from("teaching_assets")
          .update({ google_sheet_status: "archived" })
          .eq("id", asset.id);
        archivedCount++;
        continue;
      }

      // Find or create the archive folder for this chapter
      const cacheKey = `${course.code}_${chapter.chapter_number}`;
      let archiveFolderId = archiveFolderCache.get(cacheKey);

      if (!archiveFolderId) {
        try {
          const courseCode = course.code || "COURSE";
          const courseFolderId = await findOrCreateFolder(token, courseCode, ROOT_FOLDER_ID);
          const chapterLabel = `Chapter ${String(chapter.chapter_number).padStart(2, "0")}`;
          const chapterFolderId = await findOrCreateFolder(token, chapterLabel, courseFolderId);
          archiveFolderId = await findOrCreateFolder(token, ARCHIVE_FOLDER_NAME, chapterFolderId);
          archiveFolderCache.set(cacheKey, archiveFolderId);
        } catch (e) {
          errors.push(`${asset.asset_name}: Failed to find/create archive folder: ${e.message}`);
          failedCount++;
          continue;
        }
      }

      // Move each sheet to archive
      let assetFailed = false;
      for (const fileId of uniqueFileIds) {
        try {
          await moveFileToFolder(token, fileId, archiveFolderId);
        } catch (e) {
          errors.push(`${asset.asset_name}: Failed to archive sheet ${fileId}: ${e.message}`);
          assetFailed = true;
        }
      }

      // Update teaching asset: mark as archived, clear sheet URLs
      await sb.from("teaching_assets")
        .update({
          google_sheet_status: "archived",
          sheet_master_url: null,
          sheet_practice_url: null,
          sheet_promo_url: null,
          google_sheet_url: null,
        })
        .eq("id", asset.id);

      if (assetFailed) failedCount++;
      else archivedCount++;
    }

    // Mark sheet prep log entries as reviewed + archived
    if (Array.isArray(sheet_prep_log_ids) && sheet_prep_log_ids.length > 0) {
      await sb.from("sheet_prep_log")
        .update({ reviewed: true, reviewed_at: new Date().toISOString(), archived: true })
        .in("id", sheet_prep_log_ids);
    }

    return new Response(JSON.stringify({
      success: true,
      archived: archivedCount,
      failed: failedCount,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("archive-sheets error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
