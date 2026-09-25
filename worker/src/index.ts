import { Hono } from 'hono'
import { cors } from 'hono/cors'
import MarkdownIt from 'markdown-it'
import { createDb } from './db'
import { createB2Client } from './b2'
import { createPostsRouter } from './routes/posts'
import { createUploadRouter } from './routes/upload'
import { createAdminRouter } from './routes/admin'
import { createAlbumRouter } from './routes/album'
import { createAuthRouter } from './routes/auth'
import { createTelegramRouter } from './routes/telegram'
import { createCoverRouter } from './routes/cover'
import { success, error as errRes } from './utils/response'
import { parseFrontmatter } from './utils/markdown'

// ── Environment bindings (set via wrangler.toml + secrets) ────
export interface Env {
  DB: D1Database
  /** Workers AI binding (see [ai] in wrangler.toml) */
  AI: Ai
  B2_ENDPOINT: string
  B2_REGION: string
  B2_BUCKET: string
  B2_ACCESS_KEY_ID: string
  B2_SECRET_ACCESS_KEY: string
  UPLOAD_TOKEN: string
  /** Optional IndexNow API key (UUID). Set via `wrangler secret put INDEXNOW_KEY` */
  INDEXNOW_KEY?: string
  /** GitHub OAuth app (admin "Sign in with GitHub"). Secret via `wrangler secret put GITHUB_CLIENT_SECRET` */
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  /** Telegram comment notifications (giscus → Telegram push). Secrets via `wrangler secret put` */
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
  /** HMAC secret used to verify the GitHub webhook signature */
  TG_WEBHOOK_SECRET?: string
  /**
   * Agnes AI image API key (free tier) — powers article cover generation.
   * Set via `wrangler secret put AGNES_API_KEY`.
   */
  AGNES_API_KEY?: string
}

// ── App ───────────────────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>()

// CORS: allow Valaxy frontend from any origin
app.use('*', cors())

