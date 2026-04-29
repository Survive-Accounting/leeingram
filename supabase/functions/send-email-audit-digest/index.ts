// Sends a single digest email to lee@survivestudios.com containing
// every system email Survive Accounting sends — with subject, trigger,
// purpose, and the rendered HTML body inline. Lee replies with new
// HTML and we batch-update the source templates in one pass.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RECIPIENT = "lee@survivestudios.com";
const FROM = "Survive Accounting Audit <lee@mail.surviveaccounting.com>";

// ---- Sample data used to render each template ----
const SAMPLE_EMAIL = "student@example.edu";
const SAMPLE_MAGIC_LINK =
  "https://learn.surviveaccounting.com/auth/callback?token=SAMPLE_TOKEN";
const SAMPLE_ASSET_CODE = "IA2_CH13_BE001_A";
const SAMPLE_VIEWER_LINK = `https://learn.surviveaccounting.com/solutions/${SAMPLE_ASSET_CODE}`;
const SAMPLE_NAME = "Jordan";

// ---- Renderers (mirror the live templates) ----

function welcomeAfterPurchaseHtml(magicLink: string): string {
  const buttonHtml = magicLink
    ? `<a href="${magicLink}" style="display:inline-block;background-color:#CE1126;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;margin:24px 0;">Log In to Survive Accounting</a>`
    : `<p style="color:#666;font-size:14px;">We're setting up your account — you'll receive a login link shortly.</p>`;
  return `
<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#F8F9FA;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background-color:#14213D;padding:28px 32px;text-align:center;">
<h1 style="margin:0;color:#fff;font-family:'DM Serif Display',Georgia,serif;font-size:22px;font-weight:400;">Welcome to Survive Accounting</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#14213D;font-size:15px;line-height:1.6;">Your Study Pass is confirmed! You now have full access to practice problems, explanations, and study tools.</p>
<div style="text-align:center;">${buttonHtml}</div>
<p style="margin:16px 0 0;color:#888;font-size:12px;text-align:center;">This link expires in 15 minutes.</p>
<p style="margin:8px 0 0;color:#888;font-size:12px;text-align:center;">If it's expired, request a new one at: <a href="https://learn.surviveaccounting.com/login" style="color:#CE1126;">learn.surviveaccounting.com/login</a></p>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
<p style="margin:0;color:#666;font-size:13px;line-height:1.5;">Questions? Just reply to this email — I read every message.<br>— Lee</p>
</td></tr></table></td></tr></table></body></html>`;
}

function loginLinkHtml(magicLink: string): string {
  return `
<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#F8F9FA;font-family:Inter,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8F9FA;padding:40px 20px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:12px;overflow:hidden;">
<tr><td style="background-color:#14213D;padding:28px 32px;text-align:center;">
<h1 style="margin:0;color:#fff;font-family:'DM Serif Display',Georgia,serif;font-size:22px;font-weight:400;">Your Login Link</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#14213D;font-size:15px;line-height:1.6;">Here's your secure login link for Survive Accounting. Open it on the same device where you requested it.</p>
<div style="text-align:center;">
<a href="${magicLink}" style="display:inline-block;background-color:#CE1126;color:#fff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;margin:24px 0;">Log In to Survive Accounting</a>
</div>
<p style="margin:16px 0 0;color:#888;font-size:12px;text-align:center;">This link expires in 15 minutes and only works on the device that requested it.</p>
<p style="margin:8px 0 0;color:#888;font-size:12px;text-align:center;">Need a new one? Request it at: <a href="https://learn.surviveaccounting.com/login" style="color:#CE1126;">learn.surviveaccounting.com/login</a></p>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
<p style="margin:0;color:#666;font-size:13px;line-height:1.5;">Questions? Just reply to this email — I read every message.<br>— Lee</p>
</td></tr></table></td></tr></table></body></html>`;
}

function fixEmailHtml(firstName: string, assetCode: string): string {
  const greeting = firstName && firstName !== "there" ? firstName : "there";
  return `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#222;line-height:1.6;max-width:520px;margin:0 auto;padding:20px;">
<p>Hey ${greeting},</p>
<p>Thanks for flagging that — I appreciate it. I've improved that problem and it should make more sense now.</p>
<p>You can view the updated version here:<br>
<a href="https://learn.surviveaccounting.com/solutions/${assetCode}" style="color:#14213D;font-weight:bold;">learn.surviveaccounting.com/solutions/${assetCode}</a>
</p>
<p>— Lee</p>
</body></html>`.trim();
}

