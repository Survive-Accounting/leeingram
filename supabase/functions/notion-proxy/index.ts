const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const pageId = url.searchParams.get("pageId");
  const chapterId = url.searchParams.get("chapterId") || "";
  if (!pageId) {
    return new Response("Missing pageId", { status: 400, headers: corsHeaders });
  }

  try {
    const notionUrl = `https://${pageId}.notion.site`;
    const res = await fetch(notionUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return new Response(`Notion returned ${res.status}`, {
        status: 502,
        headers: corsHeaders,
      });
    }

    let html = await res.text();

    const notionBase = `https://${pageId}.notion.site`;

    // Rewrite relative URLs to absolute
    html = html.replace(/(href|src|action)="\/([^"]*)"/gi, `$1="${notionBase}/$2"`);
    html = html.replace(/(href|src|action)='\/([^']*)'/gi, `$1='${notionBase}/$2'`);

    // Inject CSS to hide Notion topbar
    const hideCSS = `<style>
.notion-topbar, .notion-topbar-mobile, header, .notion-peek-renderer,
div[class*="topbar"], nav[class*="notion"] { display: none !important; }
body { margin: 0; padding: 0; }
</style>`;

    // Legacy banner
    const linkHref = chapterId
      ? `https://learn.surviveaccounting.com/cram/${chapterId}`
      : "https://learn.surviveaccounting.com";

    const banner = `<div style="background:#14213D;width:100%;padding:8px 16px;display:flex;align-items:center;gap:12px;border-bottom:2px solid #CE1126;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,sans-serif;height:40px;">
  <img src="https://lwfiles.mycourse.app/672bc379cd024d536f651ecc-public/1554d231f0e2bf121ac35937c4d438ca.png" alt="Survive" style="height:22px;width:auto;" />
  <span style="color:rgba(255,255,255,0.6);font-size:12px;text-transform:uppercase;letter-spacing:0.08em;font-weight:500;">LEGACY CONTENT &#183; 2020&#8211;2025</span>
  <a href="${linkHref}" target="_parent" style="margin-left:auto;color:#CE1126;font-size:12px;text-decoration:none;font-weight:500;">View new version &#8594;</a>
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
