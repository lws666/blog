import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { fetchPosts } from '#lib/api'
import { buildSeo } from '#lib/seo'

/** 分类页：/categories/<name>/ */
export const load: PageServerLoad = async ({ fetch, params }) => {
  const name = decodeURIComponent(params.name)
  let posts: Awaited<ReturnType<typeof fetchPosts>>['posts'] = []
  try {
    posts = (await fetchPosts(fetch, { page: 1, limit: 50, category: name })).posts
  } catch {
    throw error(502, '后端服务暂时不可用')
  }

  return {
    name,
    posts,
    seo: buildSeo({
      path: `/categories/${encodeURIComponent(name)}/`,
      title: `分类：${name}`,
      description: `${name} 分类下的全部文章。`
    })
  }
}
