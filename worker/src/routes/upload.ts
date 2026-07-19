import { Hono } from 'hono'
import { createDb } from '../db'
import { createB2Client } from '../b2'
import { createAuthMiddleware } from '../middleware/auth'
import { parseFrontmatter } from '../utils/markdown'
import { success, badRequest, error as errRes } from '../utils/response'
import type { Env } from '../index'

/**
 * POST /api/upload   — publish or update a post
 *
 * Requires Bearer token (set via UPLOAD_TOKEN secret).
 *
 * Body (JSON):
 *   slug      - URL slug (optional, falls back to frontmatter slug/path)
 *   markdown  - Full markdown with frontmatter
 *   cover     - Cover image URL (optional, overrides frontmatter)
 *
 * Process:
 *   1. Authenticate via Bearer token
 *   2. Parse frontmatter from markdown
 *   3. Upload markdown to B2
 *   4. Upsert metadata into D1
 */
export function createUploadRouter() {
  const router = new Hono<{ Bindings: Env }>()

  // ── Auth middleware ─────────────────────────────────────────
  router.use('*', async (c, next) => {
    const rejected = createAuthMiddleware(c.env.UPLOAD_TOKEN)(c.req.raw)
    if (rejected) {
      const body = await rejected.json()
      return c.json(body, rejected.status as 401)
    }
    await next()
  })

  // ── Upload ──────────────────────────────────────────────────
  router.post('/', async (c) => {
    try {
      const db = createDb(c.env.DB)
      const b2 = createB2Client(c.env)

      const body = await c.req.json<{
        slug?: string
        markdown: string
        cover?: string
      }>()

      if (!body.markdown) {
        return badRequest('markdown field is required')
      }

      // ── Parse frontmatter ──
      const { data: fm, content: mdBody } = parseFrontmatter(body.markdown)

      const slug = body.slug || (fm.slug as string) || (fm.path as string) || ''
      if (!slug) {
        return badRequest('slug is required (provide in body or frontmatter)')
      }

      // ── Upload to B2 ──
      const b2Key = `posts/${slug}/index.md`
      await b2.upload(b2Key, body.markdown, 'text/markdown')

      // ── Prepare D1 data ──
      const tags = Array.isArray(fm.tags)
        ? JSON.stringify(fm.tags)
        : typeof fm.tags === 'string'
          ? JSON.stringify([fm.tags])
          : '[]'

      const categories = Array.isArray(fm.categories)
        ? JSON.stringify(fm.categories)
        : typeof fm.categories === 'string'
          ? JSON.stringify([fm.categories])
          : '[]'

      // Collect extra frontmatter fields not in dedicated columns
      const dedicatedKeys = new Set([
        'slug', 'path', 'title', 'date', 'updated', 'tags', 'categories',
        'excerpt', 'cover', 'type', 'top', 'draft', 'hide', 'password',
        'encrypt', 'comment', 'toc', 'nav',
      ])
      const extraFm: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(fm)) {
        if (!dedicatedKeys.has(key)) {
          extraFm[key] = value
        }
      }

      // ── Write to D1 (with B2 key + full markdown for fast read) ──
      await db.upsertPost({
        slug,
        title: typeof fm.title === 'object' ? JSON.stringify(fm.title) : String(fm.title || ''),
        date: String(fm.date || new Date().toISOString().slice(0, 10)),
        updated: fm.updated ? String(fm.updated) : undefined,
        tags,
        categories,
        excerpt: String(fm.excerpt || ''),
        cover: body.cover || String(fm.cover || ''),
        type: String(fm.type || 'post'),
        top: Number(fm.top || 0),
        draft: fm.draft ? 1 : 0,
        hide: String(fm.hide || ''),
        password: fm.password ? String(fm.password) : undefined,
        encrypt: fm.encrypt ? 1 : 0,
        comment: fm.comment !== false ? 1 : 0,
        toc: fm.toc !== false ? 1 : 0,
        nav: fm.nav !== false ? 1 : 0,
        b2_key: b2Key,
        content: body.markdown,
        frontmatter: JSON.stringify(extraFm),
      })

      return success({ slug, url: `/posts/${slug}` }, 201)
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  return router
}
