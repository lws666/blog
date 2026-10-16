/**
 * 轻量 UI 多语言（仅界面文案；文章内容保持原文）。
 *
 * 默认中文；切换后写 localStorage('lang')，客户端挂载时读取。
 * 预渲染输出为中文（站点主要受众），切换是客户端行为。
 */
export type Lang = 'zh' | 'en'

const dict = {
  zh: {
    home: '首页', archives: '归档', categories: '分类', tags: '标签', links: '友链', about: '关于',
    notice: '公告', recent: '最新文章', music: '音乐', webinfo: '网站资讯',
    runningDays: '运行天数', postCount: '文章数目', createdAt: '创建于',
    blog: '博客', readMore: '查看全部文章', backToTop: '回到顶部',
    toggleTheme: '切换主题', toggleLang: '切换语言', toggleMusic: '音乐播放器',
    toc: '目录', prev: '上一篇', next: '下一篇', allPosts: '全部文章',
    tagsLabel: '标签', day: '天', post: '篇', empty: '暂无文章',
  },
  en: {
    home: 'Home', archives: 'Archives', categories: 'Categories', tags: 'Tags', links: 'Links', about: 'About',
    notice: 'Notice', recent: 'Recent Posts', music: 'Music', webinfo: 'Site Info',
    runningDays: 'Running', postCount: 'Posts', createdAt: 'Since',
    blog: 'Blog', readMore: 'View all posts', backToTop: 'Back to top',
    toggleTheme: 'Toggle theme', toggleLang: 'Switch language', toggleMusic: 'Music player',
    toc: 'Contents', prev: 'Previous', next: 'Next', allPosts: 'All posts',
    tagsLabel: 'Tags', day: 'days', post: 'posts', empty: 'No posts yet',
  },
} as const

export type Dict = typeof dict['zh']

export const i18n = $state({
  lang: 'zh' as Lang,
})

export function t(): Dict {
  return dict[i18n.lang]
}

/** 在客户端挂载时调用：读取已保存的语言 */
export function initLang(): void {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'zh') i18n.lang = saved
  } catch { /* 隐私模式忽略 */ }
}

export function toggleLang(): void {
  i18n.lang = i18n.lang === 'zh' ? 'en' : 'zh'
  try { localStorage.setItem('lang', i18n.lang) } catch { /* ignore */ }
  document.documentElement.setAttribute('lang', i18n.lang === 'zh' ? 'zh-CN' : 'en')
}
