import { site, absUrl, canonicalPath } from '#lib/site'
import { fetchPosts, type PostListItem } from '#lib/api'
import type { RequestHandler } from './$types'

/**
 * rss.xml —— RSS 2.0，对齐 acofork：
 * - channel 只有 title/link/description/language 四个子元素
 * - 20 条 item，每条只有 title/link/guid(isPermaLink)/description/pubDate
 * - 摘要模式（无 content:encoded）
 * - pubDate 用 RFC-822（GMT）
 *
 * 改良：补 atom:link self 与 lastBuildDate（acofork 缺失，但属无害增强）。
 */
export const prerender = false

const ITEM_LIMIT = 20

const escapeXml = (s: string): string =>
  s.replace(/[<>&'"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c] as string)

/** 日期 -> RFC-822（acofork 用 00:00:00 GMT） */
function toRfc822(date: string): string {
  const d = new Date(`${(date || '').slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return new Date().toUTCString()
  return d.toUTCString()
}

export const GET: RequestHandler = async ({ fetch }) => {
  let posts: PostListItem[] = []
  try {
    posts = (await fetchPosts(fetch, { page: 1, limit: ITEM_LIMIT })).posts
  } catch {
    // 后端不可用时输出空 channel，保持 feed 合法
  }

  const items = posts
    .map((p) => {
      const link = absUrl(canonicalPath(`/blog/${p.slug}/`))
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(p.excerpt || p.title)}</description>
      <pubDate>${toRfc822(p.date)}</pubDate>
    </item>`
    })
    .join('\n')

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${site.name} 博客`)}</title>
    <link>${escapeXml(absUrl('/blog/'))}</link>
    <description>${escapeXml(site.description)}</description>
    <language>${site.lang}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(absUrl('/rss.xml'))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  })
}
