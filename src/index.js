/**
 * lwsnb Worker — serves static assets + proxies SEO/API to blog-worker.
 *
 * Behaviour:
 *   /sitemap.xml /robots.txt /rss.xml /llms.txt  → proxy to api.lwsnb.dpdns.org
 *   /api/*                                        → proxy to api.lwsnb.dpdns.org
 *   everything else                               → serve from assets (SPA fallback)
 */
const API_ORIGIN = 'https://api.lwsnb.dpdns.org'

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
