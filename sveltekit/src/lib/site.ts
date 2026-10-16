/**
 * 站点级配置 —— SEO 的唯一事实来源（single source of truth）。
 *
 * 参考 www.acofork.com 的做法：
 * - 站点名用英文/自造词，避免与知名事物重名
 * - 每个页面标题都围绕主标题锚定（"页面 - 站点名"）
 * - description 每页都有，长度适中
 * - 一个规范化域名（www 与非 www 只保留一个，另一个 301）
 */

export const site = {
  /** 主域名：canonical / og:url / sitemap 一律以它为准（带协议，不带尾斜杠） */
  url: 'https://lwsnb.eu.cc',
  /** 站点名：用于 title 后缀与 JSON-LD name */
  name: 'Lwsnb',
  /** 站点副标题/标语 */
  tagline: '折腾代码，也记录生活',
  /** 站点描述：首页与兜底 description */
  description:
    'Lwsnb 的个人博客，记录前端开发、Serverless、Cloudflare Workers 与日常折腾经验，并提供在线工具与相册。',
  /** 语言 */
  lang: 'zh-CN',
  /** 作者信息：JSON-LD Person / author 用 */
  author: {
    name: 'lwsnb',
    alternateName: ['Lwsnb'],
    url: 'https://lwsnb.eu.cc',
    sameAs: ['https://github.com/lws666'],
  },
  /** 社交预览图（og:image 兜底） */
  ogImage: '/social-preview.png',
  /** 后端 Worker API 基址 */
  apiBase: 'https://api.lwsnb.eu.cc',
  /** 图片 CDN */
  imageHost: 'https://img.lwsnb.eu.cc',
  /** 每页文章数 */
  postsPerPage: 10,
} as const

/** 拼接绝对 URL（canonical / og:url 必须绝对） */
export function absUrl(path: string): string {
  if (!path) return site.url + '/'
  if (/^https?:\/\//.test(path)) return path
  return site.url + (path.startsWith('/') ? path : `/${path}`)
}

/** 规范化路径：blog 与博客子页统一带尾斜杠（与 acofork 一致） */
export function canonicalPath(path: string): string {
  if (path === '/') return '/'
  const clean = path.split('?')[0].split('#')[0]
  return clean.endsWith('/') ? clean : `${clean}/`
}

/**
 * 页面标题合成 —— 全站唯一入口。
 * 首页 -> "站点名 · 标语"
 * 子页 -> "页面标题 | 站点名"      （分隔符 " | " 与 acofork 一致）
 */
export function pageTitle(title?: string): string {
  if (!title) return `${site.name} · ${site.tagline}`
  return `${title} | ${site.name}`
}
