import { site, absUrl, canonicalPath } from '#lib/site'
import { fetchPosts } from '#lib/api'
import type { RequestHandler } from './$types'

/**
 * sitemap.xml —— 对齐 acofork 的结构：
 * - 单个 <urlset>（非 sitemap index）
 * - <url> 的唯一子元素是 <loc>
 * - 全部 URL 带尾斜杠
 * - 顺序：静态页在前，文章按时间倒序在后
 *
 * 改良：acofork 不输出 lastmod/changefreq/priority；这里同样不输出以保持一致。
 */
export const prerender = false

const STATIC_PATHS = ['/', '/blog/', '/about/', '/archives/', '/categories/', '/tags/', '/album/']

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, c =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[c] as string)
}

export const GET: RequestHandler = async ({ fetch }) => {
  const locs: string[] = STATIC_PATHS.map(p => absUrl(canonicalPath(p)))

  // 拉取全部文章（分页合并），最多 10 页安全上限
  let page = 1
  const limit = 50
  let totalPages = 1
  try {
    do {
      const res = await fetchPosts(fetch, { page, limit })
      for (const post of res.posts) {
        locs.push(absUrl(canonicalPath(`/blog/${post.slug}/`)))
      }
      totalPages = res.pagination?.total_pages ?? 1
      page += 1
    } while (page <= totalPages && page <= 10)
  } catch {
    // 后端不可用时仍返回静态页，避免整站 sitemap 500
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map(loc => `<url><loc>${escapeXml(loc)}</loc></url>`)
    .join('')}</urlset>`

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  })
}
