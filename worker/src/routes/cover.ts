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
/** Fallback: runs on Cloudflare's own infra (no third-party rate limits) */
const WORKERS_AI_MODEL = '@cf/black-forest-labs/flux-1-schnell'
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
  /** Which engine actually produced the image */
  engine: 'agnes' | 'workers-ai'
}

interface ImageBytes {
  bytes: ArrayBuffer
  contentType: string
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** base64 → ArrayBuffer (Workers has no Buffer) */
function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr.buffer
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
 * Agnes AI text-to-image.
 *
 * Agnes rate-limits by client IP, and Cloudflare's shared Worker egress
 * IPs get hit by that often — the failure surfaces as a Cloudflare
 * "error code: 1015" text page instead of JSON. One short retry covers
 * the burst window; anything longer is left to the fallback engine.
 */
async function agnesGenerate(apiKey: string, prompt: string, size: string): Promise<ImageBytes> {
  let lastError = ''

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await sleep(4000)

    const res = await fetch(AGNES_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AGNES_MODEL,
        prompt,
        size,
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
      lastError = /1015/.test(text) ? 'Agnes AI 限流（1015）' : `Agnes AI 返回异常：${text.slice(0, 120)}`
      continue
    }

    if (!res.ok || json.error) {
      lastError = `Agnes AI 生成失败：${json.error?.message || `HTTP ${res.status}`}`
      continue
    }

    const item = json.data?.[0]
    if (!item) {
      lastError = 'Agnes AI 未返回图片数据'
      continue
    }

    if (item.url) {
      // Result URLs are temporary — mirror the bytes into B2 immediately.
      const img = await fetch(item.url)
      if (!img.ok) {
        lastError = `图片下载失败：HTTP ${img.status}`
        continue
      }
      return {
        bytes: await img.arrayBuffer(),
        contentType: img.headers.get('content-type') || 'image/png',
      }
    }
    if (item.b64_json) {
      return { bytes: fromBase64(item.b64_json), contentType: 'image/png' }
    }
    lastError = 'Agnes AI 返回格式不支持（既无 url 也无 b64_json）'
  }

  throw new Error(lastError || 'Agnes AI 生成失败')
}

/** Fallback engine: Cloudflare Workers AI (no external rate limits) */
async function workersAiGenerate(ai: Ai, prompt: string): Promise<ImageBytes> {
  const res = (await ai.run(WORKERS_AI_MODEL as never, {
    prompt,
    steps: 4,
  } as never)) as { image?: string }

  if (!res?.image) {
    throw new Error('Workers AI 未返回图片')
  }
  return { bytes: fromBase64(res.image), contentType: 'image/png' }
}

/**
 * Generate a cover image and store it in B2.
 *
 * Prefers Agnes AI, falls back to Workers AI when Agnes is unreachable
 * or rate-limiting this Worker's egress IP. Throws only when both fail.
 */
export async function generateCoverImage(env: Env, o: CoverOptions): Promise<CoverResult> {
  if (!o.title && !o.prompt) {
    throw new Error('缺少文章标题，无法生成封面')
  }

  const prompt = o.prompt?.trim() || buildCoverPrompt(o)
  const size = o.size || DEFAULT_SIZE

  let image: ImageBytes | null = null
  let model = AGNES_MODEL
  let engine: 'agnes' | 'workers-ai' = 'agnes'
  const errors: string[] = []

  if (env.AGNES_API_KEY) {
    try {
      image = await agnesGenerate(env.AGNES_API_KEY, prompt, size)
    } catch (e) {
      errors.push(`Agnes：${(e as Error).message}`)
    }
  } else {
    errors.push('Agnes：未配置 AGNES_API_KEY')
  }

  if (!image) {
    try {
      image = await workersAiGenerate(env.AI, prompt)
      model = WORKERS_AI_MODEL
      engine = 'workers-ai'
    } catch (e) {
      errors.push(`Workers AI：${(e as Error).message}`)
    }
  }

  if (!image) {
    throw new Error(`封面生成失败（${errors.join('；')}）`)
  }

  const ext = /jpe?g/.test(image.contentType) ? 'jpg' : 'png'
  // Timestamped so regenerating a cover never collides with the old
  // (immutably cached) object.
  const key = `${COVER_PREFIX}${safeName(o.slug || o.title)}-${Date.now()}.${ext}`

  const b2 = createB2Client(env)
  await b2.upload(key, image.bytes, image.contentType)

  return {
    url: `${IMAGE_HOST}/cover/${key.slice(COVER_PREFIX.length)}`,
    key,
    prompt,
    model,
    engine,
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
