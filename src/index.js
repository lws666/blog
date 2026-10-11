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
// 规范域名回落到 www(历史收录所在);cf 子域仅作线路,一律 301 过来
const NEW_HOST = 'www.lwsnb.eu.cc'
// 需要 301 到 NEW_HOST 的历史域名
const REDIRECT_HOSTS = new Set([OLD_HOST, 'cf.lwsnb.eu.cc'])

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
 * Anzhiyu-style fullpage loading screen (ported from
 * hexo-theme-anzhiyu layout/includes/loading/fullpage-loading.pug).
 *
 * Full-viewport overlay on the card background: the site avatar pulsing
 * (opacity alternate) with the signature green dot pinned at its
 * bottom-right. Fades out via the .loaded class, driven by:
 *   - window 'load' (original behaviour)
 *   - click-to-dismiss (original) and a 10s timeout fallback (original)
 *   - Vue mount: the overlay lives outside #app (see withAppSkeleton), so
 *     Vue never touches it. The watcher below keeps the DOM honest anyway
 *     (style-only failures, extensions, etc.) and enforces removal.
 *
 * The <style> block lives in document.head (NOT beside the node): styles
 * inside #app get stripped when Vue hydrates, which would leave the overlay
 * statically rendered at full opacity at the bottom of the page — the
 * "avatar in the footer" bug.
 *
 * Inline-only CSS/JS, zero extra requests. Avatar URL is fixed here to
 * match site.config.ts author.avatar (the shell HTML cannot read Valaxy
 * config).
 */
const LOADING_AVATAR = 'https://img.lwsnb.eu.cc/file/1770349295364_IMG_20250823_144910_239.jpg'

// ── Timing (ms) ─────────────────────────────────────────────
// MIN_SHOW   : minimum time the loading screen stays visible — the page
//              must not dismiss it before this even if Vue mounted fast.
// FADE_MS    : fade-out duration (matches the CSS transition below).
// HARD_CAP   : absolute safety cap; the screen always leaves by this time.
const MIN_SHOW = 3000
const FADE_MS = 500
const HARD_CAP = 12000

const APP_SKELETON_CSS
  = '<style id="az-loading-style">'
    + '#loading-box{user-select:none;-webkit-user-select:none}'
    + '#loading-box .loading-bg{display:flex;width:100%;height:100%;position:fixed;'
    + 'background:var(--va-c-bg,#f7f9fe);z-index:1001;opacity:1;overflow:hidden;'
    + 'transition:opacity .5s;align-items:center;justify-content:center}'
    + '#loading-box .loading-img{width:100px;height:100px;border-radius:50%;margin:auto;'
    + 'border:4px solid #f0f0f2;animation-duration:.2s;animation-name:az-loading-action;'
    + 'animation-iteration-count:infinite;animation-direction:alternate;object-fit:cover}'
    + '#loading-box .loading-image-dot{width:30px;height:30px;background:#6bdf8f;'
    + 'position:absolute;border-radius:50%;border:6px solid #fff;top:50%;left:50%;'
    + 'transform:translate(18px,24px)}'
    + '#loading-box .loading-img{opacity:0;transition:opacity .15s}'
    + '#loading-box .loading-img.az-ready{opacity:1}'
    + '#loading-box .az-ring{position:absolute;width:100px;height:100px;margin:auto;'
    + 'border:4px solid rgba(73,177,245,.25);border-top-color:#49b1f5;border-radius:50%;'
    + 'animation:az-spin .8s linear infinite;box-shadow:0 0 0 4px #f0f0f2}'
    + '#loading-box .az-ring.done{display:none}'
    + '#loading-box.loaded .loading-bg{opacity:0;z-index:-1000;pointer-events:none}'
    + '@keyframes az-loading-action{0%{opacity:1}100%{opacity:.4}}'
    + '@keyframes az-show-loading{from{opacity:0}to{opacity:1}}'
    + '@keyframes az-spin{to{transform:rotate(360deg)}}'
    + '@media (prefers-reduced-motion:reduce){#loading-box .loading-img,#loading-box .az-ring{animation:none}}'
    + '</style>'

