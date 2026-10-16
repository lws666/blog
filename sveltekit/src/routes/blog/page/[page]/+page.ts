import { fetchPosts } from '#lib/api'
import type { EntryGenerator } from './$types'

/** 枚举 2..total_pages 的分页路径（第 1 页是 /blog/） */
export const entries: EntryGenerator = async () => {
  try {
    const res = await fetchPosts(fetch, { page: 1, limit: 10 })
    const total = res.pagination?.total_pages ?? 1
    return Array.from({ length: Math.max(0, total - 1) }, (_, i) => ({ page: String(i + 2) }))
  } catch {
    return []
  }
}
