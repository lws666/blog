import { fetchPosts } from '#lib/api'
import type { EntryGenerator } from './$types'

/** 枚举全部标签名 */
export const entries: EntryGenerator = async () => {
  const names = new Set<string>()
  try {
    let page = 1
    let totalPages = 1
    do {
      const res = await fetchPosts(fetch, { page, limit: 50 })
      for (const p of res.posts) {
        for (const t of p.tags ?? []) {
          const n = String(t).replace(/"/g, '').trim()
          if (n) names.add(n)
        }
      }
      totalPages = res.pagination?.total_pages ?? 1
      page += 1
    } while (page <= totalPages && page <= 20)
  } catch {
    /* 构建时后端不可用 */
  }
  return [...names].map(name => ({ name }))
}
