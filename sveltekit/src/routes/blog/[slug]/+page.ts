import { fetchPosts } from '#lib/api'
import type { EntryGenerator } from './$types'

/**
 * 构建期枚举全部文章 slug（adapter-static 必需）。
 * acofork 的做法相同：articles 通过 entries() 枚举公开 slug。
 */
export const entries: EntryGenerator = async () => {
  const slugs: { slug: string }[] = []
  let page = 1
  let totalPages = 1
  try {
    do {
      const res = await fetchPosts(fetch, { page, limit: 50 })
      for (const p of res.posts) slugs.push({ slug: p.slug })
      totalPages = res.pagination?.total_pages ?? 1
      page += 1
    } while (page <= totalPages && page <= 20)
  } catch {
    // 构建时后端不可用：返回空数组，站点其余部分仍可构建
  }
  return slugs
}
