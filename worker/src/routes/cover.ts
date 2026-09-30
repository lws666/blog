import { Hono } from 'hono'
import { createB2Client } from '../b2'
import { resolveCredential } from '../auth'
import { requireTotp } from './totp'
import { success, badRequest, error as errRes } from '../utils/response'
import { buildCoverSvg, headlineFrom } from '../cover-svg'
import type { Env } from '../index'

/**
 * Article covers.
 *
 *   POST /api/cover        — build a cover, store it in B2, return its URL
 *                            (deterministic SVG by default, AI on request)
 *   POST /api/cover/raster — store the PNG the admin rasterised from that SVG
 *
 * Requires Bearer token (same UPLOAD_TOKEN as the rest of the admin API).
 *
 * Body (JSON):
 *   title   - post title (fallback headline / AI prompt)
 *   tags    - string[] or "[a, b]" string (icon row + label)
 *   excerpt - short description (fallback headline)
 *   text    - the one-liner headline on a deterministic cover
 *   slug    - used for the B2 object name
 *   engine  - 'svg' (default) | 'ai'
 *   prompt / style / size - AI engine only
 *
 * Public URL served by GET /cover/* on this worker (img.lwsnb.eu.cc).
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
  /**
   * Headline of a deterministic SVG cover.
   * Falls back to excerpt, then title.
   */
  text?: string
  /**
   * 'svg' (default) — white background, black type, real tech logos.
   *                   Deterministic, instant, zero AI quota.
   * 'ai'            — Agnes AI, falling back to Workers AI.
   */
  engine?: 'svg' | 'ai'
}

export interface CoverResult {
  url: string
  key: string
  prompt: string
  model: string
  /** Which engine actually produced the image */
  engine: 'agnes' | 'workers-ai' | 'svg'
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
  const clean = (t: string) => t.trim().replace(/^["']|["']$/g, '').trim()
  if (Array.isArray(tags)) {
    return tags
      .filter(Boolean)
      .map(String)
      // A single element may still hold "a ，b ，c" (full-width commas are
      // common in CJK tags), so split those too.
      .flatMap(t => clean(t).split(/[,，、;；]+/))
      .map(clean)
      .filter(Boolean)
  }
  const raw = String(tags).trim().replace(/^\[|\]$/g, '')
  if (!raw) return []
  return raw
    .split(/[,，、;；]+/)
    .map(clean)
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
 * Build and store a deterministic SVG cover.
 *
 * Shared by the admin endpoint and the auto-cover-on-publish path.
 * Consumes no AI quota and cannot be throttled by a third party, which is
 * why it replaced the AI path as the default.
 *
 * Note: SVG is right for every in-page use, but social crawlers reject it
 * for og:image — the admin panel rasterises it to PNG for that reason.
 */
export async function createSvgCover(
  env: Env,
  opts: { text?: string, tags?: string | string[], excerpt?: string, title?: string, slug?: string },
): Promise<CoverResult> {
  const tags = normalizeTags(opts.tags)
  // An explicit headline wins; otherwise the description carries it when it
  // reads like prose, and the title does when the description is just a
  // comma-separated list of technologies.
  const text = (opts.text || '').trim() || headlineFrom(opts.excerpt, opts.title)
  const svg = await buildCoverSvg({
    text,
    tags: tags.length ? tags : [text],
    excerpt: opts.excerpt,
    site: 'lwsnb.eu.cc',
  })
  const key = `${COVER_PREFIX}${safeName(opts.slug || opts.text)}-${Date.now()}.svg`
  const b2 = createB2Client(env)
  await b2.upload(key, svg, 'image/svg+xml')

  return {
    url: `${IMAGE_HOST}/cover/${key.slice(COVER_PREFIX.length)}`,
    key,
    prompt: text,
    model: 'deterministic-svg',
    engine: 'svg',
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

  // ── Generate ────────────────────────────────────────────────
  router.post('/', async (c) => {
    try {
      const body = await c.req.json<CoverOptions>()

      // Deterministic SVG (default): no AI, no quota, instant.
      if ((body.engine ?? 'svg') === 'svg') {
        const text = (body.text || '').trim()
        if (!text && !body.excerpt && !body.title) {
          return badRequest('缺少封面文案（text / excerpt / title 至少提供一个）')
        }
        const result = await createSvgCover(c.env, {
          text,
          tags: body.tags,
          excerpt: body.excerpt,
          title: body.title,
          slug: body.slug || body.title,
        })
        return success(result, 201)
      }

      const result = await generateCoverImage(c.env, body)
      return success(result, 201)
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── Store the rasterised PNG ────────────────────────────────
  // The admin draws the SVG onto a canvas and posts the PNG back: browsers
  // have the CJK fonts this edge runtime lacks, and PNG is what social
  // crawlers (og:image) accept — they cannot render SVG.
  router.post('/raster', async (c) => {
    try {
      const body = await c.req.json<{ svg?: string, png?: string }>()
      if (!body.svg || !body.png) {
        return badRequest('svg 与 png 均为必填')
      }
      // covers/foo-123.svg → covers/foo-123.png (same base name)
      const name = body.svg.split('/').pop()?.replace(/\.svg$/i, '') || ''
      if (!name || name.includes('..') || !/^[a-z0-9-]+$/i.test(name)) {
        return badRequest('svg 文件名不合法')
      }
      const base64 = body.png.replace(/^data:image\/png;base64,/, '')
      const bytes = fromBase64(base64)
      const key = `${COVER_PREFIX}${name}.png`
      const b2 = createB2Client(c.env)
      await b2.upload(key, bytes, 'image/png')
      return success({
        url: `${IMAGE_HOST}/cover/${name}.png`,
        key,
        engine: 'svg',
      }, 201)
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  return router
}
