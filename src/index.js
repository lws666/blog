/**
 * lwsnb Worker — serves static assets + proxies SEO/API to blog-worker.
 *
 * Behaviour:
 *   www.lwsnb.dpdns.org (old host)               → 301 to www.lwsnb.eu.cc
 *   /sitemap.xml /robots.txt /rss.xml /llms.txt  → proxy to api.lwsnb.eu.cc
 *   /api/*                                        → proxy to api.lwsnb.eu.cc
 *   /posts/* (crawler only)                       → proxy to api.lwsnb.eu.cc (pre-render)
 *   /posts/* (browser)                            → serve from assets (SPA fallback)
 *   everything else                               → serve from assets (SPA fallback)
 */
const API_ORIGIN = 'https://api.lwsnb.eu.cc'
const OLD_HOST = 'www.lwsnb.dpdns.org'
const NEW_HOST = 'www.lwsnb.eu.cc'

/** Bot / crawler User-Agent patterns */
const BOT_UA = /googlebot|bingbot|baiduspider|yandexbot|duckduckbot|twitterbot|facebookexternalhit|slackbot|discordbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|dotbot|mj12bot|seznambot|ia_archiver|twitter|facebook|linkedinbot|slack|pinterest|skypeuripreview|wget|curl|python-requests|java|http-client/i

function isBot(ua) {
  return BOT_UA.test(ua)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // ── Domain migration: old host → new host (301) ────────────
    if (url.hostname === OLD_HOST) {
      return Response.redirect(`https://${NEW_HOST}${path}${url.search}`, 301)
    }

    // ── API: same-origin for the browser ────────────────────────
    // Invoked through the API service binding, so the request never leaves
    // this isolate's account: no public round trip, no second DNS/TLS
    // handshake in the browser, and no dependency on api.* being reachable.
    if (path.startsWith('/api/')) {
      return env.API.fetch(request)
    }

    // ── SEO + API: proxy to blog-worker ─────────────────────────
    const isSeo = path === '/sitemap.xml' || path === '/robots.txt' ||
                  path === '/rss.xml' || path === '/llms.txt'
    if (isSeo) {
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
