# lwsnb の blog

一个基于 **SvelteKit** 的静态博客 + **Cloudflare Worker** 动态后端的博客系统：前端全量预渲染成 HTML（SEO 内建），后台发布文章后自动触发重建上线。

> 在线访问：**[www.lwsnb.eu.cc](https://www.lwsnb.eu.cc)**（SvelteKit 版，Cloudflare Pages）
> 镜像站点：[vercel.lwsnb.eu.cc](https://vercel.lwsnb.eu.cc)（Vercel，自动同步）｜ [lwsnb-sveltekit.pages.dev](https://lwsnb-sveltekit.pages.dev)
> 旧版 Valaxy 站保留在 [cf.lwsnb.eu.cc](https://cf.lwsnb.eu.cc)（备用回滚线）

## ✨ 特性

- **SEO 内建**：`adapter-static` 全站预渲染，每页真实 HTML（不再是 SPA 空壳 + 爬虫注入补丁）
- **结构化数据**：每页一个 h1、canonical 尾斜杠统一、JSON-LD `@graph`（Person / WebSite / WebPage / BlogPosting / BreadcrumbList）、`og:type=article`
- **Butterfly 主题**：按 hexo-theme-butterfly 编译后的 CSS 逐值逆向（卡片、悬浮球、banner、波浪），非截图模仿
- **目录滑块**：右侧目录 4px 竖条跟随阅读位置滑动（IntersectionObserver）
- **AI 摘要卡**：仿安知鱼 `.post-ai-description`，打字机效果 + 朗读（Web Speech API）
- **Twikoo 评论**：Cloudflare Workers + D1 同域挂载（`/twikoo`），无需 GitHub 登录
- **管理后台**：`/admin`（SvelteKit 重写）——Markdown 编辑器 + 实时预览、AI 摘要生成、SVG 封面生成、相册管理
- **发布即上线**：后台发布 → Worker 触发 GitHub `repository_dispatch` → Actions 重建 → Pages 部署，约 1 分钟
- **音乐播放器**：APlayer + 自建 Meting API，悬浮球并入右下按钮列
- **SEO 文件**：`sitemap.xml` / `rss.xml` / `robots.txt` / `llms.txt` 构建期生成
- **真实 404**：未知路径返回独立 404 页（不再是 200 + 首页）

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | SvelteKit 3.1 · Svelte 5 (runes) · Vite · TypeScript |
| 预渲染 | @sveltejs/adapter-static（fallback SPA 给 /admin） |
| 主题 | 自研 Butterfly 风格（theme.css 设计令牌） |
| API 后端 | Cloudflare Worker（Hono） |
| 数据库 | Cloudflare D1 (SQLite) |
| 对象存储 | Backblaze B2 |
| 评论 | Twikoo 2.0（Workers 版，同域挂载） |
| 音乐 | APlayer + Meting API |
| 部署 | Cloudflare Pages（主站）+ Vercel（镜像）+ Cloudflare Workers（后端/评论） |
| CI | GitHub Actions（push / repository_dispatch 触发重建） |

## 🏗️ 架构

```
后台 /admin ──发布──► blog-worker (Hono API)
                        │
                        ├─► D1（文章/评论/用户/相册元数据）
                        ├─► B2（Markdown 原文 + 图片）
                        │
                        └─ repository_dispatch
                              │
                              ▼
                    GitHub Actions 构建 SvelteKit
                    （API 拉取文章 → 预渲染 HTML）
                              │
                              ▼
                    Cloudflare Pages（静态站点）
                              ▲
                    浏览器 /api/* ──► blog-worker
                    浏览器 /twikoo ──► blog-worker（Twikoo 同域挂载）
```

- **前端**（`sveltekit/`）：SvelteKit 应用，构建时从 API 拉取全部文章预渲染为静态 HTML
- **blog-worker**（`worker/`）：Hono 应用——文章 CRUD、B2 上传、AI 摘要、SVG 封面、相册、用户/令牌，并同域挂载 Twikoo 评论后端（`/twikoo`）

## 📁 目录结构

```text
├── sveltekit/            # SvelteKit 前端（主站）
│   ├── src/routes/       # 页面（blog/about/archives/categories/tags/admin…）
│   ├── src/lib/          # 组件（Nav/Actions/MusicPlayer/Toc/AiSummary/TwikooComment）
│   │   ├── theme.css     # Butterfly 风格样式（设计令牌 + 组件样式）
│   │   ├── admin/        # 管理后台（API 客户端/编辑器/相册）
│   │   └── site.ts       # 站点配置（标题/作者/音乐/导航）
│   ├── static/_redirects # /admin/* → admin.html（SPA fallback）
│   └── vite.config.ts    # adapter-static 配置
├── worker/               # blog-worker（API 后端）
│   ├── src/routes/       # Hono 路由（admin/posts/album/cover/auth/telegram）
│   ├── src/index.ts      # 应用入口（CORS、路由、Twikoo 挂载、SEO）
│   ├── src/twikoo-backend/ # Twikoo 官方 Cloudflare 适配器构建产物
│   └── wrangler.toml     # D1 / B2 绑定、nodejs_compat
├── docs/                 # API.md（接口文档）· DEPLOY.md（部署教程）
├── scripts/              # import-comments.mjs（历史评论导入）
└── .github/workflows/    # deploy-sveltekit.yml（CI/CD）
```

## 🚀 本地开发

```bash
# 前端（sveltekit/）
cd sveltekit
npm install
npm run dev        # vite dev，/api 代理到 api.lwsnb.eu.cc

# 后端（worker/）
cd worker
npm install
npx wrangler dev   # 本地模拟 Workers 环境
```

## 📦 构建与部署

```bash
# 前端构建 + 预渲染（产物 build/）
cd sveltekit && npm run build

# 部署到 Cloudflare Pages
npx wrangler pages deploy build --project-name lwsnb-sveltekit --branch main

# 后端部署
cd worker && npx wrangler deploy
```

推送 `sveltekit-rebuild`（默认分支）或 `master` 会触发
`.github/workflows/deploy-sveltekit.yml` 自动构建部署；发布文章时 Worker
也会通过 `repository_dispatch` 触发同一流程。Vercel 项目已连接同一仓库，
push 后自动构建镜像站（构建脚本见 `scripts/vercel-build.sh`）。

## 🔐 blog-worker 环境变量

通过 `wrangler secret put <KEY>` 设置：

| 变量 | 说明 |
| --- | --- |
| `B2_ACCESS_KEY_ID` | Backblaze B2 Application Key ID |
| `B2_SECRET_ACCESS_KEY` | Backblaze B2 Application Key Secret |
| `UPLOAD_TOKEN` | 上传接口的 Bearer Token |
| `GITHUB_DISPATCH_TOKEN` | 触发 GitHub Actions 重建的 PAT |
| `GITHUB_REPO` | 仓库名（默认 lws666/blog） |
| `INDEXNOW_KEY` | IndexNow 提交密钥 |
| `AI_ACCOUNT_ID` / `AI_API_TOKEN` | Workers AI（摘要生成） |

D1 与 B2 的绑定在 `worker/wrangler.toml` 中配置。

### 初始化数据库

```bash
cd worker
npx wrangler d1 execute blog --remote --file=schema.sql
# Twikoo 表（comment/counter/config）与博客表同库不冲突：
npx wrangler d1 execute blog --remote --file=../twikoo-build/packages/server-cloudflare/schema.sql
```

## 📡 API 接口

基础路径：`https://api.lwsnb.eu.cc`（完整文档见 [docs/API.md](docs/API.md)）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/stats` | 站点统计 |
| GET | `/api/posts` | 公开文章列表（分页） |
| GET | `/api/posts/:slug` | 文章详情 |
| GET | `/api/admin/posts` | 后台列表（含草稿，需登录） |
| POST | `/api/admin/posts` | 创建/更新文章 |
| DELETE | `/api/admin/posts/:slug` | 删除文章 |
| POST | `/api/admin/posts/:slug/summary` | AI 生成摘要 |
| POST | `/api/cover` | 生成 SVG 封面 |
| GET/POST/DELETE | `/api/album` | 相册管理 |
| POST | `/api/auth/login` | 用户名密码登录（sess_ 令牌） |
| GET/POST/DELETE | `/api/admin/users` | 子用户管理 |
| ALL | `/twikoo` | Twikoo 评论后端（同域挂载） |
| GET | `/sitemap.xml` `/robots.txt` `/rss.xml` `/llms.txt` | SEO 文件（构建期生成） |

## 🗄️ 数据库

Cloudflare D1 单库复用：

- 博客表：`posts`（slug 唯一、置顶、草稿、密码、隐藏等）、`uploads`、`users`、`sessions`、`api_tokens`
- Twikoo 表：`comment`、`counter`、`config`（与博客表命名不冲突）

## 📄 License

[MIT](https://mit-license.org)
