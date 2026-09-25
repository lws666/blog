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
    },

    // 文章目录收录的标题层级（Valaxy 默认 [2, 4]）
    // 文章多用 h1 作主标题，默认值会把它们全部排除，故放宽到 h1
    outline: [1, 3],

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
          const seoHead = `
            <title>谢谢の博客</title>
            <meta name="description" content="一个普通人.">
            <!-- Avatar speed: the sidebar avatar is only discovered ~2.3s in,
                 after the SPA mounts. Preconnecting + preloading it here lets
                 the browser fetch it in parallel with the JS bundles, so it
                 renders from cache the moment Vue mounts. Keep this URL in
                 sync with site.config.ts author.avatar. -->
            <link rel="preconnect" href="https://img.lwsnb.eu.cc">
            <link rel="preload" as="image" fetchpriority="high" href="https://img.lwsnb.eu.cc/file/1770349295364_IMG_20250823_144910_239.jpg">
          `
          return html.replace('</head>', `${seoHead}</head>`)
        }
      }
    ]
  }
})

