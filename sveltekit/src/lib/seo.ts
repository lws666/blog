/**
 * SEO 元信息构建层：把页面数据翻译成 <svelte:head> 需要的标签集合，
 * 以及 JSON-LD 结构化数据。
 *
 * 对齐 acofork.com 的实测结论：
 * - canonical 绝对 URL、统一尾斜杠
 * - og:type 首页 website；文章页同样使用 website（该站如此），另用
 *   Article JSON-LD 表达文章语义
 * - twitter:card = summary_large_image
 * - robots: index,follow,max-image-preview:large
 * - JSON-LD 使用 @graph 挂 Person / WebSite / (BlogPosting) / BreadcrumbList
 */
import { site, absUrl, canonicalPath, pageTitle } from './site'

export interface SeoInput {
  /** 页面标题（不含站点名后缀） */
  title?: string
  description?: string
  /** 站内路径，如 /blog/hello/ */
  path: string
  /** 封面/社交图，可为绝对或相对 */
  image?: string
  type?: 'website' | 'article'
  /** 文章专用 */
  article?: {
    publishedTime?: string
    modifiedTime?: string
    tags?: string[]
    section?: string
    wordCount?: number
  }
  /** 不索引（如后台页面） */
  noindex?: boolean
}

export interface HeadMeta {
  title: string
  description: string
  canonical: string
  ogTitle: string
  ogDescription: string
  ogUrl: string
  ogType: string
  ogImage: string
  ogSiteName: string
  twitterCard: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
  robots: string
  publishedTime?: string
  modifiedTime?: string
  tags: string[]
  /** JSON-LD 对象（序列化后写入 head） */
  jsonLd: Record<string, unknown>
}

export function buildSeo(input: SeoInput): HeadMeta {
  const { title, description, path, image, type = 'website', article, noindex } = input
  const pageDescription = description || site.description
  const metaTitle = pageTitle(title)
  const canonical = absUrl(canonicalPath(path))
  const ogImage = image ? (image.startsWith('http') ? image : absUrl(image)) : absUrl(site.ogImage)

  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Person',
      '@id': `${site.url}/#person`,
      name: site.author.name,
      alternateName: site.author.alternateName,
      url: site.author.url,
      sameAs: site.author.sameAs,
    },
    {
      '@type': 'WebSite',
      '@id': `${site.url}/#website`,
      name: site.name,
      alternateName: site.author.alternateName,
      url: `${site.url}/`,
      inLanguage: site.lang,
      publisher: { '@id': `${site.url}/#person` },
    },
  ]

  if (article) {
    graph.push({
      '@type': 'BlogPosting',
      '@id': `${canonical}#article`,
      // 键序对齐 acofork 实测：@type,@id,headline,description,url,
      // inLanguage,author,publisher,mainEntityOfPage,datePublished,image
      headline: title,
      description: pageDescription,
      url: canonical,
      inLanguage: site.lang,
      author: { '@id': `${site.url}/#person` },
      publisher: { '@id': `${site.url}/#person` },
      mainEntityOfPage: canonical,
      ...(article.publishedTime ? { datePublished: article.publishedTime } : {}),
      ...(article.modifiedTime ? { dateModified: article.modifiedTime } : {}),
      image: ogImage,
      isPartOf: { '@id': `${site.url}/#website` },
    })
  }

  // 面包屑：首页 > (博客 >) 当前页
  const crumbs: Record<string, unknown>[] = [
    { '@type': 'ListItem', position: 1, name: '首页', item: `${site.url}/` },
  ]
  const depth = canonicalPath(path).split('/').filter(Boolean)
  if (depth.length > 1 && depth[0] === 'blog') {
    crumbs.push({ '@type': 'ListItem', position: 2, name: '博客', item: `${site.url}/blog/` })
    crumbs.push({ '@type': 'ListItem', position: 3, name: title ?? '', item: canonical })
  } else if (depth.length >= 1 && !article) {
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: title ?? '', item: canonical })
  }
  graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: crumbs,
  })

  // 非文章页补 WebPage
  if (!article) {
    graph.push({
      '@type': 'WebPage',
      '@id': canonical,
      url: canonical,
      name: metaTitle,
      description: pageDescription,
      inLanguage: site.lang,
      isPartOf: { '@id': `${site.url}/#website` },
    })
  }

  return {
    title: metaTitle,
    description: pageDescription,
    canonical,
    ogTitle: metaTitle,
    ogDescription: pageDescription,
    ogUrl: canonical,
    ogType: type,
    ogImage,
    ogSiteName: site.name,
    twitterCard: 'summary_large_image',
    twitterTitle: metaTitle,
    twitterDescription: pageDescription,
    twitterImage: ogImage,
    robots: noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large',
    publishedTime: article?.publishedTime,
    modifiedTime: article?.modifiedTime,
    tags: article?.tags ?? [],
    jsonLd: { '@context': 'https://schema.org', '@graph': graph },
  }
}

/** 简单估算中英混排字数（用于 JSON-LD wordCount） */
export function countWords(markdown: string): number {
  const text = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`_\-[\]()!]/g, ' ')
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const words = (text.match(/[A-Za-z0-9]+/g) || []).length
  return cjk + words
}
