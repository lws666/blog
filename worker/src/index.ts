import { Hono } from 'hono'
import { cors } from 'hono/cors'
import MarkdownIt from 'markdown-it'
import { createDb } from './db'
import { createB2Client } from './b2'
import { createPostsRouter } from './routes/posts'
import { createUploadRouter } from './routes/upload'
import { createAdminRouter } from './routes/admin'
import { success, error as errRes } from './utils/response'
import { parseFrontmatter } from './utils/markdown'

// ── Environment bindings (set via wrangler.toml + secrets) ────
export interface Env {
  DB: D1Database
  B2_ENDPOINT: string
  B2_REGION: string
  B2_BUCKET: string
  B2_ACCESS_KEY_ID: string
  B2_SECRET_ACCESS_KEY: string
  UPLOAD_TOKEN: string
  /** Optional IndexNow API key (UUID). Set via `wrangler secret put INDEXNOW_KEY` */
  INDEXNOW_KEY?: string
}

// ── App ───────────────────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>()

// CORS: allow Valaxy frontend from any origin
app.use('*', cors())

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (c) => {
  return success({ status: 'ok', timestamp: new Date().toISOString() })
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
app.route('/api/posts', createPostsRouter())
app.route('/api/upload', createUploadRouter())
app.route('/api/admin', createAdminRouter())

// ── SEO: sitemap.xml ──────────────────────────────────────────
app.get('/sitemap.xml', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const result = await db.listPosts({ page: 1, limit: 9999 })
    const siteUrl = 'https://www.lwsnb.dpdns.org'

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
  const txt = `User-agent: *
Allow: /

Sitemap: https://api.lwsnb.dpdns.org/sitemap.xml
`
  return c.newResponse(txt, 200, { 'Content-Type': 'text/plain' })
})

// ── SEO: llms.txt ─────────────────────────────────────────────
app.get('/llms.txt', async (c) => {
  try {
    const db = createDb(c.env.DB)
    const result = await db.listPosts({ page: 1, limit: 9999 })
    const siteUrl = 'https://www.lwsnb.dpdns.org'

    let lines = `# 权益のblog
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
    const siteUrl = 'https://www.lwsnb.dpdns.org'
    const siteTitle = '权益のblog - 一个普通人的技术博客'
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
  const res = await fetch('https://www.lwsnb.dpdns.org/')
  if (!res.ok) throw new Error(`SPA fetch failed: ${res.status}`)
  spaHtml = await res.text()
  return spaHtml
}

/** Build a pre-rendered HTML page for the homepage */
function buildHomeHtml(posts?: Array<{ slug: string; title: string; date: string }>): string {
  const siteUrl = 'https://www.lwsnb.dpdns.org'
  const siteName = '权益のblog - 一个普通人的技术博客'

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
  "name": "权益のblog",
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
  </style>
</head>
<body>
  <h1>权益のblog</h1>
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
  const siteUrl = 'https://www.lwsnb.dpdns.org'
  const siteName = '权益のblog | 一个普通人的技术博客'
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
    let bodyHtml = md.render(fm.content)

    // Strip the first <h1> from the rendered markdown to avoid
    // duplicate h1 (the template already renders one via buildPostHtml).
    bodyHtml = bodyHtml.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/i, '')

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

  const postUrl = `https://www.lwsnb.dpdns.org/posts/${slug}`
  const keyLocation = 'https://www.lwsnb.dpdns.org/api/indexnow-key.txt'

  try {
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'www.lwsnb.dpdns.org',
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
