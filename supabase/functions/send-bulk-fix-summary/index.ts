import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""}`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function operationCompleteHtml(op: any, nextInQueue: string | null): string {
  const duration = op.started_at && op.completed_at
    ? formatDuration(new Date(op.completed_at).getTime() - new Date(op.started_at).getTime())
    : "unknown";

  const errorNote = op.assets_errored > 0
    ? `<tr><td colspan="2" style="padding:8px 0;color:#d97706;font-size:13px;">Run the operation again to retry failed assets.</td></tr>`
    : "";

  const nextLine = nextInQueue
    ? `<p style="margin-top:16px;font-size:13px;color:#6b7280;">Next in queue: <strong>${nextInQueue}</strong></p>`
    : `<p style="margin-top:16px;font-size:13px;color:#10b981;">✓ Queue complete — no more operations pending.</p>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:#14213D;padding:24px 32px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Survive Accounting</h1>
  </div>
  <div style="padding:32px;">
    <h2 style="margin:0 0 16px;font-size:16px;color:#111827;">✓ Bulk Fix Complete — ${op.operation_name}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
      <tr><td style="padding:6px 0;color:#6b7280;">Started</td><td style="padding:6px 0;">${op.started_at ? formatTime(op.started_at) : "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Completed</td><td style="padding:6px 0;">${op.completed_at ? formatTime(op.completed_at) : "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Duration</td><td style="padding:6px 0;">${duration}</td></tr>
      <tr><td colspan="2" style="padding:8px 0;border-top:1px solid #e5e7eb;"></td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Assets processed</td><td style="padding:6px 0;">${op.assets_processed}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Succeeded</td><td style="padding:6px 0;color:#10b981;">${op.assets_succeeded}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Errors</td><td style="padding:6px 0;${op.assets_errored > 0 ? "color:#ef4444;" : ""}">${op.assets_errored}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">Skipped</td><td style="padding:6px 0;">${op.assets_skipped}</td></tr>
      ${errorNote}
    </table>
    ${nextLine}
  </div>
  <div style="padding:16px 32px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">Sent from Survive Accounting Bulk Fix Tool</p>
  </div>
</div></body></html>`;
}

function queueCompleteHtml(ops: any[]): string {
  const totalProcessed = ops.reduce((s, o) => s + (o.assets_processed || 0), 0);

  const rows = ops.map(op => {
    const duration = op.started_at && op.completed_at
      ? formatDuration(new Date(op.completed_at).getTime() - new Date(op.started_at).getTime())
      : "—";
    const errorStyle = op.assets_errored > 0 ? "background:#fef3c7;" : "";
    return `<tr style="${errorStyle}">
      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;">${op.operation_name}</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#10b981;">${op.assets_succeeded}</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;${op.assets_errored > 0 ? "color:#ef4444;" : ""}">${op.assets_errored}</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;">${duration}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:#14213D;padding:24px 32px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Survive Accounting</h1>
  </div>
  <div style="padding:32px;">
    <h2 style="margin:0 0 8px;font-size:16px;color:#111827;">✓ Overnight Queue Complete — ${ops.length} operation${ops.length !== 1 ? "s" : ""} finished</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Total assets processed across all operations: <strong>${totalProcessed}</strong></p>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:12px;color:#6b7280;">Operation</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:12px;color:#6b7280;">Succeeded</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:12px;color:#6b7280;">Errors</th>
          <th style="padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:12px;color:#6b7280;">Duration</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:24px;font-size:14px;color:#111827;">All done — your assets have been updated.</p>
  </div>
  <div style="padding:16px 32px;background:#f9fafb;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">Sent from Survive Accounting Bulk Fix Tool</p>
  </div>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { type, operation, operations, next_in_queue } = await req.json();

    let subject: string;
    let html: string;

    if (type === "operation_complete") {
      if (!operation) throw new Error("Missing operation data");
      subject = `✓ Bulk Fix Complete — ${operation.operation_name}`;
      html = operationCompleteHtml(operation, next_in_queue || null);
    } else if (type === "queue_complete") {
      if (!operations || !Array.isArray(operations)) throw new Error("Missing operations array");
      subject = `✓ Overnight Queue Complete — ${operations.length} operations finished`;
      html = queueCompleteHtml(operations);
    } else {
      throw new Error("Invalid type. Must be 'operation_complete' or 'queue_complete'");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Survive Accounting <lee@mail.surviveaccounting.com>",
        reply_to: "lee@surviveaccounting.com",
        to: ["lee@surviveaccounting.com"],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    return new Response(JSON.stringify({ success: true, email_id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-bulk-fix-summary error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
