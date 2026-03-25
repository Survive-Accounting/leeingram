import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Google Drive helpers ───────────────────────────────────────

function base64url(input: Uint8Array): string {
  let s = "";
  for (const b of input) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/drive.file",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    )
  );
  const signingInput = `${header}.${payload}`;

  // Import RSA private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(new Uint8Array(sig))}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!resp.ok) throw new Error(`Google token error: ${await resp.text()}`);
  const data = await resp.json();
  return data.access_token;
}

async function createDriveFolder(token: string, name: string, parentId: string): Promise<string> {
  const resp = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!resp.ok) throw new Error(`Create folder error: ${await resp.text()}`);
  const data = await resp.json();
  return data.id;
}

async function uploadFile(token: string, name: string, parentId: string, content: string, mimeType = "text/plain"): Promise<string> {
  const boundary = "backup_boundary";
  const metadata = JSON.stringify({ name, parents: [parentId] });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;
  const resp = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!resp.ok) throw new Error(`Upload error: ${await resp.text()}`);
  const data = await resp.json();
  return data.id;
}

// ── Supabase paginated fetch ───────────────────────────────────

async function fetchAll(sb: any, table: string, select: string, filters?: (q: any) => any) {
  const PAGE = 1000;
  let all: any[] = [];
  let from = 0;
  while (true) {
    let q = sb.from(table).select(select).range(from, from + PAGE - 1);
    if (filters) q = filters(q);
    const { data, error } = await q;
    if (error) throw error;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ── Background backup runner ───────────────────────────────────

async function runBackup(sb: any) {
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("Missing secret: GOOGLE_SERVICE_ACCOUNT_JSON — add it in Lovable Cloud secrets.");
  const parentFolderId = Deno.env.get("GDRIVE_BACKUP_FOLDER_ID");
  if (!parentFolderId) throw new Error("Missing secret: GDRIVE_BACKUP_FOLDER_ID — add the Google Drive folder ID in Lovable Cloud secrets.");

  console.log("GDRIVE_BACKUP_FOLDER_ID value:", parentFolderId);
  console.log("Folder ID length:", parentFolderId.length);

  const token = await getGoogleAccessToken(saJson);
  const today = new Date().toISOString().slice(0, 10);
  const ts = new Date().toISOString();

  // Create root backup folder
  const rootName = `Survive Accounting — Backup ${today}`;
  const rootId = await createDriveFolder(token, rootName, parentFolderId.trim());

    // ── Fetch all data ─────────────────────────────────────────
    const [courses, chapters, topics, assets, quizQuestions, vaAccounts, assetEvents] = await Promise.all([
      fetchAll(sb, "courses", "id, course_name, code, slug"),
      fetchAll(sb, "chapters", "id, chapter_number, chapter_name, course_id, topics_locked, topics_locked_at, topics_locked_count"),
      fetchAll(sb, "chapter_topics", "*"),
      fetchAll(sb, "teaching_assets", "id, course_id, chapter_id, asset_name, source_ref, problem_title, problem_type, difficulty, google_sheet_url, google_sheet_status, deployment_status, asset_approved_at, source_type, source_number, topic_id, lw_activity_url"),
      fetchAll(sb, "topic_quiz_questions", "*"),
      fetchAll(sb, "va_accounts", "id, name, email, role, created_at, status"),
      sb.from("asset_events").select("asset_name").order("created_at", { ascending: false }).limit(1000).then((r: any) => r.data || []),
    ]);

    // ── FOLDER 1: courses ──────────────────────────────────────
    const coursesDir = await createDriveFolder(token, "📊 courses", rootId);
    for (const c of courses) {
      const chaps = chapters.filter((ch: any) => ch.course_id === c.id);
      const courseAssets = assets.filter((a: any) => a.course_id === c.id);
      const approved = courseAssets.filter((a: any) => a.asset_approved_at);
      const txt = `Course: ${c.course_name}\nCode: ${c.code}\nChapters: ${chaps.length}\nTotal Assets: ${courseAssets.length}\nApproved Assets: ${approved.length}\n`;
      await uploadFile(token, `${c.code}.txt`, coursesDir, txt);
    }

    // ── FOLDER 2: teaching_assets ──────────────────────────────
    const assetsDir = await createDriveFolder(token, "📝 teaching_assets", rootId);
    const courseMap = Object.fromEntries(courses.map((c: any) => [c.id, c]));
    for (const ch of chapters) {
      const course = courseMap[ch.course_id];
      const code = course?.code || "UNK";
      const folderName = `${code} — Ch ${ch.chapter_number}`;
      const chDir = await createDriveFolder(token, folderName, assetsDir);
      const chAssets = assets.filter((a: any) => a.chapter_id === ch.id);
      const withLw = chAssets.filter((a: any) => a.lw_activity_url);
      const withTopic = chAssets.filter((a: any) => a.topic_id);
      const listing = chAssets.map((a: any) => `  ${a.source_ref || a.asset_name} — ${a.problem_title || "(no title)"}`).join("\n");
      const summary = `Chapter: ${ch.chapter_name}\nAssets: ${chAssets.length}\nWith LW Activity URL: ${withLw.length}\nTagged to Topics: ${withTopic.length}\n\nAsset List:\n${listing}\n`;
      await uploadFile(token, "_SUMMARY.txt", chDir, summary);
      await uploadFile(token, `${code}_Ch${ch.chapter_number}_assets.json`, chDir, JSON.stringify(chAssets, null, 2), "application/json");
    }

    // ── FOLDER 3: chapter_topics ───────────────────────────────
    const topicsDir = await createDriveFolder(token, "🎯 chapter_topics", rootId);
    for (const ch of chapters) {
      const course = courseMap[ch.course_id];
      const code = course?.code || "UNK";
      const chTopics = topics.filter((t: any) => t.chapter_id === ch.id);
      let status = "not generated";
      if (chTopics.length > 0) status = ch.topics_locked ? "locked ✓" : "generated";
      const topicLines = chTopics.map((t: any) =>
        `  #${t.topic_number} ${t.topic_name} | video: ${t.video_status || "—"} | quiz: ${t.quiz_status || "—"}`
      ).join("\n");
      const txt = `${code} Ch ${ch.chapter_number}: ${ch.chapter_name}\nStatus: ${status}\nTopics (${chTopics.length}):\n${topicLines}\n`;
      await uploadFile(token, `${code}_Ch${ch.chapter_number}_topics.txt`, topicsDir, txt);
    }

    // ── FOLDER 4: quiz_questions ───────────────────────────────
    const quizDir = await createDriveFolder(token, "📋 quiz_questions", rootId);
    const approved = quizQuestions.filter((q: any) => q.review_status === "approved");
    const pending = quizQuestions.filter((q: any) => q.review_status === "pending");
    const rejected = quizQuestions.filter((q: any) => q.review_status === "rejected");
    const byType: Record<string, number> = {};
    for (const q of quizQuestions) byType[q.question_type] = (byType[q.question_type] || 0) + 1;
    const typeLines = Object.entries(byType).map(([t, n]) => `  ${t}: ${n}`).join("\n");
    const quizSummary = `Total Questions: ${quizQuestions.length}\nApproved: ${approved.length}\nPending: ${pending.length}\nRejected: ${rejected.length}\n\nBy Type:\n${typeLines}\n`;
    await uploadFile(token, "_SUMMARY.txt", quizDir, quizSummary);
    await uploadFile(token, "all_quiz_questions.json", quizDir, JSON.stringify(quizQuestions, null, 2), "application/json");

    // ── FOLDER 5: va_accounts ──────────────────────────────────
    const vaDir = await createDriveFolder(token, "👥 va_accounts", rootId);
    const vaLines = vaAccounts.map((v: any) => `${v.name} | ${v.email} | ${v.role} | joined ${v.created_at?.slice(0, 10)}`).join("\n");
    await uploadFile(token, "va_roster.txt", vaDir, `VA Roster (${vaAccounts.length}):\n${vaLines}\n`);

    // ── FOLDER 6: greek_orgs — skipped (tables don't exist yet) ──

    // ── FOLDER 7: analytics ────────────────────────────────────
    const analyticsDir = await createDriveFolder(token, "📈 analytics", rootId);
    const counts: Record<string, number> = {};
    for (const e of assetEvents) counts[e.asset_name] = (counts[e.asset_name] || 0) + 1;
    const top20 = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const topLines = top20.map(([name, n], i) => `  ${i + 1}. ${name} — ${n} events`).join("\n");
    await uploadFile(token, "analytics_snapshot.txt", analyticsDir, `Total events sampled: ${assetEvents.length}\n\nTop 20 Most Viewed:\n${topLines}\n`);

    // ── FOLDER 8: raw_tables ───────────────────────────────────
    const rawDir = await createDriveFolder(token, "🗂 raw_tables", rootId);
    await Promise.all([
      uploadFile(token, "courses.json", rawDir, JSON.stringify(courses, null, 2), "application/json"),
      uploadFile(token, "chapters.json", rawDir, JSON.stringify(chapters, null, 2), "application/json"),
      uploadFile(token, "chapter_topics.json", rawDir, JSON.stringify(topics, null, 2), "application/json"),
      uploadFile(token, "va_accounts.json", rawDir, JSON.stringify(vaAccounts, null, 2), "application/json"),
    ]);

    // ── BACKUP_INFO.txt ────────────────────────────────────────
    const info = `SURVIVE ACCOUNTING BACKUP
========================
Timestamp: ${ts}
Supabase Project: ${supabaseUrl}

Folders:
  📊 courses — One .txt per course with stats
  📝 teaching_assets — Per-chapter summaries + full JSON
  🎯 chapter_topics — Topic generation status per chapter
  📋 quiz_questions — Summary + full JSON dump
  👥 va_accounts — VA roster (no passwords)
  📈 analytics — Top 20 viewed assets from recent events
  🗂 raw_tables — Full JSON dumps for recovery

To Restore:
  1. Import raw JSON files into Supabase using the dashboard or CLI
  2. Courses → chapters → chapter_topics → teaching_assets (in order)
  3. VA accounts can be re-created via the VA admin panel
`;
    await uploadFile(token, "BACKUP_INFO.txt", rootId, info);

    // ── Update app_settings ────────────────────────────────────
    await sb.from("app_settings").upsert({ key: "last_backup_at", value: ts }, { onConflict: "key" });
    await sb.from("app_settings").upsert({ key: "last_backup_folder_name", value: rootName }, { onConflict: "key" });
    await sb.from("app_settings").upsert({ key: "last_backup_folder_id", value: rootId }, { onConflict: "key" });

    console.log("Backup complete:", rootName, "folders:", chapters.length);
    return {
      success: true,
      backup_folder: rootName,
      timestamp: ts,
      chapters_backed_up: chapters.length,
      quiz_questions: quizQuestions.length,
      google_drive_folder_id: rootId,
    };
  }

// ── Main serve handler ─────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  // Quick validation — fail fast if secrets are missing
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) {
    return new Response(JSON.stringify({ error: "Missing secret: GOOGLE_SERVICE_ACCOUNT_JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const folderId = Deno.env.get("GDRIVE_BACKUP_FOLDER_ID");
  if (!folderId) {
    return new Response(JSON.stringify({ error: "Missing secret: GDRIVE_BACKUP_FOLDER_ID" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Mark backup as started
  await sb.from("app_settings").upsert({ key: "backup_status", value: "running" }, { onConflict: "key" });

  // Run backup in background so we don't hit the response timeout
  const backupPromise = runBackup(sb)
    .then(async (result) => {
      await sb.from("app_settings").upsert({ key: "backup_status", value: "complete" }, { onConflict: "key" });
      console.log("Background backup finished:", result.backup_folder);
    })
    .catch(async (err) => {
      console.error("Background backup failed:", err);
      await sb.from("app_settings").upsert({ key: "backup_status", value: `failed: ${err.message}` }, { onConflict: "key" });
    });

  // @ts-ignore — EdgeRuntime.waitUntil keeps the worker alive after response
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(backupPromise);
  } else {
    // Fallback: await directly (may timeout on large backups)
    await backupPromise;
  }

  return new Response(
    JSON.stringify({ success: true, message: "Backup started — check dashboard for status." }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
