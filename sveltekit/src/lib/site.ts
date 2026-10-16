/**
 * 站点级配置 —— 与线上 www.lwsnb.eu.cc 保持一致（1:1 复刻）。
 *
 * 取值来源：站点 site.config.ts / valaxy.config.ts 与线上实测：
 *   title      谢谢の博客 - 一个普通人的技术博客
 *   author     权益 / 头像 img.lwsnb.eu.cc
 *   primary    #49b1f5        页面底 #f7f9fe
 *   nav 项     首页 归档 分类 标签 友链 关于（带 ri 图标）
 *   Hero       全屏背景图 + 大标题 + 每日一言（打字机）
 */

export const site = {
  /** 规范域名：canonical / og:url / sitemap 以此为准（与 Valaxy 版一致，带 www） */
  url: 'https://www.lwsnb.eu.cc',
  /** 站点标题（导航品牌与首页 title 用） */
  title: '谢谢の博客',
  /** 带副标题的完整站点名（首页 <title> 用） */
  titleFull: '谢谢の博客 - 一个普通人的技术博客',
  /** 站点名（JSON-LD / og:site_name） */
  name: '谢谢の博客',
  /** 标语 / Hero 副标题轮播 */
  taglines: ['树欲静而风不止', '君子不器。', '保持热爱，奔赴山海。'],
  /** 站点描述 */
  description:
    '一个普通人的技术博客，分享 Cloudflare、Valaxy、Vue、前端开发、AI 等领域的实践与思考。',
  lang: 'zh-CN',
  /** Hero 全屏背景图 */
  banner: 'https://img.lwsnb.eu.cc/file/1770349301804_DefualtThumbnail.jpg.webp',
  /** 作者信息 */
  author: {
    name: '权益',
    intro: '一个普通人的技术博客',
    avatar: 'https://img.lwsnb.eu.cc/file/1770349295364_IMG_20250823_144910_239.jpg',
    url: 'https://github.com/lws666',
    sameAs: ['https://github.com/lws666', 'https://m.bilibili.com/space/3493115176422328'],
  },
  /** 社交链接（侧栏作者卡图标） */
  social: [
    { name: 'RSS', href: '/rss.xml', icon: 'rss' },
    { name: 'GitHub', href: 'https://github.com/lws666', icon: 'github' },
    { name: '哔哩哔哩', href: 'https://m.bilibili.com/space/3493115176422328', icon: 'bilibili' },
  ],
  /** 导航菜单（顺序与图标对齐线上） */
  nav: [
    { href: '/', label: '首页', icon: 'home' },
    { href: '/archives/', label: '归档', icon: 'archive' },
    { href: '/categories/', label: '分类', icon: 'folder' },
    { href: '/tags/', label: '标签', icon: 'tag' },
    { href: '/links/', label: '友链', icon: 'link' },
    { href: '/about/', label: '关于', icon: 'user' },
  ],
  /** 公告（线上右栏第一张卡） */
  notice: '欢迎来到谢谢の博客，这里记录折腾代码与生活的日常。',
  /** 建站日期（"网站资讯"卡） */
  since: '2025-12-22',
  /** 音乐播放器（网易云歌单） */
  music: { api: 'https://music.lwsnb.eu.cc', id: '18318692237' },
  /** 社交预览图 */
  ogImage: '/social-preview.png',
  /** 后端 Worker API */
  apiBase: 'https://api.lwsnb.eu.cc',
  /** 图片 CDN */
  imageHost: 'https://img.lwsnb.eu.cc',
  /** 每页文章数 */
  postsPerPage: 10,
} as const

/** 拼接绝对 URL（canonical / og:url 必须绝对） */
export function absUrl(path: string): string {
  if (!path) return `${site.url}/`
  if (/^https?:\/\//.test(path)) return path
  return site.url + (path.startsWith('/') ? path : `/${path}`)
}

/** 规范化路径：统一带尾斜杠 */
export function canonicalPath(path: string): string {
  if (path === '/') return '/'
  const clean = path.split('?')[0].split('#')[0]
  return clean.endsWith('/') ? clean : `${clean}/`
}

/**
 * 页面标题：
 * 首页 -> "谢谢の博客 - 一个普通人的技术博客"（与线上完全一致）
 * 子页 -> "页面标题 | 谢谢の博客"
 */
export function pageTitle(title?: string): string {
  if (!title) return site.titleFull
  return `${title} | ${site.title}`
}
