import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createDb } from './db'
import { createPostsRouter } from './routes/posts'
import { createUploadRouter } from './routes/upload'
import { createAdminRouter } from './routes/admin'
import { success, error as errRes } from './utils/response'

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

    let lines = `# lwsのblog
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
    const siteTitle = 'lwsのblog'
    const siteDesc = '一个普通人.'

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
