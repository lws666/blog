import type { PageServerLoad } from './$types'
import { fetchPosts } from '#lib/api'
import { buildSeo } from '#lib/seo'
import { aggregateTaxonomy } from '#lib/server/taxonomy'

export const load: PageServerLoad = async ({ fetch }) => {
  let posts: Awaited<ReturnType<typeof fetchPosts>>['posts'] = []
  try {
    posts = (await fetchPosts(fetch, { page: 1, limit: 50 })).posts
  } catch { /* 构建时后端不可用 */ }
  return {
    ...aggregateTaxonomy(posts),
    seo: buildSeo({ path: '/tags/', title: '标签', description: '按标签浏览全部文章。' })
  }
}
