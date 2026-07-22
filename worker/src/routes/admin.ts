import { Hono } from 'hono'
import { createDb } from '../db'
import { createB2Client } from '../b2'
import { createAuthMiddleware } from '../middleware/auth'
import { success, badRequest, notFound, error as errRes } from '../utils/response'
import type { Env } from '../index'

/**
 * Admin API: protected routes for the management dashboard.
 *
 * POST   /api/admin/posts         — create / update a post
 * GET    /api/admin/posts         — list posts (including drafts)
 * GET    /api/admin/posts/:slug   — single post with content
 * DELETE /api/admin/posts/:slug   — delete a post
 *
 * All endpoints require a Bearer token matching UPLOAD_TOKEN.
 */
export function createAdminRouter() {
  const router = new Hono<{ Bindings: Env }>()

  // ── Auth ─────────────────────────────────────────────────────
  router.use('*', async (c, next) => {
    const rejected = createAuthMiddleware(c.env.UPLOAD_TOKEN)(c.req.raw)
    if (rejected) {
      const body = await rejected.json()
      return c.json(body, rejected.status as 401)
    }
    await next()
  })

  // ── GET /verify — lightweight token verification ────────────
  router.get('/verify', (c) => {
    // If we reach here, the auth middleware passed — token is valid
    return success({ verified: true })
  })

  // ── POST — publish / update a post ───────────────────────────
  router.post('/posts', async (c) => {
    try {
      const db = createDb(c.env.DB)
      const b2 = createB2Client(c.env)

      const body = await c.req.json<{
        slug: string
        title: string
        date?: string
        categories?: string[]
        tags?: string[]
        cover?: string
        excerpt?: string
        content?: string
        draft?: boolean
        type?: string
        top?: number
        hide?: string
        comment?: boolean
        toc?: boolean
        nav?: boolean
      }>()

      if (!body.slug || !body.title) {
        return badRequest('slug and title are required')
      }

      const slug = body.slug
      const date = body.date || new Date().toISOString().slice(0, 10)
      const categories = body.categories || []
      const tags = body.tags || []

      // Build full markdown with Valaxy-compatible frontmatter
      const fmParts: string[] = [
        `title: "${body.title.replace(/"/g, '\\"')}"`,
        `date: ${date}`,
      ]

      if (categories.length) {
        fmParts.push(`categories:\n${categories.map((c) => `  - "${c}"`).join('\n')}`)
      }
      if (tags.length) {
        fmParts.push(`tags:\n${tags.map((t) => `  - "${t}"`).join('\n')}`)
      }
      if (body.cover) fmParts.push(`cover: "${body.cover}"`)
      if (body.excerpt) fmParts.push(`excerpt: "${body.excerpt}"`)
      if (body.type && body.type !== 'post') fmParts.push(`type: ${body.type}`)
      if (body.top) fmParts.push(`top: ${body.top}`)
      if (body.hide) fmParts.push(`hide: "${body.hide}"`)

      const fullMarkdown = `---\n${fmParts.join('\n')}\n---\n\n${body.content || ''}`

      // Upload to B2
      const b2Key = `posts/${slug}/index.md`
      await b2.upload(b2Key, fullMarkdown, 'text/markdown')

      // Save to D1
      await db.upsertPost({
        slug,
        title: body.title,
        date,
        tags: JSON.stringify(tags),
        categories: JSON.stringify(categories),
        excerpt: body.excerpt || '',
        cover: body.cover || '',
        type: body.type || 'post',
        top: body.top || 0,
        draft: body.draft ? 1 : 0,
        hide: body.hide || '',
        comment: body.comment !== false ? 1 : 0,
        toc: body.toc !== false ? 1 : 0,
        nav: body.nav !== false ? 1 : 0,
        b2_key: b2Key,
        content: fullMarkdown,
        frontmatter: '{}',
      })

      return success({ slug, url: `/posts/${slug}` }, 201)
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── GET — list posts (including drafts) ──────────────────────
  router.get('/posts', async (c) => {
    try {
      const db = createDb(c.env.DB)
      const page = Math.max(1, Number(c.req.query('page')) || 1)
      const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 50))
      const keyword = c.req.query('keyword')

      const result = await db.listPosts({ page, limit, keyword, includeDrafts: true })

      const posts = result.posts.map((row) => ({
        slug: row.slug,
        title: row.title,
        date: row.date,
        updated: row.updated,
        tags: safeJsonParse<string[]>(row.tags, []),
        categories: safeJsonParse<string[]>(row.categories, []),
        excerpt: row.excerpt,
        cover: row.cover,
        type: row.type,
        top: row.top,
        draft: row.draft === 1,
        hide: row.hide,
      }))

      return success({ posts, pagination: result.pagination })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── GET /:slug — single post with content (including drafts) ─
  router.get('/posts/:slug', async (c) => {
    try {
      const db = createDb(c.env.DB)
      const b2 = createB2Client(c.env)
      const slug = c.req.param('slug')

      if (!slug || slug.includes('/')) {
        return badRequest('Invalid slug')
      }

      const row = await db.getPostBySlugAdmin(slug)

      if (!row) {
        return notFound('Post not found')
      }

      let content = row.content ?? ''
      if (!content && row.b2_key) {
        content = await b2.getText(row.b2_key)
      }

      return success({
        slug: row.slug,
        title: row.title,
        date: row.date,
        updated: row.updated,
        tags: safeJsonParse<string[]>(row.tags, []),
        categories: safeJsonParse<string[]>(row.categories, []),
        excerpt: row.excerpt,
        cover: row.cover,
        type: row.type,
        top: row.top,
        draft: row.draft === 1,
        hide: row.hide,
        content,
      })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── DELETE /:slug — delete a post (B2 + D1) ─────────────────
  router.delete('/posts/:slug', async (c) => {
    try {
      const db = createDb(c.env.DB)
      const b2 = createB2Client(c.env)
      const slug = c.req.param('slug')

      if (!slug || slug.includes('/')) {
        return badRequest('Invalid slug')
      }

      // Delete from B2 (best-effort)
      const b2Key = `posts/${slug}/index.md`
      try {
        await b2.delete(b2Key)
      } catch {
        // B2 file might not exist — continue
      }

      // Delete from D1
      await db.deletePost(slug)

      return success({ deleted: true })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  return router
}

function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}
