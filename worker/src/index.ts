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

// ── Route groups ──────────────────────────────────────────────
app.route('/api/posts', createPostsRouter())
app.route('/api/upload', createUploadRouter())
app.route('/api/admin', createAdminRouter())

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
