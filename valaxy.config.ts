import { defineValaxyConfig } from 'valaxy'
import type { UserThemeConfig } from 'valaxy-theme-yun'

// 定义 UnoCSS 图标安全列表
const safelist = [
  'i-ri-home-line',
]

export default defineValaxyConfig<UserThemeConfig>({
  // 1. 站点全局配置
  siteConfig: {
    comment: {
      enable: true // 开启评论功能总开关
    },
  },

  // 2. 评论系统：giscus（GitHub Discussions）
  //    在 components/GiscusComment.vue 中挂载，由 pages/posts/[slug].vue 引用。
  //    原 valaxy-addon-waline 已移除：Waline 服务端出现无限 308 重定向不可用。
  addons: [],

  theme: 'yun',

  themeConfig: {
    banner: {
      enable: true,
      title: '谢谢の博客',
      // Butterfly 风格首页 Hero 的全屏背景图（走 img.lwsnb.eu.cc 代理与边缘缓存）
      url: 'https://img.lwsnb.eu.cc/file/1770349301804_DefualtThumbnail.jpg.webp',
    },

    // 文章目录收录的标题层级（Valaxy 默认 [2, 4]）
    // 文章正文的标题在渲染时整体降一级（h1→h2，见 pages/posts/[slug].vue），
    // 这样页面里只有文章标题一个 h1；目录因此对应到降级后的 [2, 4]。
    outline: [2, 4],

    // 音乐播放器（自建 Meting API）
    // 换歌单只需改 id：网易云歌单页 URL 里 playlist?id= 后面的数字
    music: {
      enable: true,
      api: 'https://music.lwsnb.eu.cc',
      server: 'netease', // netease | tencent
      type: 'playlist', // playlist | song | album | artist
      id: '18318692237', // https://music.163.com/m/playlist?id=18318692237
      title: '音乐',
    },

    // 保留你原本的页面配置
    pages: [
      {
        name: '我的小伙伴们',
        url: '/links/',
        icon: 'i-ri-genderless-line',
        color: 'dodgerblue',
      },
      {
        name: '喜欢的女孩子',
        url: '/girls/',
        icon: 'i-ri-women-line',
        color: 'hotpink',
      },
    ],

    footer: {
      since: 2016,
      beian: {
        enable: false,
        icp: '苏ICP备17038157号',
        police: '苏公网安备xxxxxx号',
      },
    },
  },

  unocss: { safelist },

  // 3. 禁用依赖预扫描（Rolldown 1.x 扫描器存在竞态 bug）
  vite: {
    optimizeDeps: { noDiscovery: true, include: [] },

    server: {
      proxy: {
        '/api': {
          target: 'https://api.lwsnb.eu.cc',
          changeOrigin: true,
        },
      },
    },

    plugins: [
      {
        name: 'inject-seo-tags',
        transformIndexHtml(html) {
          // ── Static SEO fallback (visible to crawlers before Vue hydrates) ──
          // Valaxy's client/index.html template hardcodes lang="en"; the site
          // is Chinese, so the raw HTML advertised the wrong language to every
          // crawler and no-JS consumer (the runtime fixes it only after the
          // bundle loads). Rewrite it in the template we ship.
          const langFixed = html.replace('<html lang="en">', '<html lang="zh-CN">')

          const seoHead = `
            <title>谢谢の博客</title>
            <meta name="description" content="一个普通人.">
            <!-- Crawling parity with the reference implementation:
                 max-image-preview:large lets search results show the full-size
                 cover instead of a small thumbnail. Keep in sync with
                 site.config.ts (author.name). -->
            <meta name="robots" content="index,follow,max-image-preview:large">
            <meta name="author" content="权益">
            <meta name="color-scheme" content="light dark">
            <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
            <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
            <!-- Feed discovery: /rss.xml is served by blog-worker but was never
                 announced, so readers could not auto-detect it. -->
            <link rel="alternate" type="application/rss+xml" title="谢谢の博客" href="/rss.xml">
            <!-- Avatar speed: the sidebar avatar is only discovered ~2.3s in,
                 after the SPA mounts. Preconnecting + preloading it here lets
                 the browser fetch it in parallel with the JS bundles, so it
                 renders from cache the moment Vue mounts. Keep this URL in
                 sync with site.config.ts author.avatar. -->
            <link rel="preconnect" href="https://img.lwsnb.eu.cc">
            <link rel="preload" as="image" fetchpriority="high" href="https://img.lwsnb.eu.cc/file/1770349295364_IMG_20250823_144910_239.jpg">
            <!-- Hero 背景图（首页 LCP 元素）的预加载放在 worker 里按路径注入：
                 这个 transformIndexHtml 会作用于所有页面的 SPA 外壳，放在这里
                 会让文章页也白下载 337KB。见 src/index.js 的 HERO_PRELOAD。 -->
          `
          return langFixed.replace('</head>', `${seoHead}</head>`)
        }
      }
    ]
  }
})

