import type { PageServerLoad } from './$types'
import { buildSeo } from '#lib/seo'
import { site } from '#lib/site'

export const load: PageServerLoad = async () => ({
  seo: buildSeo({
    path: '/about/',
    title: '关于',
    description: `关于 ${site.name} 与这个站点：作者、技术栈与联系方式。`
  })
})