// ── Domain migration: old host → new host (301) ────────────────
// lwsnb.dpdns.org → lwsnb.eu.cc. Must run before any route so every
// path (API, sitemap, RSS, pre-render) redirects with its query kept.
app.use('*', async (c, next) => {
  if (c.req.header('host') === 'api.lwsnb.dpdns.org') {
    const url = new URL(c.req.url)
    return c.redirect(`https://api.lwsnb.eu.cc${url.pathname}${url.search}`, 301)
  }
  await next()
})

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (c) => {
  return success({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Image proxy: /file/<name> → old image host ────────────────
// Backs img.lwsnb.eu.cc (a custom domain on this worker). The store
// behind img.lwsnb.dpdns.org is an external image bed on the owner's
// server (not B2 — the Valaxy bucket only holds post markdown and
// album/ files); proxying keeps it as the origin while the public
// URL moves to lwsnb.eu.cc. Upstream responses pass through with
// their own cache headers and the subrequest is edge-cached.
app.get('/file/*', async (c) => {
  const { pathname } = new URL(c.req.url)
  try {
    return await fetch(`https://img.lwsnb.dpdns.org${pathname}`, {
      cf: { cacheEverything: true, cacheTtl: 2678400 },
    })
  } catch {
    return c.text('Bad Gateway', 502)
  }
})

// ── Generated covers: /cover/<name> → B2 covers/ ──────────────
// Agnes AI generated covers are written to B2 by /api/cover and served
// here (publicly, immutably) on img.lwsnb.eu.cc. Object names are
// timestamped, so a URL's content never changes.
app.get('/cover/*', async (c) => {
  const name = decodeURIComponent(new URL(c.req.url).pathname.replace(/^\/cover\//, ''))
  if (!name || name.includes('..')) {
    return c.text('Not Found', 404)
  }
  try {
    const b2 = createB2Client(c.env)
    const res = await b2.get(`covers/${name}`)
    if (!res.ok || !res.body) {
      return c.text('Not Found', 404)
    }
    return c.newResponse(res.body, 200, {
      'Content-Type': res.headers.get('content-type') || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
  } catch {
    return c.text('Bad Gateway', 502)
  }
})

// ── Stats ─────────────────────────────────────────────────────
app.get('/api/stats', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const stats = await db.getStats()
    return success(stats)
  } catch (e) {
    return errRes((e as Error).message)
  }
})

// ── IndexNow key file ─────────────────────────────────────────
// Serves the key file so Bing can verify domain ownership.
// Registered before route groups to avoid routing conflicts.
app.get('/api/indexnow-key.txt', (c) => {
  const key = c.env.INDEXNOW_KEY
  if (!key) return errRes('IndexNow not configured', 404)
  return c.newResponse(key, { headers: { 'Content-Type': 'text/plain' } })
})

// ── Route groups ──────────────────────────────────────────────
// Auth router first: /api/auth/github does its own access control
// (GitHub OAuth identity check) and must bypass the Bearer middleware.
app.route('/api/auth', createAuthRouter())
// Telegram webhook does its own HMAC-signature access control
app.route('/api/tg', createTelegramRouter())
app.route('/api/posts', createPostsRouter())
app.route('/api/upload', createUploadRouter())
app.route('/api/admin', createAdminRouter())
app.route('/api/album', createAlbumRouter())
app.route('/api/cover', createCoverRouter())

// ── SEO: sitemap.xml ──────────────────────────────────────────
app.get('/sitemap.xml', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const result = await db.listPosts({ page: 1, limit: 9999 })
    const siteUrl = 'https://www.lwsnb.eu.cc'

    // Homepage
    const homeLastmod = result.posts.length
      ? (result.posts[0].updated || result.posts[0].date)
      : new Date().toISOString().slice(0, 10)

    const urls = [`  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${homeLastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`]

    // Posts
    for (const row of result.posts) {
      // Use updated_at (ISO) when available, fallback to updated/date
      const lastmod = row.updated_at
        ? row.updated_at.slice(0, 10)
        : (row.updated || row.date).slice(0, 10)
      urls.push(`  <url>
    <loc>${siteUrl}/posts/${escapeXml(row.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`)
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

    return c.newResponse(xml, 200, { 'Content-Type': 'application/xml' })
  } catch (e) {
    return errRes((e as Error).message)
  }
})

// ── SEO: robots.txt ───────────────────────────────────────────
app.get('/robots.txt', (c) => {
  // Point at the canonical host, not the API host: a sitemap served from a
  // different domain than the site needs separate verification and raises
  // "sitemap is on a different domain" warnings in Search Console.
  const txt = `User-agent: *
Allow: /

Sitemap: https://www.lwsnb.eu.cc/sitemap.xml
`
  return c.newResponse(txt, 200, { 'Content-Type': 'text/plain' })
})

// ── SEO: llms.txt ─────────────────────────────────────────────
app.get('/llms.txt', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const result = await db.listPosts({ page: 1, limit: 9999 })
    const siteUrl = 'https://www.lwsnb.eu.cc'

    let lines = `# 谢谢の博客
> 一个普通人.

## About
- [About](${siteUrl}/about/)
- [Site](${siteUrl}/about/site)

## Pages
- [Archives](${siteUrl}/archives/)
- [Categories](${siteUrl}/categories/)
- [Tags](${siteUrl}/tags/)
- [Links](${siteUrl}/links/)

## Posts
`
    for (const row of result.posts) {
      lines += `- [${escapeXml(row.title)}](${siteUrl}/posts/${escapeXml(row.slug)})\n`
    }

    return c.newResponse(lines, 200, { 'Content-Type': 'text/plain' })
  } catch (e) {
    return errRes((e as Error).message)
  }
})

// ── SEO: RSS feed ─────────────────────────────────────────────
app.get('/rss.xml', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const result = await db.listPosts({ page: 1, limit: 50 })
    const siteUrl = 'https://www.lwsnb.eu.cc'
    const siteTitle = '谢谢の博客 - 一个普通人的技术博客'
    const siteDesc = '一个普通人的技术博客，分享 Cloudflare、Valaxy、Vue、前端开发、AI 等领域的实践与思考。'

    const items = result.posts.map((row) => {
      const pubDate = new Date(row.date).toUTCString()
      return `  <item>
    <title>${escapeXml(row.title)}</title>
    <link>${siteUrl}/posts/${escapeXml(row.slug)}</link>
    <guid isPermaLink="true">${siteUrl}/posts/${escapeXml(row.slug)}</guid>
    <description>${escapeXml(row.excerpt || '')}</description>
    <pubDate>${pubDate}</pubDate>
  </item>`
    }).join('\n')

    const now = new Date().toUTCString()
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteTitle}</title>
    <link>${siteUrl}</link>
    <description>${siteDesc}</description>
    <language>zh-CN</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`

    return c.newResponse(xml, 200, { 'Content-Type': 'application/rss+xml' })
  } catch (e) {
    return errRes((e as Error).message)
  }
})

// ── SEO: Post pre-render ──────────────────────────────────────────
// Directly handles /posts/:slug — crawlers get server-rendered HTML,
// regular browsers get the SPA HTML passthrough.

/** Bot / social-media crawler UA patterns */
const BOT_RE = /googlebot|bingbot|baiduspider|yandexbot|duckduckbot|twitterbot|facebookexternalhit|slackbot|discordbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|dotbot|mj12bot|seznambot|qwantify|exabot|facebot|ia_archiver|twitter|facebook|linkedinbot|slack|pinterest|skypeuripreview|wget|curl|python-requests|java|http-client|perl|ruby|php|scrapy|python-urllib/i

function isBot(ua: string): boolean {
  return BOT_RE.test(ua)
}

/** Module-level SPA HTML cache (fetched from main domain on first miss) */
let spaHtml: string | null = null

/**
 * Return the SPA index.html (passthrough for regular browsers).
 * Fetched from the main domain once and cached in-memory.
 */
async function getSpaHtml(): Promise<string> {
  if (spaHtml) return spaHtml
  const res = await fetch('https://www.lwsnb.eu.cc/')
  if (!res.ok) throw new Error(`SPA fetch failed: ${res.status}`)
  spaHtml = await res.text()
  return spaHtml
}

/** Build a pre-rendered HTML page for the homepage */
function buildHomeHtml(posts?: Array<{ slug: string; title: string; date: string }>): string {
  const siteUrl = 'https://www.lwsnb.eu.cc'
  const siteName = '谢谢の博客 - 一个普通人的技术博客'

  const postList = (posts || [])
    .map(p => `    <li><a href="${siteUrl}/posts/${escapeXml(p.slug)}">${escapeXml(p.title)}</a> <small>${escapeXml(p.date)}</small></li>`)
    .join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(siteName)}</title>
  <meta name="description" content="一个普通人的技术博客，分享 Cloudflare、Valaxy、Vue、前端开发、AI 等领域的实践与思考。">
  <link rel="canonical" href="${siteUrl}/">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeXml(siteName)}">
  <meta property="og:description" content="一个普通人的技术博客，分享 Cloudflare、Valaxy、Vue、前端开发、AI 等领域的实践与思考。">
  <meta property="og:url" content="${siteUrl}/">
  <meta property="og:site_name" content="${escapeXml(siteName)}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeXml(siteName)}">
  <meta name="twitter:description" content="一个普通人的技术博客，分享 Cloudflare、Valaxy、Vue、前端开发、AI 等领域的实践与思考。">

  <!-- JSON-LD WebSite -->
  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "谢谢の博客",
  "url": "${siteUrl}",
  "description": "一个普通人的技术博客，分享 Cloudflare、Valaxy、Vue、前端开发、AI 等领域的实践与思考。"
}
  <\/script>

  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans SC',sans-serif;line-height:1.8;max-width:800px;margin:0 auto;padding:20px;color:#333;background:#fff}
    h1{font-size:2em;margin-bottom:.3em;line-height:1.3}
    h2{font-size:1.3em;margin-top:1.5em;border-bottom:1px solid #eee;padding-bottom:.3em}
    a{color:#0070f3;text-decoration:none}
    a:hover{text-decoration:underline}
    .desc{color:#666;font-size:1.1em;margin-bottom:2em}
    ul{list-style:none;padding:0}
    li{margin:.6em 0;line-height:1.6}
    small{color:#999;font-size:.85em}
    /* Mobile: keep the crawler render compact at 412px (Googlebot smartphone) */
    @media (max-width:640px){
      body{padding:12px;line-height:1.7;font-size:15px}
      h1{font-size:1.6em}
      h2{font-size:1.2em;margin-top:1.2em}
      .desc{font-size:1em;margin-bottom:1.2em}
      li{margin:.4em 0}
    }
  </style>
</head>
<body>
  <h1>谢谢の博客</h1>
  <p class="desc">一个普通人的技术博客，分享 Cloudflare、Valaxy、Vue、前端开发、AI 等领域的实践与思考。</p>

  <h2>最新文章</h2>
  <ul>
${postList}
  </ul>
</body>
</html>`
}

// ── Homepage pre-render route ─────────────────────────────────
app.get('/render/homepage', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const result = await db.listPosts({ page: 1, limit: 10 })
    return c.newResponse(buildHomeHtml(result.posts), 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'index, follow',
    })
  } catch (e) {
    console.error('Homepage pre-render error:', e)
    // Fallback: render without post list
    return c.newResponse(buildHomeHtml(), 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    })
  }
})

