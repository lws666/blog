import { defineSiteConfig } from 'valaxy'

export default defineSiteConfig({
  url: 'https://www.lwsnb.eu.cc', // 建议加上 https
  lang: 'zh-CN',
  title: '谢谢の博客 - 一个普通人的技术博客',
  author: {
    name: '权益',
    /**
     * Your avatar
     * 头像链接：建议使用你在 GitHub 的头像或其他外部 URL
     */
    avatar: 'https://img.lwsnb.eu.cc/file/1770349295364_IMG_20250823_144910_239.jpg',
    /**
     * 作者主页链接。theme 的 layouts/post.vue 用它填结构化数据里的
     * Person.url；不填时 @unhead/schema-org 会落回框架默认值
     * https://valaxy.site，等于在结构化数据里声明作者主页是别人的站。
     * 与下方 social 里的 GitHub 保持一致。
     */
    link: 'https://github.com/lws666',
    intro: '一个普通人，热爱开发与生活。', // 丰富了简介内容
  },
  description: '一个普通人的技术博客，分享 Cloudflare、Valaxy、Vue、前端开发、AI 等领域的实践与思考。',
  social: [
    {
      name: 'RSS',
      link: '/rss.xml',
      icon: 'i-ri-rss-line',
      color: 'orange',
    },
    {
      name: 'GitHub',
      link: 'https://github.com/lws666',
      icon: 'i-ri-github-line',
      color: '#6e5494',
    },
    {
      name: '哔哩哔哩',
      link: 'https://m.bilibili.com/space/3493115176422328',
      icon: 'i-ri-bilibili-line',
      color: '#FF8EB3',
    },
    {
      name: 'Telegram Channel',
      link: 'https://t.me/lwsnb',
      icon: 'i-ri-telegram-line',
      color: '#0088CC',
    },
  ],

  search: {
    enable: false,
  },

  // 赞赏功能配置
  sponsor: {
    enable: true,
    title: '我很可爱，请给我钱！',
    methods: [
      {
        name: '支付宝',
        url: '', // 记得在这里填入你的收款码图片链接
        color: '#00A3EE',
        icon: 'i-ri-alipay-line',
      },
      {
        name: 'QQ 支付',
        url: '',
        color: '#12B7F5',
        icon: 'i-ri-qq-line',
      },
      {
        name: '微信支付',
        url: '',
        color: '#2DC100',
        icon: 'i-ri-wechat-pay-line',
      },
    ],
  },
  
  // 开启评论总开关
  comment: {
    enable: true
  },
})
