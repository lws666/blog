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

  // 3. 注入外部音乐播放器脚本
  vite: {
    plugins: [
      {
        name: 'inject-music-player',
        transformIndexHtml(html) {
          const playerScripts = `
            <script type="text/javascript" src="https://myhkw.cn/player/js/jquery.min.js"></script>
            <script type="text/javascript" id="myhk" src="https://myhkw.cn/api/player/177936260120" key="177936260120" m="1"></script>
          `
          // 在 HTML 文件的 </body> 标签前插入播放器脚本
          return html.replace('</body>', `${playerScripts}</body>`)
        }
      }
    ]
  }
})

