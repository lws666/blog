import { Hono } from 'hono'
import { createDb } from '../db'
import { createB2Client } from '../b2'
import { createAuthMiddleware } from '../middleware/auth'
import { resolveCredential } from '../auth'
import { success, badRequest, notFound, error as errRes } from '../utils/response'
import { summarizePost } from '../ai'
import { notifyIndexNow, notifyRebuild } from '../index'
import type { Env } from '../index'

/**
 * Admin API: protected routes for the management dashboard.
 *
 * POST   /api/admin/posts         — create / update a post
 * GET    /api/admin/posts         — list posts (including drafts)
 * GET    /api/admin/posts/:slug   — single post with content
 * DELETE /api/admin/posts/:slug   — delete a post
 *
 * Auth accepts these credential kinds, in one Authorization header:
 *   Bearer <UPLOAD_TOKEN>  — 管理员本尊；一切权限
 *   Bearer sess_…          — 用户会话：admin 全权；read 只读 / write 读写
 *   Bearer blg_…           — 旧版子令牌：read 只读 / write 读写
 *   子凭证不能访问 /tokens、/users（管理面）
 */
export function createAdminRouter() {
  const router = new Hono<{ Bindings: Env, Variables: { auth: { is_admin: boolean, scope: string } } }>()

  // ── Auth ─────────────────────────────────────────────────────
  // 管理员令牌 / 子令牌二选一；结果写入 c.set('auth')
  router.use('*', async (c, next) => {
    const authHeader = c.req.header('Authorization') || ''

    const plaintext = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!plaintext) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }

    // 统一凭证解析：UPLOAD_TOKEN / sess_ 会话 / blg_ 子令牌
    const cred = await resolveCredential(c.env.DB, c.env.UPLOAD_TOKEN, `Bearer ${plaintext}`)
    if (!cred) {
      return c.json({ success: false, error: 'Unauthorized' }, 401)
    }
    if (cred.kind === 'admin') {
      c.set('auth', { is_admin: true, scope: 'admin' })
    }
    else {
      const role = cred.role
      // 只读凭证不可写（这是权限边界，与 2FA 无关，始终生效）
      if (c.req.method !== 'GET' && role !== 'write') {
        return c.json({ success: false, error: '只读凭证无权执行写操作' }, 403)
      }
      c.set('auth', { is_admin: false, scope: role })
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
      const isDraft = body.draft === true
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
        draft: isDraft ? 1 : 0,
        hide: body.hide || '',
        comment: body.comment !== false ? 1 : 0,
        toc: body.toc !== false ? 1 : 0,
        nav: body.nav !== false ? 1 : 0,
        b2_key: b2Key,
        content: fullMarkdown,
        frontmatter: '{}',
      })

      // 发布后通知搜索引擎 + 触发静态站重建。
      // 注意：Workers 中「不 await 的 fetch」会在响应返回后被取消，
      // 导致 dispatch 偶发不生效，因此这里显式 await（失败不影响发布结果）。
      if (!isDraft) {
        await Promise.allSettled([
          notifyIndexNow(c.env, slug),
          notifyRebuild(c.env, slug),
        ])
      }

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
        summary: row.summary || '',
      })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── POST /posts/:slug/summary — generate AI summary ─────────
  router.post('/posts/:slug/summary', async (c) => {
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

      // Prefer the D1 copy, fall back to B2
      let content = row.content ?? ''
      if (!content && row.b2_key) {
        content = await b2.getText(row.b2_key)
      }

      if (!content.trim()) {
        return badRequest('Post has no content to summarise')
      }

      const result = await summarizePost(c.env.AI, { title: row.title, content })

      // Cache it so readers never wait on inference
      await db.updateSummary(slug, result.summary)

      return success({
        slug,
        summary: result.summary,
        model: result.model,
        neurons: result.neurons,
      })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── PUT /posts/:slug/summary — save an edited summary ───────
  router.put('/posts/:slug/summary', async (c) => {
    try {
      const db = createDb(c.env.DB)
      const slug = c.req.param('slug')

      if (!slug || slug.includes('/')) {
        return badRequest('Invalid slug')
      }

      const body = await c.req.json<{ summary?: string }>()
      if (typeof body.summary !== 'string') {
        return badRequest('summary must be a string')
      }

      const row = await db.getPostBySlugAdmin(slug)
      if (!row) {
        return notFound('Post not found')
      }

      await db.updateSummary(slug, body.summary.trim())

      return success({ slug, summary: body.summary.trim() })
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