const APP_SKELETON
  = '<link rel="preload" as="image" href="' + LOADING_AVATAR + '">'
    + '<div id="loading-box" onclick="this.classList.add(\'loaded\')">'
    + '<div class="loading-bg">'
    + '<div class="az-ring" aria-hidden="true"></div>'
    + `<img class="loading-img" alt="加载头像" src="${LOADING_AVATAR}">`
    + '<div class="loading-image-dot"></div>'
    + '</div>'
    + APP_SKELETON_CSS
    + '<script>(function(){'
    + 'var b=document.getElementById("loading-box");'
    + 'if(!b)return;'
    // Keep the <style> in <head> — Vue strips style tags inside #app on
    // hydration, which would unfix the overlay and dump it in the flow.
    + 'var st=document.getElementById("az-loading-style");'
    + 'if(st)document.head.appendChild(st);'
    // t0 = when the AVATAR becomes visible, not navigation start. On Asian
    // links to the CF edge the image itself can take seconds; timing from
    // navigation would leave users staring at an empty ring that "flashes
    // away" right when the avatar finally shows up.
    + 'var t0=Date.now(),avatarSeen=false;'
    + 'var img=b.querySelector(".loading-img");'
    + 'var ring=b.querySelector(".az-ring");'
    + 'function markAvatar(){if(!avatarSeen){avatarSeen=true;t0=Date.now();'
    + 'if(ring)ring.classList.add("done");'
    + 'if(img)img.classList.add("az-ready")}}'
    + 'if(img){if(img.complete&&img.naturalWidth>0)markAvatar();else{img.addEventListener("load",markAvatar);img.addEventListener("error",markAvatar)}}'
    + 'var done=false;'
    // end() honours MIN_SHOW measured from avatar visibility.
    + 'function end(){if(done)return;done=true;'
    + `var wait=Math.max(0,${MIN_SHOW}-(Date.now()-t0));`
    + 'setTimeout(function(){b.classList.add("loaded");'
    + 'setTimeout(function(){b.remove();var s=document.getElementById("az-loading-style");if(s)s.remove()},'
    + `${FADE_MS})},wait)}`
    + 'window.addEventListener("load",end);'
    + `setTimeout(end,${HARD_CAP});`
    + 'b.addEventListener("click",end);'
    // Vue mount watch: once the overlay is no longer position:fixed its CSS
    // is gone from the hydrated DOM — remove it before it paints in flow.
    + 'var t=setInterval(function(){'
    + 'var bg=b.querySelector(".loading-bg");'
    + 'if(!bg||getComputedStyle(bg).position!=="fixed"){end();clearInterval(t)}},60);'
    + 'setTimeout(function(){clearInterval(t)},12000);'
    + '})();<\/script>'
    + '</div>'

/**
 * Inject the loading screen right before </body> — OUTSIDE #app.
 *
 * Inside #app it is at the mercy of Vue's hydration: depending on page
 * structure Vue may keep or drop unmatched nodes, which makes the minimum
 * display time unreliable (and once dropped mid-fade the overlay can land
 * in the document flow — the earlier "avatar in the footer" bug). Outside
 * #app, Vue never touches it; the inline watcher owns the full lifecycle.
 */
function withAppSkeleton(html) {
  if (!html.includes('</body>')) return html
  return html.replace('</body>', `${APP_SKELETON}</body>`)
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
function plainTextResponse(request, html, res, corsOrigin = null) {
  const headers = new Headers(res.headers)
  headers.delete('Content-Encoding')
  headers.delete('Content-Length')
  for (const [k, v] of Object.entries(SECURITY_HEADERS))
    headers.set(k, v)
  if (corsOrigin) withCors(headers, corsOrigin)
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

/**
 * CORS for the CDN-gateway speed test.
 *
 * gate.lwsnb.eu.cc probes candidate lines from the BROWSER (cross-origin
 * fetch). A line that doesn't answer with Access-Control-Allow-Origin is
 * rejected before any latency is measured, so it can never win the race —
 * with only strict lines configured every probe "fails" and the gateway
 * appears to hang forever. Echo the origin back only for known gateway
 * hosts; every other cross-origin request gets nothing, as before.
 */
const CORS_ALLOWED_ORIGINS = new Set([
  'https://gate.lwsnb.eu.cc',
  'https://lwsnb.eu.cc', // 裸域即将指向网关
])

function withCors(headers, origin) {
  if (origin && CORS_ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Vary', 'Origin')
  }
  return headers
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    const origin = request.headers.get('Origin')

    // ── Domain migration: legacy hosts → current host (301) ────
    if (REDIRECT_HOSTS.has(url.hostname)) {
      return Response.redirect(`https://${NEW_HOST}${path}${url.search}`, 301)
    }

    // ── Gateway speed test: preflight + CORS on HTML responses ──
    // The browser probe is a simple GET, but it is cross-origin, so add the
    // ACAO header on every HTML response we build below.
    const corsForGateway = CORS_ALLOWED_ORIGINS.has(origin || '')

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
          if (corsForGateway) withCors(headers, origin)
          return new Response(res.body, { status: res.status, headers })
        }
        return plainTextResponse(request, withAppSkeleton(withHeroPreload(await res.text(), path)), res, corsForGateway ? origin : null)
      }
    } catch {
      // ASSETS unavailable or threw — try index.html fallback below
    }

    // ── SPA fallback (admin, client-side routes) ────────────────
    try {
      const res = await env.ASSETS.fetch(new Request(url.origin + '/index.html'))
      return plainTextResponse(request, withAppSkeleton(withHeroPreload(await res.text(), path)), res)
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  },
}