function viewerLinkHtml(link: string, assetCode: string): string {
  return `
<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#14213D;">
<h2 style="margin:0 0 12px;font-weight:500;">Pick up where you left off</h2>
<p style="color:#5A6478;line-height:1.5;font-size:14px;">Open this on your laptop for the best cramming experience.</p>
<p style="margin:24px 0;">
<a href="${link}" style="display:inline-block;background:#14213D;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Open Solutions Viewer</a>
</p>
<p style="color:#94A3B8;font-size:12px;margin-top:32px;">Problem: ${assetCode}</p>
</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function plainTextBlock(text: string): string {
  return `<pre style="background:#F8F9FA;border:1px solid #E5E7EB;border-radius:8px;padding:16px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;color:#14213D;white-space:pre-wrap;margin:0;">${escapeHtml(text)}</pre>`;
}

const issueReportText = [
  `PROBLEM: ${SAMPLE_ASSET_CODE}`,
  `Recording note receivable with interest`,
  `COURSE: Intermediate Accounting 2`,
  `CHAPTER: Ch 13 — Current Liabilities`,
  `ASSET: ${SAMPLE_ASSET_CODE}`,
  ``,
  `ISSUE TYPE:`,
  `The math doesn't add up`,
  ``,
  `MESSAGE:`,
  `In part (b), the interest calc seems off — should it be 6 months not 9?`,
  ``,
  `---`,
  `Reply directly to this email to respond to ${SAMPLE_EMAIL}.`,
  `Their reply-to is set.`,
].join("\n");

const chapterQuestionText = [
  `Course: Intermediate Accounting 2`,
  `Chapter: Ch 13 — Current Liabilities`,
  ``,
  `Question:`,
  `Why do we accrue interest on a non-interest-bearing note? Confused on the discount.`,
  ``,
  `---`,
  `Reply directly to this email to respond to the student at ${SAMPLE_EMAIL}.`,
].join("\n");

const contactNotificationText = [
  `Name: ${SAMPLE_NAME}`,
  `Email: ${SAMPLE_EMAIL}`,
  `Subject: Bulk pricing for chapter`,
  ``,
  `Message:`,
  `Hi Lee — our chapter has 35 members. Do you offer group pricing?`,
  ``,
  `---`,
  `Reply directly to this email to respond to ${SAMPLE_NAME} at ${SAMPLE_EMAIL}.`,
].join("\n");

function bulkFixSummaryHtml(): string {
  return `
<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;background:#F8F9FA;padding:24px;color:#14213D;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;">
<h2 style="margin:0 0 8px;font-family:'DM Serif Display',Georgia,serif;color:#14213D;">✓ Bulk Fix Complete — Standardize Formatting</h2>
<p style="color:#666;font-size:13px;margin:0 0 20px;">Operation finished overnight.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;">
<tr><td style="padding:6px 0;color:#666;">Assets processed</td><td style="text-align:right;font-weight:600;">142</td></tr>
<tr><td style="padding:6px 0;color:#666;">Successful</td><td style="text-align:right;font-weight:600;color:#16A34A;">138</td></tr>
<tr><td style="padding:6px 0;color:#666;">Failed</td><td style="text-align:right;font-weight:600;color:#DC2626;">4</td></tr>
<tr><td style="padding:6px 0;color:#666;">Duration</td><td style="text-align:right;font-weight:600;">23m 14s</td></tr>
</table>
<hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0;">
<p style="margin:0;color:#666;font-size:13px;">Next in queue: Remove AI Thinking (87 assets pending).</p>
</div></body></html>`;
}

// ---- Email catalog ----
type EmailEntry = {
  id: string;
  category: "Student-facing" | "Internal notification";
  fn: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  trigger: string;
  purpose: string;
  body: string;
  notes?: string;
};

