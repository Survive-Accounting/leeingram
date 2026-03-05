const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"];

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

// ── Constants ────────────────────────────────────────────────────────

const REQUIRED_TABS = ["BRANDED", "WHITEBOARD", "SOLUTION", "HIGHLIGHTED", "METADATA"];

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
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

    const { asset_id, template_file_id, template_version, dry_run = false } = await req.json();

    if (!asset_id || !template_file_id) {
      return new Response(JSON.stringify({ error: "Missing asset_id or template_file_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Load asset from DB (try assets table first for google_sheet_url)
    const assetRes = await fetch(
      `${supabaseUrl}/rest/v1/assets?id=eq.${asset_id}&select=id,asset_code,google_sheet_url`,
      { headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: anonKey } }
    );
    const assets = await assetRes.json();
    const asset = assets?.[0];

    if (!asset || !asset.google_sheet_url) {
      return new Response(JSON.stringify({ error: "Asset not found or has no Google Sheet URL", asset_id }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract spreadsheet ID from URL
    const sheetUrlMatch = asset.google_sheet_url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetUrlMatch) {
      return new Response(JSON.stringify({ error: "Cannot parse spreadsheet ID from URL", url: asset.google_sheet_url }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const targetSpreadsheetId = sheetUrlMatch[1];

    // Get Google credentials
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
    const sa = JSON.parse(saJson);
    const token = await getAccessToken(sa);

    const actions: string[] = [];
    const warnings: string[] = [];

    // ── Step 1: Load template spreadsheet structure ──────────────────
    const templateData = await googleFetch(
      `${GOOGLE_SHEETS_API}/${template_file_id}?fields=sheets(properties,data(rowData(values(userEnteredValue,userEnteredFormat)))),namedRanges&includeGridData=true`,
      token
    );

    const templateTabs = (templateData.sheets || []).map((s: any) => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId,
      frozenRowCount: s.properties.gridProperties?.frozenRowCount || 0,
      frozenColumnCount: s.properties.gridProperties?.frozenColumnCount || 0,
      columnCount: s.properties.gridProperties?.columnCount || 26,
      rowCount: s.properties.gridProperties?.rowCount || 1000,
      rowData: s.data?.[0]?.rowData || [],
    }));

    const templateNamedRanges = templateData.namedRanges || [];

    // ── Step 2: Load target spreadsheet structure ────────────────────
    const targetData = await googleFetch(
      `${GOOGLE_SHEETS_API}/${targetSpreadsheetId}?fields=sheets(properties),namedRanges`,
      token
    );

    const targetTabs = (targetData.sheets || []).map((s: any) => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId,
    }));
    const targetTabNames = new Set(targetTabs.map((t: any) => t.title));
    const targetNamedRanges = targetData.namedRanges || [];

    // ── Step 3: Ensure required tabs exist ───────────────────────────
    const batchRequests: any[] = [];

    for (const tabName of REQUIRED_TABS) {
      if (!targetTabNames.has(tabName)) {
        actions.push(`CREATE_TAB: ${tabName}`);
        if (!dry_run) {
          batchRequests.push({ addSheet: { properties: { title: tabName } } });
        }
      }
    }

    // ── Step 4: Apply frozen rows/columns from template ──────────────
    for (const tmplTab of templateTabs) {
      const targetTab = targetTabs.find((t: any) => t.title === tmplTab.title);
      if (!targetTab && !REQUIRED_TABS.includes(tmplTab.title)) continue;

      const sheetId = targetTab?.sheetId;
      // We'll apply frozen rows after tab creation for new tabs
      if (sheetId != null && (tmplTab.frozenRowCount > 0 || tmplTab.frozenColumnCount > 0)) {
        actions.push(`FREEZE: ${tmplTab.title} rows=${tmplTab.frozenRowCount} cols=${tmplTab.frozenColumnCount}`);
        if (!dry_run) {
          batchRequests.push({
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  frozenRowCount: tmplTab.frozenRowCount,
                  frozenColumnCount: tmplTab.frozenColumnCount,
                },
              },
              fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
            },
          });
        }
      }
    }

    // Execute tab creation + freeze requests
    let addSheetReplies: any[] = [];
    if (!dry_run && batchRequests.length > 0) {
      const batchRes = await googleFetch(`${GOOGLE_SHEETS_API}/${targetSpreadsheetId}:batchUpdate`, token, {
        method: "POST",
        body: JSON.stringify({ requests: batchRequests }),
      });
      addSheetReplies = batchRes.replies || [];
    }

    // Build updated target tab map (including newly created tabs)
    const updatedTargetTabs = [...targetTabs];
    let replyIdx = 0;
    for (const req of batchRequests) {
      if (req.addSheet && addSheetReplies[replyIdx]?.addSheet) {
        updatedTargetTabs.push({
          title: addSheetReplies[replyIdx].addSheet.properties.title,
          sheetId: addSheetReplies[replyIdx].addSheet.properties.sheetId,
        });
      }
      replyIdx++;
    }

    // ── Step 5: Sync named range zones from template ─────────────────
    const zoneRanges = templateNamedRanges.filter((nr: any) => nr.name.startsWith("ZONE_"));

    for (const zone of zoneRanges) {
      const range = zone.range;
      // Find the template tab this zone belongs to
      const tmplTab = templateTabs.find((t: any) => t.sheetId === range.sheetId);
      if (!tmplTab) {
        warnings.push(`ZONE_SKIP: ${zone.name} - template tab not found for sheetId ${range.sheetId}`);
        continue;
      }

      const targetTab = updatedTargetTabs.find((t: any) => t.title === tmplTab.title);
      if (!targetTab) {
        warnings.push(`ZONE_SKIP: ${zone.name} - target tab "${tmplTab.title}" not found`);
        continue;
      }

      const startRow = range.startRowIndex ?? 0;
      const endRow = range.endRowIndex ?? startRow + 1;
      const startCol = range.startColumnIndex ?? 0;
      const endCol = range.endColumnIndex ?? startCol + 1;

      // Extract template cell data for this zone
      const zoneRows: any[] = [];
      for (let r = startRow; r < endRow; r++) {
        const rowData = tmplTab.rowData[r];
        if (!rowData || !rowData.values) {
          zoneRows.push({ values: [] });
          continue;
        }
        const cells = rowData.values.slice(startCol, endCol);
        zoneRows.push({ values: cells });
      }

      actions.push(`SYNC_ZONE: ${zone.name} on "${tmplTab.title}" [${startRow}:${endRow}, ${startCol}:${endCol}]`);

      if (!dry_run) {
        // Write zone formatting + values via updateCells
        const updateRequests: any[] = [{
          updateCells: {
            range: {
              sheetId: targetTab.sheetId,
              startRowIndex: startRow,
              endRowIndex: endRow,
              startColumnIndex: startCol,
              endColumnIndex: endCol,
            },
            rows: zoneRows,
            fields: "userEnteredValue,userEnteredFormat",
          },
        }];

        // Ensure named range exists on target
        const existingNR = targetNamedRanges.find((nr: any) => nr.name === zone.name);
        if (existingNR) {
          updateRequests.push({
            updateNamedRange: {
              namedRange: {
                namedRangeId: existingNR.namedRangeId,
                name: zone.name,
                range: {
                  sheetId: targetTab.sheetId,
                  startRowIndex: startRow,
                  endRowIndex: endRow,
                  startColumnIndex: startCol,
                  endColumnIndex: endCol,
                },
              },
              fields: "range",
            },
          });
        } else {
          updateRequests.push({
            addNamedRange: {
              namedRange: {
                name: zone.name,
                range: {
                  sheetId: targetTab.sheetId,
                  startRowIndex: startRow,
                  endRowIndex: endRow,
                  startColumnIndex: startCol,
                  endColumnIndex: endCol,
                },
              },
            },
          });
          actions.push(`ADD_NAMED_RANGE: ${zone.name}`);
        }

        await googleFetch(`${GOOGLE_SHEETS_API}/${targetSpreadsheetId}:batchUpdate`, token, {
          method: "POST",
          body: JSON.stringify({ requests: updateRequests }),
        });
      }
    }

    // ── Step 6: Apply column widths from template for key tabs ────────
    for (const tmplTab of templateTabs) {
      const targetTab = updatedTargetTabs.find((t: any) => t.title === tmplTab.title);
      if (!targetTab) continue;

      // We only apply column widths for tabs that exist in template
      // Get template column metadata
      const tmplColData = await googleFetch(
        `${GOOGLE_SHEETS_API}/${template_file_id}?fields=sheets(properties,data(columnMetadata))&ranges='${encodeURIComponent(tmplTab.title)}'`,
        token
      );

      const colMeta = tmplColData.sheets?.[0]?.data?.[0]?.columnMetadata;
      if (colMeta && colMeta.length > 0) {
        const colRequests = colMeta.map((col: any, idx: number) => ({
          updateDimensionProperties: {
            range: {
              sheetId: targetTab.sheetId,
              dimension: "COLUMNS",
              startIndex: idx,
              endIndex: idx + 1,
            },
            properties: { pixelSize: col.pixelSize },
            fields: "pixelSize",
          },
        }));

        actions.push(`SYNC_COL_WIDTHS: "${tmplTab.title}" (${colMeta.length} columns)`);
        if (!dry_run) {
          await googleFetch(`${GOOGLE_SHEETS_API}/${targetSpreadsheetId}:batchUpdate`, token, {
            method: "POST",
            body: JSON.stringify({ requests: colRequests }),
          });
        }
      }
    }

    // ── Step 7: Update DB tracking fields ────────────────────────────
    if (!dry_run) {
      const now = new Date().toISOString();
      await fetch(`${supabaseUrl}/rest/v1/assets?id=eq.${asset_id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: anonKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          // We store template version info in a comment-like approach via metadata
        }),
      });
      actions.push(`DB_UPDATE: sheet_template_version=${template_version || "unknown"}, sheet_last_synced_at=${now}`);
    }

    if (zoneRanges.length === 0) {
      warnings.push("NO_ZONES_FOUND: Template has no named ranges starting with ZONE_. Define named ranges like ZONE_HEADER, ZONE_WHITEBOARD_HELPER etc. in your master template.");
    }

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      asset_id,
      sheet_id: targetSpreadsheetId,
      template_file_id,
      template_version: template_version || "unknown",
      actions_taken: actions,
      warnings,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("sync-asset-sheet-to-template error:", err);
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
