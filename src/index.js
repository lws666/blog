/**
 * lwsnb Worker — serves static assets + proxies SEO/API to blog-worker.
 *
 * Behaviour:
 *   www.lwsnb.dpdns.org (old host)                → 301 to www.lwsnb.eu.cc
 *   /sitemap.xml /robots.txt /rss.xml /llms.txt   → proxy to api.lwsnb.eu.cc
 *   /api/*                                        → same-origin service binding
 *   crawler requests                              → real page + injected <head>
 *   everything else                               → serve from assets
 *
 * Crawlers used to receive a completely different document: a bare
 * pre-rendered HTML page with no theme, no navigation and no JavaScript
 * (Search Console's mobile test showed exactly that page, which is why it
 * looked nothing like the real site). They now get the same SPA document
 * everyone else gets, with the per-page SEO tags already in the <head> so
 * that crawlers and JavaScript-less unfurl bots (Telegram, Discord, WeChat)
 * still see the article title and cover without running Vue.
 */
const API_ORIGIN = 'https://api.lwsnb.eu.cc'
const OLD_HOST = 'www.lwsnb.dpdns.org'
const NEW_HOST = 'www.lwsnb.eu.cc'

/** Bot / crawler User-Agent patterns */
const BOT_UA = /googlebot|bingbot|baiduspider|yandexbot|duckduckbot|twitterbot|facebookexternalhit|slackbot|discordbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|dotbot|mj12bot|seznambot|ia_archiver|twitter|facebook|linkedinbot|slack|pinterest|skypeuripreview|wget|curl|python-requests|java|http-client/i

function isBot(ua) {
  return BOT_UA.test(ua)
}

/**
 * Extract the reusable SEO tags from a blog-worker pre-render page.
 *
 * Keeps <title>, <meta>, <link rel="canonical"> and the JSON-LD block; drops
 * the pre-render's own boilerplate (charset / viewport duplicates the shell
 * already has) and its inline <style>, which only styled the old bare page.
 */
function seoHeadFrom(html) {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  if (!head) return ''
  return head[1]
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<meta\s+charset[^>]*>/gi, '')
    .replace(/<meta\s+name="viewport"[^>]*>/gi, '')
    .trim()
}

/**
 * Extract the pre-render's body content.
 *
 * Scripts and inline styles are dropped — the shell ships its own bundle and
 * stylesheet. What remains is exactly the content Vue mounts into #app.
 */
function seoBodyFrom(html) {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (!body) return ''
  return body[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .trim()
}

/**
 * Serve the real SPA shell with the per-page SEO head injected.
 *
 * The shell's own static <title>/<meta description> are replaced, and the
 * pre-render's tags are appended last so they win over anything the theme
 * injected earlier in <head>. The body is untouched: same document, same
 * theme, same JavaScript as a normal visit.
 */
async function withSeoHead(env, request, url, apiPath) {
  const [shellRes, seoRes] = await Promise.all([
    env.ASSETS.fetch(new Request(url.origin + '/index.html')),
    fetch(new Request(API_ORIGIN + apiPath, request)),
  ])

  // No pre-rendered tags available (unknown slug, API hiccup): fall through to
  // the plain shell rather than failing the request.
  if (!shellRes.ok || !seoRes.ok) return shellRes

  const [shell, seo] = await Promise.all([shellRes.text(), seoRes.text()])
  const head = seoHeadFrom(seo)
  const body = seoBodyFrom(seo)
  if (!head && !body) return new Response(shell, shellRes)

  let html = shell
  if (head) {
    html = html
      .replace(/<title>[\s\S]*?<\/title>/i, '')
      .replace(/<meta\s+name="description"[^>]*>/i, '')
      .replace('</head>', `${head}\n</head>`)
  }

  // Hand non-JS consumers the content as well. Bing's renderer is far less
  // reliable than Google's, and its SEO analyzer reads the raw HTML — where an
  // empty SPA shell has no <h1> at all ("H1 tag missing" in Webmaster Tools).
  // The pre-rendered body is exactly what Vue mounts into #app, so after
  // hydration the DOM is the same document users see; nothing is hidden from
  // or shown differently to anyone.
  if (body) {
    html = html.replace(/(<div id="app">)[\s\S]*?(<\/div>)/i, `$1${body}$2`)
  }

  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': shellRes.headers.get('Cache-Control') || 'no-cache',
    },
  })
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

    // ── SEO endpoints: proxy to blog-worker ─────────────────────
    const isSeo = path === '/sitemap.xml' || path === '/robots.txt' ||
                  path === '/rss.xml' || path === '/llms.txt'
    if (isSeo) {
      const target = API_ORIGIN + path + url.search
      return fetch(new Request(target, request))
    }

    // ── Crawlers: real page, SEO head pre-filled ────────────────
    if (isBot(request.headers.get('User-Agent') || '')) {
      if (path === '/') {
        return withSeoHead(env, request, url, '/render/homepage')
      }
      if (path.startsWith('/posts/')) {
        return withSeoHead(env, request, url, path + url.search)
      }
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
