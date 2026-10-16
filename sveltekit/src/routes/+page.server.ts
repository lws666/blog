import type { PageServerLoad } from './$types'
import { fetchPosts, fetchStats } from '#lib/api'
import { buildSeo } from '#lib/seo'
import { site } from '#lib/site'
import { aggregateTaxonomy } from '#lib/server/taxonomy'

/** 首页：SEO + 最新文章 + 侧栏数据 */
export const load: PageServerLoad = async ({ fetch }) => {
  const seo = buildSeo({
    // 首页标题 = 站点名 + 标语（无后缀，与 acofork 首页一致）
    path: '/',
    description: site.description,
    type: 'website'
  })

  let recent: Awaited<ReturnType<typeof fetchPosts>>['posts'] = []
  let stats: Record<string, number> = {}
  try {
    const [postsRes, statsRes] = await Promise.all([
      fetchPosts(fetch, { page: 1, limit: 6 }),
      fetchStats(fetch).catch(() => ({}))
    ])
    recent = postsRes.posts
    stats = statsRes
  } catch {
    // 后端不可用不阻塞渲染（SEO 仍完整）
  }

  return { seo, recent, stats, ...aggregateTaxonomy(recent) }
}
