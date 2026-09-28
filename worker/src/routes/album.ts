import { Hono } from 'hono'
import { createDb } from '../db'
import { createB2Client } from '../b2'
import { createAuthMiddleware } from '../middleware/auth'
import { requireTotp } from './totp'
import { success, badRequest, notFound, error as errRes } from '../utils/response'
import type { Env } from '../index'

/**
 * Album API — image management backed by Backblaze B2 + D1 `uploads` table.
 *
 * GET    /api/album/file/:key{.+}  — public image proxy (bucket stays private)
 * GET    /api/album               — list images        (auth)
 * POST   /api/album               — upload an image    (auth, multipart/form-data)
 * DELETE /api/album/:id           — delete an image    (auth)
 *
 * The B2 bucket is private, so images are streamed through this Worker
 * instead of being linked directly. Stored `url` is therefore a path on
 * this API host, which keeps B2 credentials server-side.
 */

/** Allowed image MIME types */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
])

/** Max upload size: 10 MB */
const MAX_SIZE = 10 * 1024 * 1024

export function createAlbumRouter() {
  const router = new Hono<{ Bindings: Env }>()

  // ── Public image proxy ──────────────────────────────────────
  // Registered before the auth middleware so <img src> works without a token.
  router.get('/file/:key{.+}', async (c) => {
    try {
      const key = c.req.param('key')

      if (!key || key.includes('..')) {
        return badRequest('Invalid key')
      }

      // Only serve keys inside the album prefix
      if (!key.startsWith('album/')) {
        return badRequest('Invalid key')
      }

      const b2 = createB2Client(c.env)
      const res = await b2.get(key)

      if (!res.ok) {
        return notFound('Image not found')
      }

      return c.newResponse(res.body, 200, {
        'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── Auth for every remaining route ──────────────────────────
  router.use('*', async (c, next) => {
    const rejected = createAuthMiddleware(c.env.UPLOAD_TOKEN, { allowTotp: true })(c.req.raw)
    if (rejected) {
      const body = await rejected.json()
      return c.json(body, rejected.status as 401)
    }
    await next()
  })

  // ── 2FA gate: writes need a TOTP session once enabled ───────
  router.use('*', async (c, next) => {
    if (c.req.method !== 'GET') {
      const denied = await requireTotp(c)
      if (denied) return denied
    }
    await next()
  })

  // ── List images ─────────────────────────────────────────────
  router.get('/', async (c) => {
    try {
      const db = createDb(c.env.DB)
      const page = Math.max(1, Number(c.req.query('page')) || 1)
      const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 50))

      const result = await db.listUploads({ page, limit })

      return success({
        images: result.uploads.map((row) => ({
          id: row.id,
          b2_key: row.b2_key,
          filename: row.filename,
          mime_type: row.mime_type,
          size: row.size,
          url: row.url,
          created_at: row.created_at,
        })),
        pagination: result.pagination,
      })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── Upload an image ─────────────────────────────────────────
  router.post('/', async (c) => {
    try {
      const form = await c.req.formData()
      const file = form.get('file')

      if (!file || typeof file === 'string') {
        return badRequest('file field is required (multipart/form-data)')
      }

      const mime = file.type || 'application/octet-stream'
      if (!ALLOWED_MIME.has(mime)) {
        return badRequest(`Unsupported type: ${mime}`)
      }

      if (file.size > MAX_SIZE) {
        return badRequest(`File too large (max ${MAX_SIZE / 1024 / 1024}MB)`)
      }

      if (file.size === 0) {
        return badRequest('Empty file')
      }

      // Build a collision-safe key: album/{timestamp}_{safe-name}
      const safeName = sanitizeFilename(file.name || 'image')
      const b2Key = `album/${Date.now()}_${safeName}`

      const b2 = createB2Client(c.env)
      const buffer = await file.arrayBuffer()
      await b2.upload(b2Key, buffer, mime)

      // Public URL goes through this Worker (bucket is private)
      const url = `/api/album/file/${b2Key}`

      const db = createDb(c.env.DB)
      const id = await db.insertUpload({
        b2_key: b2Key,
        filename: file.name || safeName,
        mime_type: mime,
        size: file.size,
        url,
      })

      return success({
        id,
        b2_key: b2Key,
        filename: file.name || safeName,
        mime_type: mime,
        size: file.size,
        url,
      }, 201)
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── Delete an image ─────────────────────────────────────────
  router.delete('/:id', async (c) => {
    try {
      const id = Number(c.req.param('id'))

      if (!Number.isInteger(id) || id <= 0) {
        return badRequest('Invalid id')
      }

      const db = createDb(c.env.DB)
      const row = await db.getUploadById(id)

      if (!row) {
        return notFound('Image not found')
      }

      // Remove from B2 first (best-effort: keep going if already gone)
      try {
        const b2 = createB2Client(c.env)
        await b2.delete(row.b2_key)
      } catch {
        // Object may already be absent — still drop the D1 record
      }

      await db.deleteUpload(id)

      return success({ deleted: true, id })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  return router
}

/**
 * Strip path separators and unsafe characters from an uploaded filename.
 */
function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'image'
  const cleaned = base
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/^[.-]+/, '')
  return cleaned.slice(0, 100) || 'image'
}
