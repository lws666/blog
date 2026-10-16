/**
 * 分类/标签聚合工具。
 *
 * 后端暂无独立聚合接口，故从文章列表聚合；
 * 计数为「当前列表范围内」的计数。
 */
import type { PostListItem } from '#lib/api'

export interface TaxonomyItem {
  name: string
  count: number
}

const clean = (v: unknown) => String(v).replace(/"/g, '').trim()

export function aggregateTaxonomy(posts: PostListItem[]): {
  categories: TaxonomyItem[]
  tags: TaxonomyItem[]
} {
  const cat = new Map<string, number>()
  const tag = new Map<string, number>()

  for (const p of posts) {
    for (const c of p.categories ?? []) {
      const n = clean(c)
      if (n) cat.set(n, (cat.get(n) ?? 0) + 1)
    }
    for (const t of p.tags ?? []) {
      const n = clean(t)
      if (n) tag.set(n, (tag.get(n) ?? 0) + 1)
    }
  }

  const sorted = (m: Map<string, number>) =>
    [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  return { categories: sorted(cat), tags: sorted(tag) }
}