function buildCatalog(): EmailEntry[] {
  return [
    {
      id: "welcome-after-purchase",
      category: "Student-facing",
      fn: "stripe-webhook",
      subject: "You're in — here's your login link",
      fromAddress: "Survive Accounting <lee@mail.surviveaccounting.com>",
      toAddress: "<purchaser email>",
      trigger:
        "Stripe checkout.session.completed webhook fires after a successful purchase.",
      purpose:
        "Welcomes the new student and delivers a one-tap magic login link so they can immediately access their pass.",
      body: welcomeAfterPurchaseHtml(SAMPLE_MAGIC_LINK),
      notes:
        "Test mode prefixes subject with [TEST]. Magic link is generated server-side and expires in 15 minutes.",
    },
    {
      id: "login-magic-link",
      category: "Student-facing",
      fn: "resend-login-link",
      subject: "Your login link (expires in 15 minutes)",
      fromAddress: "Survive Accounting <lee@mail.surviveaccounting.com>",
      toAddress: "<student email>",
      trigger:
        "Student requests a login link from /login (passwordless flow).",
      purpose:
        "Sends a fresh magic link bound to their device fingerprint. Primary way back into the platform after the welcome link expires.",
      body: loginLinkHtml(SAMPLE_MAGIC_LINK),
      notes:
        "Single-device — reusing on a different browser or device fails the nonce check.",
    },
    {
      id: "viewer-link",
      category: "Student-facing",
      fn: "send-viewer-link",
      subject: "Your Survive Accounting study link",
      fromAddress: "Lee at Survive Accounting <lee@mail.surviveaccounting.com>",
      toAddress: "<student email>",
      trigger:
        "Student on mobile taps 'Send to my laptop' on a Solutions Viewer page.",
      purpose:
        "Hands off the current study session to a desktop browser, where the cram experience works best.",
      body: viewerLinkHtml(SAMPLE_VIEWER_LINK, SAMPLE_ASSET_CODE),
    },
    {
      id: "fix-email",
      category: "Student-facing",
      fn: "send-fix-email",
      subject: "Re: your fix request",
      fromAddress: "Lee <lee@mail.surviveaccounting.com>",
      toAddress: "<student email>",
      trigger:
        "Lee (or VA) marks a student-reported issue as fixed in the Asset Page Fixer.",
      purpose:
        "Closes the loop with the student who flagged a bad problem — confirms it was fixed and links to the updated asset.",
      body: fixEmailHtml(SAMPLE_NAME, SAMPLE_ASSET_CODE),
      notes:
        "isTest=true reroutes to lee@surviveaccounting.com and prefixes [TEST]. The subject is passed in by the admin at send time.",
    },
    {
      id: "issue-report",
      category: "Internal notification",
      fn: "send-issue-report",
      subject: `Issue report: ${SAMPLE_ASSET_CODE} from ${SAMPLE_EMAIL}`,
      fromAddress: "lee@mail.surviveaccounting.com",
      toAddress: "lee@surviveaccounting.com",
      trigger: "Student submits 'Suggest Fix' on a Solutions Viewer page.",
      purpose:
        "Notifies Lee of a content issue with full context (course, chapter, asset, type, message). Reply-to is the student.",
      body: plainTextBlock(issueReportText),
      notes: "Plain-text body. Hitting Reply opens a draft to the student.",
    },
    {
      id: "chapter-question",
      category: "Internal notification",
      fn: "send-chapter-question",
      subject: `Ch 13 question from ${SAMPLE_EMAIL}`,
      fromAddress: "lee@mail.surviveaccounting.com",
      toAddress: "lee@surviveaccounting.com",
      trigger:
        "Student submits 'Ask Lee' from the Survive This Chapter hub.",
      purpose:
        "Delivers a chapter-level conceptual question to Lee. Reply-to is the student.",
      body: plainTextBlock(chapterQuestionText),
    },
    {
      id: "contact-notification",
      category: "Internal notification",
      fn: "send-contact-notification",
      subject: `[Contact Form] Bulk pricing for chapter — from ${SAMPLE_NAME}`,
      fromAddress: "lee@mail.surviveaccounting.com",
      toAddress: "lee@surviveaccounting.com",
      trigger: "Anyone submits the Contact form on the public landing page.",
      purpose:
        "Forwards general inquiries (sales, partnerships, support) to Lee. Reply-to is the sender.",
      body: plainTextBlock(contactNotificationText),
    },
    {
      id: "bulk-fix-summary",
      category: "Internal notification",
      fn: "send-bulk-fix-summary",
      subject: "✓ Bulk Fix Complete — Standardize Formatting",
      fromAddress: "Survive Accounting <lee@mail.surviveaccounting.com>",
      toAddress: "lee@surviveaccounting.com",
      trigger:
        "An overnight bulk-fix operation (Standardize Formatting, Remove AI Thinking, Remove Duplicates) completes.",
      purpose:
        "Reports the operation outcome (counts, duration, failures) and what's next in the queue.",
      body: bulkFixSummaryHtml(),
      notes:
        "A separate variant fires when the entire overnight queue finishes ('Overnight Queue Complete').",
    },
  ];
}

