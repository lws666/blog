import type { PageServerLoad } from './$types'
import { fetchPosts } from '#lib/api'
import { buildSeo } from '#lib/seo'
import { aggregateTaxonomy } from '#lib/server/taxonomy'

/** 博客列表第一页 */
export const load: PageServerLoad = async ({ fetch }) => {
  const seo = buildSeo({
    path: '/blog/',
    title: '博客',
    description: '全部文章列表，按发布时间倒序，包含前端开发、Serverless 与日常折腾笔记。'
  })

  let posts: Awaited<ReturnType<typeof fetchPosts>>['posts'] = []
  let pagination = { page: 1, limit: 10, total: 0, total_pages: 1 }
  try {
    const res = await fetchPosts(fetch, { page: 1 })
    posts = res.posts
    pagination = res.pagination
  } catch {
    /* 后端不可用时展示空列表 */
  }

  return { seo, posts, pagination, currentPage: 1, ...aggregateTaxonomy(posts) }
}
