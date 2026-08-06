# 后端部署教程

本教程讲解如何从零部署本博客的后端：**blog-worker**（API + 服务端渲染）与**入口 Worker**（静态资源 + 代理/预渲染转发）。

## 架构概览

```
用户/爬虫
   │
   ▼
入口 Worker (src/index.js)
   │  托管 dist 静态资源；/api、SEO 文件、爬虫预渲染 → 代理转发
   ▼
blog-worker (worker/src/index.ts)  ──►  Cloudflare D1（文章索引）
   │                                        │
   └── 读写 Backblaze B2（Markdown / 图片）◄──┘
```

两个 Worker 相互独立，可分别部署：

| Worker | 目录 | 职责 |
| --- | --- | --- |
| blog-worker | `worker/` | 文章 CRUD、上传、SSR 渲染、SEO 输出 |
| 入口 Worker | 仓库根目录 `src/index.js` | 托管 `dist` 静态资源，代理 `/api/*` 与 SEO 文件 |

## 1. 前置准备

- Node.js ≥ 18
- Cloudflare 账号（用于 Workers + D1）
- Backblaze B2 账号（用于对象存储）
- （可选）域名，用于自定义 API 域名与博客域名

## 2. 安装依赖

```bash
cd worker
npm install
```

## 3. 登录 Cloudflare

```bash
npx wrangler login
```

按提示在浏览器中完成授权。

## 4. 创建 D1 数据库

```bash
npx wrangler d1 create blog
```

命令会输出一个 `database_id`。将它填入 `worker/wrangler.toml` 的 `[[d1_databases]]`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "blog"
database_id = "粘贴你得到的ID"
```

> 如果已创建过数据库，可跳过本步，直接使用现有 `database_id`。

## 5. 初始化表结构

```bash
# 本地（开发用）
npx wrangler d1 execute blog --file=schema.sql

# 线上（生产用）
npx wrangler d1 execute blog --remote --file=schema.sql
```

> `schema.sql` 会创建 `posts` 与 `uploads` 两张表。
> 注意：`worker/package.json` 里的 `db:init` 脚本写的库名是 `blog-db`，与 `wrangler.toml` 中的 `blog` 不一致，请以上述命令为准。

## 6. 创建 Backblaze B2 存储桶与应用密钥

1. 登录 [Backblaze B2](https://www.backblaze.com/)，进入 Buckets。
2. 点击 **Create a Bucket**，命名为 `Valaxy`（与 `worker/wrangler.toml` 中的 `B2_BUCKET` 一致），建议开启 **public**（图片可被直接访问）。
3. 进入 **Application Keys** → **Generate New Application Key**，记录 `keyID` 与 `applicationKey`。
4. 确认存储桶的 `endpoint` 与 `region`（如 `s3.us-east-005.backblazeb2.com` / `us-east-005`），填入 `worker/wrangler.toml` 的 `[vars]`：

```toml
[vars]
B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com"
B2_REGION = "us-east-005"
B2_BUCKET = "Valaxy"
```

## 7. 配置 Secrets（敏感信息，不要提交 git）

```bash
npx wrangler secret put B2_ACCESS_KEY_ID
npx wrangler secret put B2_SECRET_ACCESS_KEY
npx wrangler secret put UPLOAD_TOKEN
```

- `UPLOAD_TOKEN` 是发布/管理文章的 Bearer Token，务必设置一个强随机值并妥善保管。
- 可选：启用 Bing IndexNow 推送时额外设置 `INDEXNOW_KEY`：

```bash
npx wrangler secret put INDEXNOW_KEY
```

> 本地开发时，把同样的变量写入 `worker/.dev.vars`（该文件已被 gitignore，不会提交）。

## 8. 本地预览（可选）

```bash
npx wrangler dev
```

确认 `http://localhost:8787/api/health` 返回 `ok`。

## 9. 部署 blog-worker

```bash
npm run deploy
```

部署完成后，你的 API 基础路径即为 worker 默认域名或你在 `wrangler.toml` 配置的自定义域名：

```toml
routes = [
  { pattern = "api.你的域名", custom_domain = true },
]
```

## 10. 部署入口 Worker（前端）

回到仓库根目录，构建前端并部署：

```bash
cd ..
npm run build    # 生成 dist/
npm run deploy   # wrangler deploy：托管 dist + 代理/预渲染
```

`wrangler.toml` 中已声明静态资源目录与路由，部署后博客即可通过你的域名访问。

## 11. 验证

```bash
# 健康检查
curl https://你的API域名/api/health

# 文章列表
curl https://你的API域名/api/posts

# 发布一篇测试文章（需 Bearer Token）
curl -X POST https://你的API域名/api/upload \
  -H "Authorization: Bearer 你的UPLOAD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"hello","markdown":"---\ntitle: Hello World\n---\n\n这是正文。"}'
```

成功后访问 `https://你的博客域名/posts/hello` 即可看到文章。

## 常见问题

- **D1 库名不一致**：直接使用 `npx wrangler d1 execute blog ...`，不要用 `package.json` 里写错的 `blog-db`。
- **CORS 报错**：`blog-worker` 已全局开启 CORS，正常无需处理。
- **404**：确认 `wrangler.toml` 中的 `routes` 域名与 `valaxy.config.ts` 里的 `siteConfig.url` 一致。
- **图片无法访问**：确认 B2 存储桶为 public，且 `B2_ENDPOINT` / `B2_BUCKET` 填写正确。

## 安全提醒

- `UPLOAD_TOKEN`、B2 密钥等一律通过 `wrangler secret` 配置，不要写进 `wrangler.toml` 或提交到 git。
- `worker/.dev.vars` 仅用于本地开发，已加入 `.gitignore`。
- `UPLOAD_TOKEN` 拥有写权限，泄露后他人可发布/删除文章，请定期轮换。
