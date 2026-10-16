import { site } from '#lib/site'

/**
 * robots.txt —— 对齐 acofork 的极简写法（无 Disallow），
 * 但补上 sitemap 引用（保持同名约定）。
 */
export const prerender = true

export function GET() {
  const body = `User-agent: *
Allow: /

Sitemap: ${site.url}/sitemap.xml
`
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
