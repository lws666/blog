import type { PageServerLoad } from './$types'
import { fetchPosts } from '#lib/api'
import { buildSeo } from '#lib/seo'

/** 归档：按年份分组的全部文章 */
export const load: PageServerLoad = async ({ fetch }) => {
  const seo = buildSeo({
    path: '/archives/',
    title: '归档',
    description: '按时间归档的全部文章。'
  })

  let posts: Awaited<ReturnType<typeof fetchPosts>>['posts'] = []
  try {
    const res = await fetchPosts(fetch, { page: 1, limit: 50 })
    posts = res.posts
    // 若还有更多页，继续合并（上限 10 页）
    let p = 2
    while (p <= (res.pagination?.total_pages ?? 1) && p <= 10) {
      const more = await fetchPosts(fetch, { page: p, limit: 50 })
      posts = posts.concat(more.posts)
      p += 1
    }
  } catch {
    /* 忽略 */
  }

  // 按年分组
  const byYear = new Map<string, typeof posts>()
  for (const post of posts) {
    const year = (post.date || '').slice(0, 4) || '未知'
    if (!byYear.has(year)) byYear.set(year, [])
    byYear.get(year)!.push(post)
  }
  const groups = [...byYear].map(([year, list]) => ({ year, posts: list })).sort((a, b) => b.year.localeCompare(a.year))

  return { seo, groups, total: posts.length }
}
