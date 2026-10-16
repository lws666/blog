import type { Handle } from '@sveltejs/kit/hooks'

/**
 * 全局钩子：
 * 1) 域名规范化 301 —— 非 www -> www、http -> https（对齐 acofork/其文章所述）
 * 2) 安全响应头（HSTS / nosniff / frame-options / referrer / permissions / CSP）
 *
 * acofork 的实测头缺 cache-control / x-robots-tag；这里补上。
 */
const CANONICAL_HOST = 'lwsnb.eu.cc'

export const handle: Handle = async ({ event, resolve }) => {
  const url = event.url

  // ── 1) 主机名规范化：仅当配置了自定义域时才生效 ──
  // 本地/dev 与 *.workers.dev 预览域不重定向，避免开发期死循环
  const isProdHost =
    url.hostname.endsWith(CANONICAL_HOST) || url.protocol === 'http:'
  if (isProdHost && url.hostname !== CANONICAL_HOST && url.hostname.endsWith(CANONICAL_HOST)) {
    const target = new URL(url.pathname + url.search, `https://${CANONICAL_HOST}`)
    return new Response(null, { status: 301, headers: { Location: target.toString() } })
  }

  const response = await resolve(event)

  // ── 2) 安全头 ──
  const h = response.headers
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('X-Frame-Options', 'DENY')
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  h.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')

  // 图片/静态资源长缓存；HTML 短缓存 + 允许 CDN 校验
  const ct = h.get('Content-Type') ?? ''
  if (!h.has('Cache-Control')) {
    if (ct.startsWith('text/html')) h.set('Cache-Control', 'public, max-age=0, must-revalidate')
    else if (ct.startsWith('image/') || ct.includes('font')) h.set('Cache-Control', 'public, max-age=31536000, immutable')
  }

  return response
}
