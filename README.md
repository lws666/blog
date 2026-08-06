# lwsnb の blog

一个基于 **Valaxy** 构建的**动态博客**系统。发布文章无需重新构建，新文章即刻上线。

> 在线访问：[www.lwsnb.dpdns.org](https://www.lwsnb.dpdns.org)

## ✨ 特性

- **动态发布**：文章写入 Cloudflare D1 + Backblaze B2 后立即生效，无需重新 `build`
- **Valaxy 原生 UI**：基于 `valaxy-theme-yun`，保持默认组件与 Markdown 渲染效果
- **爬虫预渲染（SEO）**：入口 Worker 识别搜索引擎爬虫，将首页与文章页代理到服务端预渲染，保证 SEO 可用
- **后台管理**：内置 `/admin` 页面，可在线发布、编辑、删除文章
- **评论与阅读量**：集成 Waline 评论系统，支持页面浏览量统计
- **图片存储**：图片统一托管于 Backblaze B2
- **多端部署**：主入口托管于 Cloudflare，同时保留 GitHub Pages / Netlify / Vercel 静态部署能力

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Valaxy · Vue 3 · Vite · TypeScript |
| 主题 | valaxy-theme-yun |
| API 后端 | Cloudflare Worker（Hono） |
| 数据库 | Cloudflare D1 (SQLite) |
| 对象存储 | Backblaze B2 |
| 评论 | Waline |
| 评论容器 | Docker（可选） |

## 🏗️ 架构

```
Markdown / 图片
    │
    ▼
Backblaze B2 ────► blog-worker (API + SSR)
    │                   │
    │                   ▼
    │               Cloudflare D1（文章元数据 / 索引）
    │                   │
    └──► 前端 Valaxy ◄──┘
             ▲
             │ (爬虫)
入口 Worker（静态资源 + 代理 + 预渲染转发）
```

- **入口 Worker**（`src/index.js`）：托管 `dist` 静态资源；将 `/api/*`、SEO 文件（`sitemap.xml`、`robots.txt`、`rss.xml`、`llms.txt`）代理给 `blog-worker`；对爬虫请求首页/文章页时转发做服务端预渲染。
- **blog-worker**（`worker/`）：Hono 应用，负责文章 CRUD、上传、SSR 渲染与 SEO 输出。

## 📁 目录结构

```text
├── pages/            # 页面与文章
│   ├── posts/[slug].vue  # 文章详情页（动态获取）
│   └── admin/index.vue   # 后台管理页
├── src/index.js      # 入口 Worker（静态资源 + 代理）
├── worker/           # blog-worker（API 后端）
│   ├── src/          # Hono 路由、B2/D1 封装
│   ├── schema.sql    # D1 数据库结构
│   └── wrangler.toml # Worker 配置（D1、B2 变量）
├── components/       # 自定义 Vue 组件（自动加载）
├── layouts/          # 自定义布局
├── styles/           # 主题样式覆盖
├── locales/          # 国际化
├── valaxy.config.ts  # Valaxy 站点配置
└── site.config.ts    # 站点信息（标题、作者、社交）
```

## 🚀 本地开发

```bash
# 安装依赖
npm install
# 或 pnpm install

# 启动开发服务器（默认端口 4859）
npm run dev
```

开发模式下，`/api` 请求已通过 `valaxy.config.ts` 中的 Vite 代理转发到 `https://api.lwsnb.dpdns.org`。

访问 http://localhost:4859/ 开始使用。

## 📦 构建与部署

### Cloudflare（推荐，动态博客主入口）

```bash
# 构建前端产物（dist/）
npm run build

# 预览 Worker（本地模拟）
npm run preview

# 部署入口 Worker（托管 dist + 代理/预渲染）
npm run deploy
```

> `blog-worker` 在 `worker/` 目录下单独管理，使用各自的 `wrangler.toml` 与 `wrangler deploy` 部署。

### 静态部署（可选，仅博客快照）

`valaxy` 生成的是可独立运行的静态站点，也可部署到 GitHub Pages / Netlify / Vercel：

```bash
# 纯静态构建
npm run build:ssg
```

仓库已附带 `.github/workflows/gh-pages.yml`、`netlify.toml`、`vercel.json` 配置文件。

### Docker（可选）

```bash
docker build . -t lwsnb-blog:latest
```

## 🔐 blog-worker 环境变量

通过 `wrangler secret put <KEY>` 设置：

| 变量 | 说明 |
| --- | --- |
| `B2_ACCESS_KEY_ID` | Backblaze B2 Application Key ID |
| `B2_SECRET_ACCESS_KEY` | Backblaze B2 Application Key Secret |
| `UPLOAD_TOKEN` | 上传接口的 Bearer Token |

在 `worker/.env.example` 中有模板，D1 与 B2 的绑定在 `worker/wrangler.toml` 中配置。

### 初始化数据库

```bash
cd worker
npx wrangler d1 execute blog --file=schema.sql
```

## 📡 API 接口

基础路径：`https://api.lwsnb.dpdns.org`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/stats` | 站点统计 |
| GET | `/api/posts` | 文章列表 |
| GET | `/api/posts/:slug` | 文章详情 |
| POST | `/api/upload` | 上传 Markdown / 图片（需 Bearer Token） |
| POST | `/api/admin/posts` | 创建文章 |
| GET | `/api/admin/posts` | 后台文章列表 |
| GET | `/api/admin/posts/:slug` | 后台文章详情 |
| DELETE | `/api/admin/posts/:slug` | 删除文章 |
| GET | `/sitemap.xml` | 站点地图 |
| GET | `/robots.txt` | 爬虫规则 |
| GET | `/rss.xml` | RSS 订阅 |
| GET | `/llms.txt` | LLM 可读索引 |
| GET | `/render/homepage` | 首页服务端预渲染（供爬虫） |
| GET | `/posts/:slug` | 文章服务端预渲染（供爬虫） |

## 🗄️ 数据库

Cloudflare D1，核心表 `posts`（slug 唯一、支持 i18n 标题、置顶、草稿、密码、隐藏、评论开关等字段），以及 `uploads`（已上传的 B2 资源记录）。

## 📄 License

[MIT](https://mit-license.org)
