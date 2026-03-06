const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"];

const ROOT_FOLDER_ID = "1Lu00SDbRHDxlMqAu_sa0aZbSw_HHfSbx";
const ARCHIVE_FOLDER_NAME = "_ARCHIVE_DUPLICATES";
const REQUIRED_TABS = ["BRANDED", "WHITEBOARD", "SOLUTION", "HIGHLIGHTED", "METADATA"];

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

// ── Google API helpers ───────────────────────────────────────────────

async function googleFetch(url: string, token: string, opts: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) {
    const ge = data?.error;
    const code = ge?.code ?? res.status;
    const status = ge?.status ?? "UNKNOWN";
    const message = ge?.message ?? JSON.stringify(data);
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

type DriveSheetFile = {
  id: string;
  name: string;
  parents?: string[];
  modifiedTime?: string;
};

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

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
  const params = new URLSearchParams({
    supportsAllDrives: "true",
    addParents: addParentId,
  });

  if (removeParentIds.length > 0) {
    params.set("removeParents", removeParentIds.join(","));
  }

  await googleFetch(`${GOOGLE_DRIVE_API}/${fileId}?${params.toString()}`, token, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

async function archiveDuplicateSheets(token: string, duplicates: DriveSheetFile[], chapterFolderId: string) {
  if (duplicates.length === 0) return;

  const archiveFolderId = await findOrCreateFolder(token, ARCHIVE_FOLDER_NAME, chapterFolderId);
  for (const duplicate of duplicates) {
    const removeParents = duplicate.parents?.length ? duplicate.parents : [chapterFolderId];
    try {
      await moveFileToFolder(token, duplicate.id, archiveFolderId, removeParents);
      console.log(`Archived duplicate sheet ${duplicate.id} -> ${archiveFolderId}`);
    } catch (e) {
      console.error(`Failed to archive duplicate sheet ${duplicate.id} (non-fatal):`, e);
    }
  }
}

async function ensureFolderHierarchy(
  token: string,
  courseCode: string,
  chapterNumber: string | number,
  serviceAccountEmail: string
): Promise<{ courseFolderId: string; chapterFolderId: string }> {
  try {
    await googleFetch(`${GOOGLE_DRIVE_API}/${ROOT_FOLDER_ID}?fields=id,name&supportsAllDrives=true`, token);
  } catch (e) {
    throw new Error(
      `Cannot access shared root folder ${ROOT_FOLDER_ID}. ` +
      `Make sure it is shared with the service account: ${serviceAccountEmail}`
    );
  }

  const courseFolderId = await findOrCreateFolder(token, courseCode, ROOT_FOLDER_ID);
  const chapterLabel = `Chapter ${String(chapterNumber).padStart(2, "0")}`;
  const chapterFolderId = await findOrCreateFolder(token, chapterLabel, courseFolderId);
  return { courseFolderId, chapterFolderId };
}

// ── Sheet tab helpers ────────────────────────────────────────────────

async function ensureTabsExist(token: string, spreadsheetId: string): Promise<Record<string, number>> {
  const meta = await googleFetch(`${GOOGLE_SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, token);
  const existing: Record<string, number> = {};
  for (const s of meta.sheets || []) {
    existing[s.properties.title] = s.properties.sheetId;
  }

  const missing = REQUIRED_TABS.filter(t => !(t in existing));
  if (missing.length > 0) {
    const addRequests = missing.map(title => ({ addSheet: { properties: { title } } }));
    const batchRes = await googleFetch(`${GOOGLE_SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
      method: "POST",
      body: JSON.stringify({ requests: addRequests }),
    });
    for (const reply of (batchRes.replies || [])) {
      if (reply.addSheet?.properties) {
        existing[reply.addSheet.properties.title] = reply.addSheet.properties.sheetId;
      }
    }
  }

  return existing;
}

async function clearTab(token: string, spreadsheetId: string, tabName: string) {
  try {
    await googleFetch(
      `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/${tabName}?valueInputOption=RAW`,
      token,
      { method: "PUT", body: JSON.stringify({ range: tabName, values: [[""]] }) }
    );
    // Clear the whole sheet content
    await googleFetch(
      `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/${tabName}:clear`,
      token,
      { method: "POST", body: JSON.stringify({}) }
    );
  } catch (e) {
    console.error(`clearTab ${tabName} failed (non-fatal):`, e);
  }
}

async function writeMetadata(token: string, spreadsheetId: string, sheetUrl: string, params: any) {
  const { asset_code, course_code, chapter_number, exercise_code, difficulty_estimate, asset_id, created_at } = params;
  const metadataValues = [
    ["Field", "Value"],
    ["asset_code", asset_code],
    ["course_code", course_code],
    ["chapter_number", String(chapter_number)],
    ["exercise_number", exercise_code || ""],
    ["difficulty_estimate", String(difficulty_estimate ?? "")],
    ["asset_id", asset_id],
    ["created_at", created_at || ""],
    ["sheet_url", sheetUrl],
  ];
  await googleFetch(
    `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/METADATA!A1:B9?valueInputOption=RAW`,
    token,
    { method: "PUT", body: JSON.stringify({ range: "METADATA!A1:B9", majorDimension: "ROWS", values: metadataValues }) }
  );
}

async function writeHighlights(token: string, spreadsheetId: string, tabSheetIds: Record<string, number>, problem_text: string, highlight_key_json: any[]) {
  // Write problem text in A1
  await googleFetch(
    `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/HIGHLIGHTED!A1?valueInputOption=RAW`,
    token,
    { method: "PUT", body: JSON.stringify({ range: "HIGHLIGHTED!A1", values: [[problem_text]] }) }
  );

  // Write highlight legend starting at A3
  const legendValues = [
    ["Highlighted Text", "Type"],
    ...highlight_key_json.map((h: any) => [h.text || "", h.type || ""]),
  ];
  await googleFetch(
    `${GOOGLE_SHEETS_API}/${spreadsheetId}/values/HIGHLIGHTED!A3:B${3 + legendValues.length - 1}?valueInputOption=RAW`,
    token,
    { method: "PUT", body: JSON.stringify({ range: `HIGHLIGHTED!A3:B${3 + legendValues.length - 1}`, majorDimension: "ROWS", values: legendValues }) }
  );

  // Apply yellow background to highlighted text cells
  const highlightedSheetId = tabSheetIds["HIGHLIGHTED"];
  if (highlightedSheetId != null) {
    const requests = highlight_key_json.map((_: any, i: number) => ({
      repeatCell: {
        range: { sheetId: highlightedSheetId, startRowIndex: 3 + i, endRowIndex: 4 + i, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.96, blue: 0.616 } } },
        fields: "userEnteredFormat.backgroundColor",
      },
    }));
    await googleFetch(`${GOOGLE_SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: accept service-role or anon with valid JWT
    const authHeader = req.headers.get("Authorization") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

    const {
      asset_id, asset_code, course_code, chapter_number, exercise_code,
      difficulty_estimate, created_at, problem_text, highlight_key_json,
      existing_file_id, force_new_copy,
    } = await req.json();

    if (!asset_id || !asset_code || !course_code || !chapter_number) {
      return new Response(JSON.stringify({ error: "Missing required fields: asset_id, asset_code, course_code, chapter_number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google credentials
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    let spreadsheetId: string;
    let sheetUrl: string;
    let isUpdate = false;

    let resolvedCourseFolderId: string | null = null;
    let resolvedChapterFolderId: string | null = null;

    const getFolderHierarchy = async () => {
      if (resolvedCourseFolderId && resolvedChapterFolderId) {
        return {
          courseFolderId: resolvedCourseFolderId,
          chapterFolderId: resolvedChapterFolderId,
        };
      }

      const folders = await ensureFolderHierarchy(token, course_code, chapter_number, sa.client_email);
      resolvedCourseFolderId = folders.courseFolderId;
      resolvedChapterFolderId = folders.chapterFolderId;
      return folders;
    };

    let candidateExistingFileId: string | null = existing_file_id || null;

    // ── UPSERT LOGIC ─────────────────────────────────────────────────
    // If DB metadata wasn't persisted previously, recover by name in the chapter folder.
    if (!candidateExistingFileId && !force_new_copy) {
      try {
        const { chapterFolderId } = await getFolderHierarchy();
        const matchingSheets = await findSheetsByNameInFolder(token, asset_code, chapterFolderId);

        if (matchingSheets.length > 0) {
          candidateExistingFileId = matchingSheets[0].id;
          console.log(`Recovered existing sheet by name for ${asset_code}: ${candidateExistingFileId}`);

          if (matchingSheets.length > 1) {
            await archiveDuplicateSheets(token, matchingSheets.slice(1), chapterFolderId);
          }
        }
      } catch (e) {
        console.error("Name-based sheet recovery failed (non-fatal):", e);
      }
    }

    if (candidateExistingFileId && !force_new_copy) {
      // UPDATE path: reuse existing spreadsheet
      isUpdate = true;
      spreadsheetId = candidateExistingFileId;
      sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      // Verify the file still exists / is accessible
      try {
        await googleFetch(`${GOOGLE_DRIVE_API}/${spreadsheetId}?fields=id,name&supportsAllDrives=true`, token);
      } catch (e: any) {
        console.error("Existing sheet not accessible, will create new:", e.message);
        // Fall through to create path
        isUpdate = false;
        candidateExistingFileId = null;
      }

      if (isUpdate) {
        // Ensure all required tabs exist
        const tabSheetIds = await ensureTabsExist(token, spreadsheetId);

        // Rename file if asset_code changed
        try {
          await googleFetch(`${GOOGLE_DRIVE_API}/${spreadsheetId}?supportsAllDrives=true`, token, {
            method: "PATCH",
            body: JSON.stringify({ name: asset_code }),
          });
        } catch (e) {
          console.error("Rename failed (non-fatal):", e);
        }

        // Clear and rewrite METADATA
        await clearTab(token, spreadsheetId, "METADATA");
        try {
          await writeMetadata(token, spreadsheetId, sheetUrl, {
            asset_code, course_code, chapter_number, exercise_code, difficulty_estimate, asset_id, created_at,
          });
        } catch (e) { console.error("Metadata write failed (non-fatal):", e); }

        // Clear and rewrite HIGHLIGHTED
        await clearTab(token, spreadsheetId, "HIGHLIGHTED");
        if (problem_text && Array.isArray(highlight_key_json) && highlight_key_json.length > 0) {
          try {
            await writeHighlights(token, spreadsheetId, tabSheetIds, problem_text, highlight_key_json);
          } catch (e) { console.error("Highlight write failed (non-fatal):", e); }
        }

        // Clear content tabs (BRANDED, WHITEBOARD, SOLUTION) for fresh population
        for (const tab of ["BRANDED", "WHITEBOARD", "SOLUTION"]) {
          await clearTab(token, spreadsheetId, tab);
        }
      }
    }

    if (!isUpdate) {
      // CREATE path: new spreadsheet
      const { chapterFolderId } = await getFolderHierarchy();

      const driveFile = await googleFetch(`${GOOGLE_DRIVE_API}?supportsAllDrives=true`, token, {
        method: "POST",
        body: JSON.stringify({
          name: asset_code,
          mimeType: "application/vnd.google-apps.spreadsheet",
          parents: [chapterFolderId],
        }),
      });

      spreadsheetId = driveFile.id;
      sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      // Rename default "Sheet1" and add remaining tabs
      const defaultSheet = await googleFetch(`${GOOGLE_SHEETS_API}/${spreadsheetId}?fields=sheets.properties`, token);
      const defaultSheetId = defaultSheet.sheets?.[0]?.properties?.sheetId ?? 0;

      const tabRequests = [
        { updateSheetProperties: { properties: { sheetId: defaultSheetId, title: "BRANDED" }, fields: "title" } },
        { addSheet: { properties: { title: "WHITEBOARD" } } },
        { addSheet: { properties: { title: "SOLUTION" } } },
        { addSheet: { properties: { title: "HIGHLIGHTED" } } },
        { addSheet: { properties: { title: "METADATA" } } },
      ];

      const batchRes = await googleFetch(`${GOOGLE_SHEETS_API}/${spreadsheetId}:batchUpdate`, token, {
        method: "POST",
        body: JSON.stringify({ requests: tabRequests }),
      });

      // Build tab sheet ID map
      const tabSheetIds: Record<string, number> = { BRANDED: defaultSheetId };
      for (const reply of (batchRes.replies || [])) {
        if (reply.addSheet?.properties) {
          tabSheetIds[reply.addSheet.properties.title] = reply.addSheet.properties.sheetId;
        }
      }

      // Populate METADATA
      try {
        await writeMetadata(token, spreadsheetId, sheetUrl, {
          asset_code, course_code, chapter_number, exercise_code, difficulty_estimate, asset_id, created_at,
        });
      } catch (e) { console.error("Metadata write failed (non-fatal):", e); }

      // Populate HIGHLIGHTED
      if (problem_text && Array.isArray(highlight_key_json) && highlight_key_json.length > 0) {
        try {
          await writeHighlights(token, spreadsheetId, tabSheetIds, problem_text, highlight_key_json);
        } catch (e) { console.error("Highlight write failed (non-fatal):", e); }
      }
    }

    // Update teaching_assets in DB with sheet URL, file ID, and sync timestamp
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // Use caller's auth header — teaching_assets RLS allows any authenticated user to update
    const dbAuthHeader = authHeader;

    const dbRes = await fetch(`${supabaseUrl}/rest/v1/teaching_assets?id=eq.${asset_id}`, {
      method: "PATCH",
      headers: {
        Authorization: dbAuthHeader,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        google_sheet_url: sheetUrl,
        google_sheet_file_id: spreadsheetId,
        sheet_last_synced_at: new Date().toISOString(),
      }),
    });

    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error("DB update failed:", dbErr);
      throw new Error(`Failed to persist sheet metadata for asset ${asset_id}: ${dbErr}`);
    }

    await dbRes.text();

    return new Response(JSON.stringify({
      success: true,
      sheet_url: sheetUrl,
      spreadsheet_id: spreadsheetId,
      is_update: isUpdate,
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
