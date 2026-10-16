import type { PageServerLoad } from './$types'
import { buildSeo } from '#lib/seo'

export const load: PageServerLoad = async () => ({
  seo: buildSeo({
    path: '/links/',
    title: '友链',
    description: '友情链接与常逛的站点。'
  })
})
