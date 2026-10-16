# lwsnb-sveltekit

博客的 SvelteKit 重构版（Butterfly 主题 + acofork 风格 SEO）。

## 技术栈

- **SvelteKit 3.1**（SSR，SEO 友好）+ Svelte 5（runes）+ Vite 8
- **adapter-cloudflare** —— 部署到 Cloudflare Workers/Pages
- 后端沿用现有 **Cloudflare Worker**（`api.lwsnb.eu.cc`）+ D1 + B2
- Markdown 用 `marked` 渲染，`shiki` 备用

## 快速开始

```bash
npm install
npm run dev          # 开发（/api 代理到线上 Worker）
npm run build        # 构建（adapter-cloudflare 输出）
npm run preview      # 预览构建产物
npm run check        # svelte-check 类型检查
npm run deploy       # wrangler deploy
```

## 目录结构

```
src/
├── app.html                  # HTML 外壳 + 暗色模式防闪烁脚本
├── hooks.server.ts           # 安全响应头 + 域名 301 规范化
├── lib/
│   ├── site.ts               # 站点配置（SEO 唯一事实来源）
│   ├── seo.ts                # SEO 元信息 + JSON-LD 构建
│   ├── api.ts                # 后端 Worker API 客户端
│   ├── markdown.ts           # Markdown 渲染 / TOC 提取 / h1 降级
│   ├── theme.css             # Butterfly 主题（令牌+组件样式）
│   ├── components/           # Nav / Hero / PostCard / Sidebar / Toc / Seo ...
│   └── server/taxonomy.ts    # 分类标签聚合
└── routes/
    ├── +layout.svelte        # 全站壳（导航/页脚/悬浮按钮/主题切换）
    ├── +layout.ts            # trailingSlash = 'always'
    ├── +page.{svelte,server.ts}          # 首页
    ├── blog/                             # 列表 + page/[page] 分页 + [slug] 详情
    ├── archives/ categories/[name]/ tags/[name]/
    ├── about/
    ├── robots.txt/ sitemap.xml/ rss.xml/ # SEO 端点
    └── +error.svelte                     # 真实 404
```

## SEO 实现要点

参考 `www.acofork.com` 的做法（经逆向核对其真实响应），并修掉其缺陷。

**对齐的部分**

| 项 | 做法 |
|---|---|
| 标题 | 首页 = 站点名·标语；子页 = `页面标题 \| 站点名`（分隔符 ` \| `） |
| canonical | 绝对 URL、统一尾斜杠、每页一个 |
| robots meta | `index,follow,max-image-preview:large` |
| Open Graph | og:site_name/title/description/url/type/image + `zh_CN` |
| Twitter | `summary_large_image` |
| JSON-LD | 单 `@graph`：Person + WebSite + WebPage + （文章）BlogPosting + BreadcrumbList；BlogPosting 11 键与键序对齐 |
| robots.txt | `User-agent: *` / `Allow: /` / `Sitemap:`，无 Disallow |
| sitemap.xml | 单 `<urlset>`，`<loc>` 为唯一子元素（无 lastmod/changefreq/priority），静态页在前、文章倒序在后 |
| rss.xml | RSS 2.0，20 条，摘要模式，`pubDate` 用 RFC-822 |

**改良（修 acofork 的缺陷）**

- **真实 404**：acofork 未匹配路径一律返回 200 + 首页内容（soft 404）；这里返回 404 状态与独立页面
- **og:type 修正**：文章页用 `article`（acofork 恒为 `website`）
- **补 dateModified**：`updated` 为空时回退 `datePublished`
- **补 article:published_time / article:tag**
- **补 pagination**：acofork 无分页，174 篇文章挤在一页
- **补安全头**：HSTS / nosniff / X-Frame-Options / Referrer-Policy / Permissions-Policy（acofork 无 cache-control 与 x-robots-tag）
- **每页恰好一个 h1**：正文里的 h1 自动降为 h2

## Butterfly 主题要点

数值取自主题编译后的 CSS 与 `_config.yml`（逆向核对，勿凭印象改）：

- 布局：内容 **74%** + 侧栏 **26%**，`max-width:1200px`，`padding:40px 15px`
- 主色三件套：`#49B1F5`（主）、`#00c4b6`（激活：分页当前页/TOC 激活/::selection）、`#FF7242`（悬停）
- 卡片：**不透明** `--card-bg`，圆角 **8px**，阴影 `0 3px 8px 6px rgba(7,17,27,.05)`
- 玻璃模糊**仅用于固定导航**：`rgba(255,255,255,.7)` + `blur(7px)`（滚动 > 56px 触发）
- 文章卡片 hover **不位移**，只有阴影加深 + 封面 `scale(1.1)`
- 头像在**侧栏作者卡**，不在 banner
- 暗色：`data-theme="dark"`，bg `#0d0d0d` / card `#121212`；`app.html` 内联脚本防闪烁
- banner：首页 100vh（`background-attachment:fixed`）；文章页 400px（**scroll**，fixed 会导致图片只显示一条）

## 已知事项

- 侧栏分类/标签计数由文章列表聚合（后端暂无独立聚合接口）
- 文章封面若由 SVG 生成器生成，图上已含标题文字，与 banner 标题可能视觉重复（数据层问题）
- `hooks.server.ts` 的域名 301 仅在自定义域生效，本地/预览域不重定向