function renderDigest(entries: EmailEntry[]): string {
  const toc = entries
    .map(
      (e, i) =>
        `<li><a href="#e-${e.id}" style="color:#CE1126;text-decoration:none;font-weight:600;">${i + 1}. ${e.subject}</a> <span style="color:#666;font-size:12px;">(${e.fn})</span></li>`,
    )
    .join("");

  const sections = entries
    .map(
      (e, i) => `
<section id="e-${e.id}" style="margin:48px 0;padding:24px;background:#fff;border:1px solid #E5E7EB;border-radius:12px;">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${e.category === "Student-facing" ? "#CE1126" : "#14213D"};">${i + 1}. ${e.category}</p>
  <h2 style="margin:0 0 16px;font-family:'DM Serif Display',Georgia,serif;font-size:24px;color:#14213D;font-weight:400;">${e.subject}</h2>
  <table style="width:100%;border-collapse:collapse;font-size:13px;color:#14213D;margin-bottom:20px;">
    <tr><td style="padding:6px 0;color:#666;width:140px;vertical-align:top;">Edge function</td><td style="padding:6px 0;font-family:ui-monospace,Menlo,monospace;">${e.fn}</td></tr>
    <tr><td style="padding:6px 0;color:#666;vertical-align:top;">From</td><td style="padding:6px 0;">${escapeHtml(e.fromAddress)}</td></tr>
    <tr><td style="padding:6px 0;color:#666;vertical-align:top;">To</td><td style="padding:6px 0;">${escapeHtml(e.toAddress)}</td></tr>
    <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Triggered when</td><td style="padding:6px 0;">${e.trigger}</td></tr>
    <tr><td style="padding:6px 0;color:#666;vertical-align:top;">Purpose</td><td style="padding:6px 0;">${e.purpose}</td></tr>
    ${e.notes ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top;">Notes</td><td style="padding:6px 0;color:#666;font-style:italic;">${e.notes}</td></tr>` : ""}
  </table>
  <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#666;">Rendered preview</p>
  <div style="border:1px dashed #C8D6EC;border-radius:8px;padding:16px;background:#F8F9FA;">
    ${e.body}
  </div>
</section>`,
    )
    .join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F8F9FA;font-family:Inter,Arial,sans-serif;color:#14213D;">
<div style="max-width:760px;margin:0 auto;padding:32px 20px;">
  <div style="background:#14213D;color:#fff;padding:28px 32px;border-radius:12px;margin-bottom:24px;">
    <h1 style="margin:0;font-family:'DM Serif Display',Georgia,serif;font-size:28px;font-weight:400;">Survive Accounting — System Email Audit</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">A single digest of every transactional email the platform sends. Reply with new HTML for any of these and we'll batch-update the templates in one pass.</p>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.55);font-size:12px;">Generated ${new Date().toUTCString()}</p>
  </div>
  <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:20px 24px;">
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#666;">Contents</p>
    <ol style="margin:0;padding-left:20px;line-height:1.9;font-size:14px;">${toc}</ol>
  </div>
  ${sections}
  <p style="margin:32px 0 0;color:#888;font-size:12px;text-align:center;">Sample data is used in every preview — real sends use live student data.</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const entries = buildCatalog();
  const html = renderDigest(entries);
  const subject = `📧 Survive Accounting — System Email Audit (${entries.length} emails)`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [RECIPIENT],
        reply_to: "lee@surviveaccounting.com",
        subject,
        html,
      }),
    });

    const body = await r.text();
    if (!r.ok) {
      console.error("Resend failed", r.status, body);
      return new Response(
        JSON.stringify({ error: "send failed", status: r.status, detail: body }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, recipient: RECIPIENT, count: entries.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
