import type { PostRow, UploadRow } from './types'

/**
 * Query helpers for Cloudflare D1.
 */
export function createDb(db: D1Database) {

  /**
   * Build WHERE clause and bind params from filters.
   * Excludes drafts by default.
   */
  function buildWhere(opts: {
    slug?: string
    category?: string
    tag?: string
    keyword?: string
    includeDrafts?: boolean
  }): { clause: string; binds: unknown[] } {
    const conditions: string[] = []
    const binds: unknown[] = []

    if (!opts.includeDrafts) {
      conditions.push('draft = 0')
    }

    if (opts.slug) {
      conditions.push('slug = ?')
      binds.push(opts.slug)
    }

    if (opts.category) {
      conditions.push('categories LIKE ?')
      binds.push(`%"${opts.category}"%`)
    }

    if (opts.tag) {
      conditions.push('tags LIKE ?')
      binds.push(`%"${opts.tag}"%`)
    }

    if (opts.keyword) {
      conditions.push('(title LIKE ? OR excerpt LIKE ?)')
      binds.push(`%${opts.keyword}%`, `%${opts.keyword}%`)
    }

    return {
      clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      binds,
    }
  }

  return {

    /**
     * Paginated post list.
     */
    async listPosts(params: {
      page: number
      limit: number
      category?: string
      tag?: string
      keyword?: string
      includeDrafts?: boolean
    }) {
      const { page, limit } = params
      const offset = (page - 1) * limit

      const { clause, binds } = buildWhere({ ...params, includeDrafts: params.includeDrafts })

      // Count total
      const countRow = await db
        .prepare(`SELECT COUNT(*) as total FROM posts ${clause}`)
        .bind(...binds)
        .first<{ total: number }>()

      const total = countRow?.total ?? 0

      // Fetch page
      const { results: rows } = await db
        .prepare(`SELECT * FROM posts ${clause} ORDER BY top DESC, date DESC LIMIT ? OFFSET ?`)
        .bind(...binds, limit, offset)
        .all<PostRow>()

      return {
        posts: rows,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      }
    },

    /**
     * Get a single post by slug.
     */
    async getPostBySlug(slug: string): Promise<PostRow | null> {
      return db
        .prepare('SELECT * FROM posts WHERE slug = ? AND draft = 0')
        .bind(slug)
        .first<PostRow>()
    },

    /**
     * Get a single post by slug (including drafts, for admin).
     */
    async getPostBySlugAdmin(slug: string): Promise<PostRow | null> {
      return db
        .prepare('SELECT * FROM posts WHERE slug = ?')
        .bind(slug)
        .first<PostRow>()
    },

    /**
     * Insert or update a post.
     */
    async upsertPost(data: {
      slug: string
      title: string
      date: string
      updated?: string
      tags?: string
      categories?: string
      excerpt?: string
      cover?: string
      type?: string
      top?: number
      draft?: number
      hide?: string
      password?: string
      encrypt?: number
      comment?: number
      toc?: number
      nav?: number
      b2_key?: string
      content?: string | null
      frontmatter?: string
    }): Promise<void> {
      const now = new Date().toISOString()

      await db
        .prepare(`
          INSERT INTO posts (
            slug, title, date, updated, tags, categories,
            excerpt, cover, type, top, draft, hide,
            password, encrypt, comment, toc, nav,
            b2_key, content, frontmatter, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          )
          ON CONFLICT(slug) DO UPDATE SET
            title       = COALESCE(excluded.title, posts.title),
            date        = COALESCE(excluded.date, posts.date),
            updated     = COALESCE(excluded.updated, posts.updated),
            tags        = COALESCE(excluded.tags, posts.tags),
            categories  = COALESCE(excluded.categories, posts.categories),
            excerpt     = COALESCE(excluded.excerpt, posts.excerpt),
            cover       = COALESCE(excluded.cover, posts.cover),
            type        = COALESCE(excluded.type, posts.type),
            top         = COALESCE(excluded.top, posts.top),
            draft       = COALESCE(excluded.draft, posts.draft),
            hide        = COALESCE(excluded.hide, posts.hide),
            password    = COALESCE(excluded.password, posts.password),
            encrypt     = COALESCE(excluded.encrypt, posts.encrypt),
            comment     = COALESCE(excluded.comment, posts.comment),
            toc         = COALESCE(excluded.toc, posts.toc),
            nav         = COALESCE(excluded.nav, posts.nav),
            b2_key      = COALESCE(excluded.b2_key, posts.b2_key),
            content     = COALESCE(excluded.content, posts.content),
            frontmatter = COALESCE(excluded.frontmatter, posts.frontmatter),
            updated_at  = ?
        `)
        .bind(
          data.slug,
          data.title,
          data.date,
          data.updated ?? '',
          data.tags ?? '[]',
          data.categories ?? '[]',
          data.excerpt ?? '',
          data.cover ?? '',
          data.type ?? 'post',
          data.top ?? 0,
          data.draft ?? 0,
          data.hide ?? '',
          data.password ?? '',
          data.encrypt ?? 0,
          data.comment ?? 1,
          data.toc ?? 1,
          data.nav ?? 1,
          data.b2_key ?? '',
          data.content ?? null,
          data.frontmatter ?? '{}',
          now,
          now,
        )
        .run()
    },

    /**
     * Delete a post by slug.
     */
    async deletePost(slug: string): Promise<boolean> {
      const res = await db.prepare('DELETE FROM posts WHERE slug = ?').bind(slug).run()
      return res.success
    },

    /**
     * Update only the cached AI summary for a post.
     */
    async updateSummary(slug: string, summary: string): Promise<boolean> {
      const res = await db
        .prepare('UPDATE posts SET summary = ? WHERE slug = ?')
        .bind(summary, slug)
        .run()
      return res.success
    },

    /**
     * Paginated upload (album) list, newest first.
     */
    async listUploads(params: { page: number; limit: number }) {
      const { page, limit } = params
      const offset = (page - 1) * limit

      const countRow = await db
        .prepare('SELECT COUNT(*) as total FROM uploads')
        .first<{ total: number }>()

      const total = countRow?.total ?? 0

      const { results: uploads } = await db
        .prepare('SELECT * FROM uploads ORDER BY id DESC LIMIT ? OFFSET ?')
        .bind(limit, offset)
        .all<UploadRow>()

      return {
        uploads,
        pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      }
    },

    /**
     * Get a single upload record by id.
     */
    async getUploadById(id: number): Promise<UploadRow | null> {
      return db
        .prepare('SELECT * FROM uploads WHERE id = ?')
        .bind(id)
        .first<UploadRow>()
    },

    /**
     * Insert an upload record. Returns the new row id.
     */
    async insertUpload(data: {
      b2_key: string
      filename: string
      mime_type: string
      size: number
      url: string
    }): Promise<number> {
      const res = await db
        .prepare(`
          INSERT INTO uploads (b2_key, filename, mime_type, size, url)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(data.b2_key, data.filename, data.mime_type, data.size, data.url)
        .run()

      return Number(res.meta?.last_row_id ?? 0)
    },

    /**
     * Delete an upload record by id.
     */
    async deleteUpload(id: number): Promise<boolean> {
      const res = await db.prepare('DELETE FROM uploads WHERE id = ?').bind(id).run()
      return res.success
    },

    /**
     * Aggregate site-wide statistics.
     */
    async getStats(): Promise<{
      post_count: number
      category_count: number
      tag_count: number
    }> {
      const postCount = await db
        .prepare('SELECT COUNT(*) as count FROM posts WHERE draft = 0')
        .first<{ count: number }>()

      const catRows = await db
        .prepare("SELECT DISTINCT categories FROM posts WHERE draft = 0 AND categories != '[]'")
        .all<{ categories: string }>()

      const categories = new Set<string>()
      for (const r of catRows.results) {
        try { JSON.parse(r.categories).forEach((c: string) => categories.add(c)) } catch { /* skip */ }
      }

      const tagRows = await db
        .prepare("SELECT DISTINCT tags FROM posts WHERE draft = 0 AND tags != '[]'")
        .all<{ tags: string }>()

      const tags = new Set<string>()
      for (const r of tagRows.results) {
        try { JSON.parse(r.tags).forEach((t: string) => tags.add(t)) } catch { /* skip */ }
      }

      return {
        post_count: postCount?.count ?? 0,
        category_count: categories.size,
        tag_count: tags.size,
      }
    },
  }
}

export type DbClient = ReturnType<typeof createDb>
