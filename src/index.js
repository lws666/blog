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
// 主线路现用 cf.lwsnb.eu.cc;www 与旧 dpdns 域名一律 301 过去,继承权重
const NEW_HOST = 'cf.lwsnb.eu.cc'
// 需要 301 到 NEW_HOST 的历史域名
const REDIRECT_HOSTS = new Set([OLD_HOST, 'www.lwsnb.eu.cc'])

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
 * Homepage hero background preload.
 *
 * The hero image is rendered by Vue after mount, so the browser only discovers
 * it around ~835ms — long after the JS bundles started. Preloading it in the
 * <head> starts the download immediately, in parallel with the bundles.
 *
 * Must stay in sync with themeConfig.banner.url (valaxy.config.ts). The image
 * is served from img.lwsnb.eu.cc, which is a Worker-backed origin with edge
 * caching (cf-cache-status: HIT, 30-day TTL), so this is a CDN URL already.
 *
 * No crossorigin attribute on purpose: the <img> in BfHero.vue does not set
 * one either, so both fetches are no-cors and share one cache entry. Adding
 * crossorigin here (CORS mode) made the browser download the 337KB twice.
 */
const HERO_PRELOAD
  = '<link rel="preload" as="image" fetchpriority="high"'
    + ' href="https://img.lwsnb.eu.cc/file/1770349301804_DefualtThumbnail.jpg.webp">'

/**
 * Inject the homepage hero preload into a shell HTML document.
 *
 * Only for "/" — the shell is shared by every route, so preloading a 337KB
 * image on article pages would be pure waste. Applied to both the human shell
 * (static index.html) and the crawler shell, since they are the same document
 * served through two paths.
 */
function withHeroPreload(html, pathname) {
  if (pathname !== '/' || html.includes(HERO_PRELOAD)) return html
  return html.replace('</head>', `${HERO_PRELOAD}\n</head>`)
}

/**
 * Rebuild a response around a body we re-wrote as plain text.
 *
 * Reading an asset with .text() decodes it (ASSETS serves index.html brotli-
 * compressed when the client sends Accept-Encoding), so the original
 * Content-Encoding / Content-Length headers no longer describe the body we
 * return. Keeping them makes the browser try to decode plain HTML a second
 * time — a blank page. Drop them; the runtime re-compresses on the way out.
 */
function plainTextResponse(request, html, res) {
  const headers = new Headers(res.headers)
  headers.delete('Content-Encoding')
  headers.delete('Content-Length')
  for (const [k, v] of Object.entries(SECURITY_HEADERS))
    headers.set(k, v)
  return new Response(request.method === 'HEAD' ? null : html, {
    status: res.status,
    headers,
  })
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

  // Homepage LCP: the hero background image is only rendered once Vue mounts
  // (~835ms in), so the browser discovers it far too late. Preloading it in
  // the head lets it download in parallel with the JS bundles.
  html = withHeroPreload(html, url.pathname)

  return new Response(request.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': shellRes.headers.get('Cache-Control') || 'no-cache',
    },
  })
}

/**
 * Security headers for every HTML page we serve (or re-write).
 *
 * Clickjacking: the site has no reason to be framed (the admin dashboard
 * operates via same-origin fetch + sessionStorage, not iframe embedding),
 * so deny framing outright.
 * Sniffing: assets are served with correct Content-Types; disallow guessing.
 * Referral: only the origin is sent cross-origin, keeping URLs (admin tokens
 * never appear in URLs anyway) out of third-party referrer headers.
 */
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    // ── Domain migration: legacy hosts → current host (301) ────
    if (REDIRECT_HOSTS.has(url.hostname)) {
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
    // The homepage is served from here (index.html is a real asset), so the
    // hero preload has to be applied on this path as well — not only in the
    // crawler branch above.
    try {
      const res = await env.ASSETS.fetch(request)
      if (res.status !== 404) {
        if (path !== '/' || !(res.headers.get('Content-Type') || '').includes('text/html')) {
          // Non-HTML assets: pass through with the security headers added
          // (X-Frame-Options only matters for documents, but nosniff helps
          // everywhere; headers are merged, not duplicated).
          const headers = new Headers(res.headers)
          for (const [k, v] of Object.entries(SECURITY_HEADERS))
            headers.set(k, v)
          return new Response(res.body, { status: res.status, headers })
        }
        return plainTextResponse(request, withHeroPreload(await res.text(), path), res)
      }
    } catch {
      // ASSETS unavailable or threw — try index.html fallback below
    }

    // ── SPA fallback (admin, client-side routes) ────────────────
    try {
      const res = await env.ASSETS.fetch(new Request(url.origin + '/index.html'))
      return plainTextResponse(request, withHeroPreload(await res.text(), path), res)
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  },
}
