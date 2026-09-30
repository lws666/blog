import { Hono } from 'hono'
import { createDb } from '../db'
import { createB2Client } from '../b2'
import { resolveCredential } from '../auth'
import { requireTotp } from './totp'
import { parseFrontmatter } from '../utils/markdown'
import { createSvgCover, withCoverFrontmatter } from './cover'
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
  const router = new Hono<{ Bindings: Env, Variables: { auth: { is_admin: boolean, scope: string } } }>()

  // ── Auth middleware ─────────────────────────────────────────
  // 管理员本尊 / TOTP 会话 / 子令牌(write) 三种凭证；read 子令牌 403
  router.use('*', async (c, next) => {
    const authHeader = c.req.header('Authorization') || ''
    if (authHeader.startsWith('TOTP ')) {
      c.set('auth', { is_admin: true, scope: 'admin' })
      await next()
      return
    }
    const plaintext = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    const cred = plaintext ? await resolveCredential(c.env.DB, c.env.UPLOAD_TOKEN, `Bearer ${plaintext}`) : null
    if (!cred) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }
    const isAdmin = cred.kind === 'admin'
    const role = isAdmin ? 'admin' : cred.role
    if (!isAdmin && role !== 'write') {
      return c.json({ success: false, error: '只读凭证无权执行写操作' }, 403)
    }
    c.set('auth', { is_admin: isAdmin, scope: role })
    await next()
  })

  // ── 写操作门禁：read 子令牌一律 403；管理员需 2FA；write 子令牌放行
  router.use('*', async (c, next) => {
    const auth = c.get('auth') as { is_admin: boolean } | undefined
    if (c.req.method !== 'GET') {
      if (auth && !auth.is_admin) {
        return c.json({ success: false, error: '只读令牌无权执行写操作' }, 403)
      }
      const denied = await requireTotp(c)
      if (denied) return denied
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
        /** set false to skip the automatic Agnes AI cover */
        autoCover?: boolean
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

      // ── Cover: explicit > frontmatter > auto-generate ──
      let cover = body.cover || String(fm.cover || '')
      let markdown = body.markdown

      // Deterministic SVG cover — no AI quota and no third-party throttling,
      // so it succeeds where the old Agnes path frequently failed. The admin
      // panel rasterises it to PNG afterwards (social crawlers reject SVG).
      if (!cover && !fm.cover && body.autoCover !== false) {
        try {
          const gen = await createSvgCover(c.env, {
            tags: fm.tags as string | string[] | undefined,
            excerpt: fm.excerpt ? String(fm.excerpt) : undefined,
            title: fm.title ? String(fm.title) : undefined,
            slug,
          })
          cover = gen.url
          // Persist in the frontmatter too, otherwise a later republish
          // (which overwrites the D1 cover from frontmatter) loses it.
          markdown = withCoverFrontmatter(markdown, gen.url)
        } catch (e) {
          // A cover failure must never block publishing.
          console.warn('auto cover failed:', (e as Error).message)
        }
      }

      // ── Upload to B2 ──
      const b2Key = `posts/${slug}/index.md`
      await b2.upload(b2Key, markdown, 'text/markdown')

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
        cover: cover,
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
        content: markdown,
        frontmatter: JSON.stringify(extraFm),
      })

      return success({ slug, url: `/posts/${slug}` }, 201)
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  return router
}
