import { defineValaxyConfig } from 'valaxy'
import type { UserThemeConfig } from 'valaxy-theme-yun'
import { addonWaline } from 'valaxy-addon-waline'

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

  // 2. 注册 Waline 插件并填入你的地址
  addons: [
    addonWaline({
      serverURL: 'https://waline.lwsnb.dpdns.org/', // 已自动填入你的地址
      pageview: true, // 开启浏览量统计
    }),
  ],

  theme: 'yun',

  themeConfig: {
    banner: {
      enable: true,
      title: 'lwsの博客',
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

