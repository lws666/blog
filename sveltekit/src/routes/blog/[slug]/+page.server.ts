import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { fetchPost, fetchPosts } from '#lib/api'
import { buildSeo, countWords } from '#lib/seo'
import { renderMarkdown, extractToc, addHeadingIds } from '#lib/markdown'

/** 文章详情：SEO(含 BlogPosting) + 正文渲染 + TOC + 上下篇 */
export const load: PageServerLoad = async ({ fetch, params }) => {
  const slug = params.slug

  let post: Awaited<ReturnType<typeof fetchPost>>
  try {
    post = await fetchPost(fetch, slug)
  } catch (e) {
    const status = (e as { status?: number }).status
    if (status === 404) throw error(404, '文章不存在')
    throw error(502, '后端服务暂时不可用')
  }

  const html = addHeadingIds(renderMarkdown(post.content || ''))
  const toc = extractToc(html)

  const seo = buildSeo({
    path: `/blog/${slug}/`,
    title: post.title,
    description: post.excerpt || post.summary || undefined,
    image: post.cover || undefined,
    type: 'article',
    article: {
      publishedTime: post.date,
      // updated 为空时回退到发布日期（改良：acofork 完全不输出 dateModified）
      modifiedTime: post.updated || post.date,
      tags: (post.tags ?? []).map((t: unknown) => String(t).replace(/"/g, '')),
      section: post.categories?.[0] ? String(post.categories[0]).replace(/"/g, '') : undefined,
      wordCount: countWords(post.content || '')
    }
  })

  // 上下篇：从最新列表中定位相邻文章
  let prev = null as null | { slug: string, title: string }
  let next = null as null | { slug: string, title: string }
  try {
    const list = (await fetchPosts(fetch, { page: 1, limit: 50 })).posts
    const i = list.findIndex((p: { slug: string }) => p.slug === slug)
    if (i >= 0) {
      // 列表为新->旧：prev 是更新的那篇，next 是更旧的那篇
      prev = list[i - 1] ? { slug: list[i - 1].slug, title: list[i - 1].title } : null
      next = list[i + 1] ? { slug: list[i + 1].slug, title: list[i + 1].title } : null
    }
  } catch {
    /* 拿不到相邻文章不影响正文 */
  }

  return { seo, post, html, toc, prev, next }
}
