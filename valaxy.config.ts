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
      title: 'lwsの博客',
    },

    // 音乐播放器（自建 Meting API）
    // 换歌单只需改 id：网易云歌单页 URL 里 playlist?id= 后面的数字
    music: {
      enable: true,
      api: 'https://music.lwsnb.dpdns.org',
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
        enable: true,
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
          target: 'https://api.lwsnb.dpdns.org',
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
            <title>lwsのblog</title>
            <meta name="description" content="一个普通人.">
          `
          return html.replace('</head>', `${seoHead}</head>`)
        }
      }
    ]
  }
})

