const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const pageId = url.searchParams.get("pageId");
  if (!pageId) {
    return new Response("Missing pageId", { status: 400, headers: corsHeaders });
  }

  try {
    const notionUrl = `https://${pageId}.notion.site`;
    const res = await fetch(notionUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SurviveProxy/1.0)" },
      redirect: "follow",
    });

    if (!res.ok) {
      return new Response(`Notion returned ${res.status}`, {
        status: 502,
        headers: corsHeaders,
      });
    }

    let html = await res.text();

    // Strip Notion topbar / navbar elements
    html = html.replace(/<div[^>]*class="[^"]*notion-topbar[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
    html = html.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");

    // Inject CSS to hide topbar via style (backup)
    const hideCSS = `<style>
.notion-topbar, .notion-topbar-mobile, header, .notion-peek-renderer,
div[class*="topbar"], nav[class*="notion"] { display: none !important; }
body { margin: 0; padding: 0; }
</style>`;

    // Legacy banner HTML
    const banner = `<div style="background:#14213D;width:100%;padding:8px 16px;display:flex;align-items:center;gap:12px;border-bottom:2px solid #CE1126;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <img src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png" alt="Survive" style="height:24px;width:auto;" />
  <span style="color:rgba(255,255,255,0.6);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:500;">LEGACY CONTENT · 2020–2025</span>
  <a href="https://learn.surviveaccounting.com" target="_parent" style="margin-left:auto;color:#CE1126;font-size:12px;text-decoration:none;font-weight:500;">Updated version available →</a>
</div>`;

    // Inject after <body>
    if (html.includes("<body")) {
      html = html.replace(/(<body[^>]*>)/i, `$1${hideCSS}${banner}`);
    } else {
      html = `${hideCSS}${banner}${html}`;
    }

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (e: any) {
    return new Response(`Proxy error: ${e.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
