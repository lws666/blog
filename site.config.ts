import { defineSiteConfig } from 'valaxy'

export default defineSiteConfig({
  url: 'https://www.lwsnb.dpdns.org', // 建议加上 https
  lang: 'zh-CN',
  title: 'lwsのblog',
  author: {
    name: 'lws',
    /**
     * Your avatar
     * 头像链接：建议使用你在 GitHub 的头像或其他外部 URL
     */
    avatar: 'https://img.lwsnb.dpdns.org/file/1770349295364_IMG_20250823_144910_239.jpg', 
    intro: '一个普通人，热爱开发与生活。', // 丰富了简介内容
  },
  description: '一个普通人.',
  social: [
    {
      name: 'RSS',
      link: '/atom.xml',
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
