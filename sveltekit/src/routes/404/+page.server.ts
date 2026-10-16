import type { PageServerLoad } from './$types'
import { buildSeo } from '#lib/seo'

/** 独立的 404 页面：静态宿主（CF Pages）会把它当作 not-found 文档 */
export const load: PageServerLoad = async () => ({
  seo: buildSeo({
    path: '/404/',
    title: '页面不存在',
    description: '您访问的页面不存在或已被移除。',
    noindex: true
  })
})