/** Build a pre-rendered HTML page for a blog post */
function buildPostHtml(data: {
  title: string
  description: string
  slug: string
  date: string
  updated: string
  tags: string[]
  categories: string[]
  cover: string
  bodyHtml: string
}): string {
  const siteUrl = 'https://www.lwsnb.eu.cc'
  const siteName = '谢谢の博客 | 一个普通人的技术博客'
  const absUrl = `${siteUrl}/posts/${data.slug}`
  const tagsJson = JSON.stringify(data.tags)
  const catsJson = JSON.stringify(data.categories)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeXml(data.title)} - ${siteName}</title>
  <meta name="description" content="${escapeXml(data.description || data.title)}">
  <link rel="canonical" href="${absUrl}">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeXml(data.title)}">
  <meta property="og:description" content="${escapeXml(data.description || data.title)}">
  <meta property="og:url" content="${absUrl}">
  <meta property="og:site_name" content="${siteName}">
  ${data.cover ? `<meta property="og:image" content="${escapeXml(data.cover)}">` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeXml(data.title)}">
  <meta name="twitter:description" content="${escapeXml(data.description || data.title)}">
  ${data.cover ? `<meta name="twitter:image" content="${escapeXml(data.cover)}">` : ''}

  <!-- JSON-LD (BlogPosting) -->
  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": ${JSON.stringify(data.title)},
  "description": ${JSON.stringify(data.description || data.title)},
  "url": "${absUrl}",
  "datePublished": "${data.date}",
  "dateModified": "${data.updated || data.date}",
  "author": {
    "@type": "Person",
    "name": "权益"
  },
  "keywords": ${tagsJson},
  "articleSection": ${catsJson}
  ${data.cover ? `,\n  "image": "${escapeXml(data.cover)}"` : ''}
}
  <\/script>

  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans SC',sans-serif;line-height:1.8;max-width:800px;margin:0 auto;padding:20px;color:#333;background:#fff}
    h1{font-size:1.8em;margin-bottom:.3em;line-height:1.3}
    h2,h3{line-height:1.3;margin-top:1.5em}
    a{color:#0070f3;text-decoration:none}
    a:hover{text-decoration:underline}
    img{max-width:100%;height:auto;border-radius:4px}
    pre{overflow-x:auto;background:#f5f5f5;padding:16px;border-radius:6px;font-size:.9em}
    code{background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:.9em}
    pre code{background:0 0;padding:0}
    blockquote{border-left:4px solid #ddd;margin:1em 0;padding:4px 16px;color:#666}
    blockquote p{margin:4px 0}
    table{border-collapse:collapse;width:100%;overflow-x:auto;display:block}
    th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
    th{background:#f5f5f5}
    hr{border:none;border-top:1px solid #eee;margin:2em 0}
    .meta{color:#666;font-size:.9em;margin-bottom:2em}
    .meta span{margin-right:12px}
    .tag{display:inline-block;background:#f0f0f0;padding:2px 8px;border-radius:3px;font-size:.85em;margin-right:4px;color:#555}
    .content h2{border-bottom:1px solid #eee;padding-bottom:.3em}
    .content ul,.content ol{padding-left:1.5em}
    .content li{margin:.3em 0}
    /* Mobile: the desktop spacing above (20px padding, 2em hr margins,
       1.8 line-height) makes Googlebot's 412px-wide smartphone render a
       needlessly tall page. Match the live site's mobile metrics instead. */
    @media (max-width:640px){
      body{padding:12px;line-height:1.7;font-size:15px}
      h1{font-size:1.5em}
      h2,h3{margin-top:1.2em}
      hr{margin:1.2em 0}
      pre{padding:12px;font-size:.85em}
      blockquote{margin:.8em 0;padding:2px 12px}
      .meta{margin-bottom:1.2em}
      .content ul,.content ol{padding-left:1.2em}
      th,td{padding:6px 8px}
    }
  </style>
</head>
<body>
  <article>
    <h1>${escapeXml(data.title)}</h1>
    <div class="meta">
      <span>📅 ${data.date}</span>
      ${data.updated ? `<span>🔄 ${data.updated}</span>` : ''}
      ${data.tags.length ? '<span>🏷 ' + data.tags.map(t => `<span class="tag">${escapeXml(t)}</span>`).join(' ') + '</span>' : ''}
    </div>
    <div class="content">
      ${data.bodyHtml}
    </div>
  </article>
</body>
</html>`
}

// ── Pre-render route ───────────────────────────────────────────
app.get('/posts/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    if (!slug || slug.includes('/')) {
      // Invalid slug → passthrough to SPA
      return c.newResponse(await getSpaHtml(), 200, {
        'Content-Type': 'text/html; charset=utf-8',
      })
    }

    const ua = c.req.header('User-Agent') || ''

    if (!isBot(ua)) {
      // Regular browser → serve SPA passthrough
      return c.newResponse(await getSpaHtml(), 200, {
        'Content-Type': 'text/html; charset=utf-8',
      })
    }

    // ── Search-engine crawler → pre-render ────────────────────
    const db = createDb(c.env.DB)
    const b2 = createB2Client(c.env)

    const row = await db.getPostBySlug(slug)
    if (!row) {
      // Post not found → SPA passthrough (Vue Router handles 404)
      return c.newResponse(await getSpaHtml(), 200, {
        'Content-Type': 'text/html; charset=utf-8',
      })
    }

    // Get raw Markdown content
    let rawMd = row.content ?? ''
    if (!rawMd && row.b2_key) {
      rawMd = await b2.getText(row.b2_key)
    }

    // Strip frontmatter, render body
    const fm = parseFrontmatter(rawMd)
    const md = new MarkdownIt({ html: true, linkify: true })
    // Auto-add alt text for images without alt (use article title as default)
    md.renderer.rules.image = (tokens, idx) => {
      const token = tokens[idx]
      const src = token.attrGet('src') || ''
      const alt = token.content || row.title || ''
      return `<img src="${escapeXml(src)}" alt="${escapeXml(alt)}" loading="lazy">`
    }

    // Demote every markdown heading by one level (# → h2, ## → h3, …) so
    // the post title (rendered as h1 by the template) is the ONLY h1 on
    // the page — search engines flag multiple h1s as an SEO issue (Bing
    // URL Inspection reported 12). Posts here write sections with `#`,
    // so all of them must shift down; the template styles h2/h3 already.
    const env = {}
    const tokens = md.parse(fm.content, env)
    for (const t of tokens) {
      if (t.type === 'heading_open' || t.type === 'heading_close') {
        const level = Number(t.tag.slice(1))
        if (level >= 1 && level <= 5) {
          t.tag = `h${level + 1}`
        }
      }
    }
    const bodyHtml = md.renderer.render(tokens, md.options, env)

    // Parse tags/categories from JSON strings
    const tags = safeJsonParse<string[]>(row.tags, [])
    const categories = safeJsonParse<string[]>(row.categories, [])

    const html = buildPostHtml({
      title: row.title,
      description: row.excerpt || '',
      slug,
      date: row.date,
      updated: row.updated,
      tags,
      categories,
      cover: row.cover,
      bodyHtml,
    })

    return c.newResponse(html, 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'index, follow, max-snippet:-1, max-image-preview:large',
    })
  } catch (e) {
    console.error('Pre-render error:', e)
    // Fallback: serve SPA
    try {
      return c.newResponse(await getSpaHtml(), 200, {
        'Content-Type': 'text/html; charset=utf-8',
      })
    } catch {
      return errRes((e as Error).message)
    }
  }
})

/** Parse JSON safely, return fallback on failure */
function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/**
 * Fire-and-forget IndexNow notification to Bing.
 * Called after a non-draft post is published or updated.
 */
export async function notifyIndexNow(env: Env, slug: string): Promise<void> {
  const key = env.INDEXNOW_KEY
  if (!key) return

  const postUrl = `https://www.lwsnb.eu.cc/posts/${slug}`
  const keyLocation = 'https://www.lwsnb.eu.cc/api/indexnow-key.txt'

  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'www.lwsnb.eu.cc',
        key,
        keyLocation,
        urlList: [postUrl],
      }),
    })
  } catch {
    // Fire-and-forget: silently ignore errors
  }
}

/** XML-escape a string */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ── 404 fallback ──────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ success: false, error: 'Not Found' }, 404)
})

// ── Global error handler ──────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ success: false, error: 'Internal Server Error' }, 500)
})

export default app
