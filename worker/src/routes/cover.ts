import { Hono } from 'hono'
import { createB2Client } from '../b2'
import { createAuthMiddleware } from '../middleware/auth'
import { success, error as errRes } from '../utils/response'
import type { Env } from '../index'

/**
 * Agnes AI article-cover generation (free image API).
 *
 *   POST /api/cover   — generate a cover, store it in B2, return its URL
 *
 * Requires Bearer token (same UPLOAD_TOKEN as the rest of the admin API).
 *
 * Body (JSON):
 *   title   - post title, drives the prompt
 *   tags    - string[] or "[a, b]" string (optional)
 *   excerpt - short description (optional)
 *   slug    - used for the B2 object name (optional)
 *   prompt  - full custom prompt, overrides the generated one (optional)
 *   size    - "1024x768" (default) | "1024x1024"
 *
 * Flow: build prompt → Agnes AI → download image → B2 `covers/…`
 * → public URL served by GET /cover/* on this worker (img.lwsnb.eu.cc).
 */

const AGNES_ENDPOINT = 'https://apihub.agnes-ai.com/v1/images/generations'
const AGNES_MODEL = 'agnes-image-2.1-flash'
/** Documented landscape tier — fits blog cards without heavy cropping */
const DEFAULT_SIZE = '1024x768'
/** B2 prefix for generated covers (mirrored publicly by /cover/*) */
const COVER_PREFIX = 'covers/'
/** Public host that fronts this worker for images */
const IMAGE_HOST = 'https://img.lwsnb.eu.cc'

export interface CoverOptions {
  title?: string
  tags?: string | string[]
  excerpt?: string
  slug?: string
  prompt?: string
  /** Extra style/content hint, replaces the default style line */
  style?: string
  size?: string
}

export interface CoverResult {
  url: string
  key: string
  prompt: string
  model: string
}

/** Accept tags as an array, a JSON array string, or "a, b" */
function normalizeTags(tags?: string | string[]): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.filter(Boolean).map(String)
  const raw = String(tags).trim().replace(/^\[|\]$/g, '')
  if (!raw) return []
  return raw
    .split(',')
    .map(t => t.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

/**
 * Build the cover-art prompt from post metadata.
 *
 * Text is explicitly excluded: image models render glyphs as garbage, and
 * the post title already appears next to the cover in the UI.
 */
export function buildCoverPrompt(o: CoverOptions): string {
  const tags = normalizeTags(o.tags)
  const style = o.style?.trim()
    ? `风格与内容要求：${o.style.trim()}。横向构图，高清细节。`
    : '风格：现代扁平化插画，科技感，柔和渐变背景，构图简洁留白，主体居中，'
      + '横向构图，高清细节，色彩和谐，适合作为博客横幅封面。'
  const parts = [
    '为一篇中文技术博客文章生成封面插图。',
    o.title ? `文章标题：《${o.title}》。` : '',
    tags.length ? `主题标签：${tags.join('、')}。` : '',
    o.excerpt ? `内容概要：${o.excerpt.slice(0, 200)}。` : '',
    style,
    '画面中不要出现任何文字、字母、数字或水印。',
  ]
  return parts.filter(Boolean).join('')
}

/** Turn a slug/title into a safe ASCII object name */
function safeName(slug?: string): string {
  const base = String(slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'cover'
}

/**
 * Generate a cover image and store it in B2.
 * Throws with a human-readable (Chinese) message on any failure so the
 * admin UI and the auto-cover path can surface it directly.
 */
export async function generateCoverImage(env: Env, o: CoverOptions): Promise<CoverResult> {
  const apiKey = env.AGNES_API_KEY
  if (!apiKey) {
    throw new Error('Agnes AI 未配置：请为 Worker 设置 AGNES_API_KEY 密钥')
  }
  if (!o.title && !o.prompt) {
    throw new Error('缺少文章标题，无法生成封面')
  }

  const prompt = o.prompt?.trim() || buildCoverPrompt(o)

  const res = await fetch(AGNES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: AGNES_MODEL,
      prompt,
      size: o.size || DEFAULT_SIZE,
      // NOTE: response_format must sit inside extra_body — a top-level
      // field is rejected by this API.
      extra_body: { response_format: 'url' },
    }),
  })

  const text = await res.text()
  let json: {
    error?: { message?: string }
    data?: Array<{ url?: string, b64_json?: string }>
  }
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`Agnes AI 返回异常：${text.slice(0, 200)}`)
  }

  if (!res.ok || json.error) {
    throw new Error(`Agnes AI 生成失败：${json.error?.message || `HTTP ${res.status}`}`)
  }

  const item = json.data?.[0]
  if (!item) {
    throw new Error('Agnes AI 未返回图片数据')
  }

  let bytes: ArrayBuffer
  let contentType = 'image/png'

  if (item.url) {
    // Result URLs are temporary — mirror the bytes into B2 immediately.
    const img = await fetch(item.url)
    if (!img.ok) {
      throw new Error(`图片下载失败：HTTP ${img.status}`)
    }
    contentType = img.headers.get('content-type') || contentType
    bytes = await img.arrayBuffer()
  } else if (item.b64_json) {
    const bin = atob(item.b64_json)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    bytes = arr.buffer
  } else {
    throw new Error('Agnes AI 返回格式不支持（既无 url 也无 b64_json）')
  }

  const ext = /jpe?g/.test(contentType) ? 'jpg' : 'png'
  // Timestamped so regenerating a cover never collides with the old
  // (immutably cached) object.
  const key = `${COVER_PREFIX}${safeName(o.slug || o.title)}-${Date.now()}.${ext}`

  const b2 = createB2Client(env)
  await b2.upload(key, bytes, contentType)

  return {
    url: `${IMAGE_HOST}/cover/${key.slice(COVER_PREFIX.length)}`,
    key,
    prompt,
    model: AGNES_MODEL,
  }
}

/**
 * Write a generated cover into the markdown frontmatter.
 * Keeps the cover in the post source (B2) so a later republish does not
 * lose it — upload.ts would otherwise overwrite the D1 cover with ''.
 */
export function withCoverFrontmatter(markdown: string, url: string): string {
  const fm = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fm) {
    return `---\ncover: "${url}"\n---\n\n${markdown}`
  }
  const body = fm[1]
  const next = /^cover:.*$/m.test(body)
    ? body.replace(/^cover:.*$/m, `cover: "${url}"`)
    : `cover: "${url}"\n${body}`
  return markdown.replace(fm[0], `---\n${next}\n---`)
}

export function createCoverRouter() {
  const router = new Hono<{ Bindings: Env }>()

  // ── Auth middleware (same token as the rest of the admin API) ──
  router.use('*', async (c, next) => {
    const rejected = createAuthMiddleware(c.env.UPLOAD_TOKEN)(c.req.raw)
    if (rejected) {
      const body = await rejected.json()
      return c.json(body, rejected.status as 401)
    }
    await next()
  })

  // ── Generate ────────────────────────────────────────────────
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<CoverOptions>()
      const result = await generateCoverImage(c.env, body)
      return success(result, 201)
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  return router
}
