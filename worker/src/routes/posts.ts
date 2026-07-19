import { Hono } from 'hono'
import { createDb } from '../db'
import { createB2Client } from '../b2'
import { success, notFound, badRequest, error as errRes } from '../utils/response'
import type { PostListItem, PostDetail } from '../types'
import type { Env } from '../index'

/**
 * GET /api/posts          — list posts (paginated, filterable)
 * GET /api/posts/:slug    — single post with Markdown content
 */
export function createPostsRouter() {
  const router = new Hono<{ Bindings: Env }>()

  // ── List posts ──────────────────────────────────────────────
  router.get('/', async (c) => {
    try {
      const db = createDb(c.env.DB)
      const page = Math.max(1, Number(c.req.query('page')) || 1)
      const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 10))
      const category = c.req.query('category')
      const tag = c.req.query('tag')
      const keyword = c.req.query('keyword')

      const result = await db.listPosts({ page, limit, category, tag, keyword })

      const posts: PostListItem[] = result.posts.map((row) => ({
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
        hide: row.hide,
      }))

      return success({ posts, pagination: result.pagination })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── Single post ─────────────────────────────────────────────
  router.get('/:slug', async (c) => {
    try {
      const db = createDb(c.env.DB)
      const b2 = createB2Client(c.env)
      const slug = c.req.param('slug')

      if (!slug || slug.includes('/')) {
        return badRequest('Invalid slug')
      }

      const row = await db.getPostBySlug(slug)

      if (!row) {
        return notFound('Post not found')
      }

      // Get Markdown content: try D1 content field first, fallback to B2
      let content = row.content ?? ''

      if (!content && row.b2_key) {
        content = await b2.getText(row.b2_key)
      }

      const post: PostDetail = {
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
        hide: row.hide,
        content,
        frontmatter: safeJsonParse<Record<string, unknown>>(row.frontmatter, {}),
      }

      return success(post)
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
