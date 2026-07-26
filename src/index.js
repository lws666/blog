/**
 * lwsnb Worker — serves static assets + proxies SEO/API to blog-worker.
 *
 * Behaviour:
 *   /sitemap.xml /robots.txt /rss.xml /llms.txt  → proxy to api.lwsnb.dpdns.org
 *   /api/*                                        → proxy to api.lwsnb.dpdns.org
 *   /posts/* (crawler only)                       → proxy to api.lwsnb.dpdns.org (pre-render)
 *   /posts/* (browser)                            → serve from assets (SPA fallback)
 *   everything else                               → serve from assets (SPA fallback)
 */
const API_ORIGIN = 'https://api.lwsnb.dpdns.org'

/** Bot / crawler User-Agent patterns */
const BOT_UA = /googlebot|bingbot|baiduspider|yandexbot|duckduckbot|twitterbot|facebookexternalhit|slackbot|discordbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|dotbot|mj12bot|seznambot|ia_archiver|twitter|facebook|linkedinbot|slack|pinterest|skypeuripreview|wget|curl|python-requests|java|http-client/i

function isBot(ua) {
  return BOT_UA.test(ua)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // ── SEO + API: proxy to blog-worker ─────────────────────────
    const isSeo = path === '/sitemap.xml' || path === '/robots.txt' ||
                  path === '/rss.xml' || path === '/llms.txt'
    if (isSeo || path.startsWith('/api/')) {
      const target = API_ORIGIN + path + url.search
      return fetch(new Request(target, request))
    }

    // ── Post pre-render: proxy crawlers to blog-worker ──────────
    if (path.startsWith('/posts/') && isBot(request.headers.get('User-Agent') || '')) {
      const target = API_ORIGIN + path + url.search
      return fetch(new Request(target, request))
    }

    // ── Homepage pre-render: proxy crawlers to blog-worker ─────
    if (path === '/' && isBot(request.headers.get('User-Agent') || '')) {
      const target = API_ORIGIN + '/render/homepage'
      return fetch(new Request(target, request))
    }

    // ── Static assets via ASSETS binding ────────────────────────
    try {
      const res = await env.ASSETS.fetch(request)
      if (res.status !== 404) return res
    } catch {
      // ASSETS unavailable or threw — try index.html fallback below
    }

    // ── SPA fallback (admin, client-side routes) ────────────────
    try {
      return await env.ASSETS.fetch(new Request(url.origin + '/index.html'))
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  },
}
