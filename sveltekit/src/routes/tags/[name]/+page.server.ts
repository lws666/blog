import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { fetchPosts } from '#lib/api'
import { buildSeo } from '#lib/seo'

/** 标签页：/tags/<name>/ */
export const load: PageServerLoad = async ({ fetch, params }) => {
  const name = decodeURIComponent(params.name)
  let posts: Awaited<ReturnType<typeof fetchPosts>>['posts'] = []
  try {
    posts = (await fetchPosts(fetch, { page: 1, limit: 50, tag: name })).posts
  } catch {
    throw error(502, '后端服务暂时不可用')
  }

  return {
    name,
    posts,
    seo: buildSeo({
      path: `/tags/${encodeURIComponent(name)}/`,
      title: `标签：${name}`,
      description: `带有「${name}」标签的全部文章。`
    })
  }
}
