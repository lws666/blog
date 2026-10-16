import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { fetchPosts } from '#lib/api'
import { buildSeo } from '#lib/seo'
import { aggregateTaxonomy } from '#lib/server/taxonomy'

/** 博客列表第 N 页：/blog/page/2/ */
export const load: PageServerLoad = async ({ fetch, params }) => {
  const page = Number(params.page)
  if (!Number.isInteger(page) || page < 2) throw error(404, '页面不存在')

  const seo = buildSeo({
    path: `/blog/page/${page}/`,
    title: `博客 · 第 ${page} 页`,
    description: `全部文章列表第 ${page} 页，按发布时间倒序。`
  })

  try {
    const res = await fetchPosts(fetch, { page })
    // 超出总页数 -> 真实 404（不学 acofork 的 soft 404）
    if (page > (res.pagination?.total_pages ?? 1)) throw error(404, '页面不存在')
    return { seo, posts: res.posts, pagination: res.pagination, currentPage: page, ...aggregateTaxonomy(res.posts) }
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e) throw e
    throw error(502, '后端服务暂时不可用')
  }
}
