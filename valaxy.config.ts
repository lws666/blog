import { defineValaxyConfig } from 'valaxy'
import type { UserThemeConfig } from 'valaxy-theme-yun'
// 1. 导入 Waline 插件
import { addonWaline } from 'valaxy-addon-waline'

// add icons what you will need
const safelist = [
  'i-ri-home-line',
]

/**
 * User Config
 */
export default defineValaxyConfig<UserThemeConfig>({
  // site config see site.config.ts

  theme: 'yun',

  // 2. 在 addons 中注册 Waline
  addons: [
    addonWaline({
      serverURL: 'https://Waline.lwsnb.dpdns.org', // 填入你的 Waline 地址
      pageview: true, // 开启访问量统计
      comment: true,  // 开启评论数显示
    }),
  ],

  themeConfig: {
    banner: {
      enable: true,
      title: 'lwsの博客',
    },

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
})
