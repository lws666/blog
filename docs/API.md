# Blog API 完整参考（App 开发用）

Base URL：`https://api.lwsnb.eu.cc`

所有 JSON 响应都是同一信封：

```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": "错误信息" }
```

**认证方式（二选一）：**

| 方式 | Header | 适用 |
|---|---|---|
| 管理令牌 | `Authorization: Bearer <UPLOAD_TOKEN>` | 全部管理接口（2FA 启用后写操作会被拒） |
| TOTP 会话 | `Authorization: TOTP <session_token>` | 写操作（2FA 启用后）；12h 有效 |
| 单次验证码 | `Authorization: Bearer <token>` + `X-TOTP-Code: 123456` | 写操作（2FA 启用后，临时替代会话） |

> 公开接口（GET /api/posts 等）无需任何认证。App 登录后应先调 `/admin/totp/status` 决定 UI 流程。

---

## 1. 公开接口（无认证）

### 1.1 健康检查
```
GET /api/health
```
```json
{ "success": true, "data": { "status": "ok", "timestamp": "…" } }
```

### 1.2 站点统计
```
GET /api/stats
```
```json
{ "success": true, "data": { "post_count": 2, "category_count": 2, "tag_count": 3 } }
```

### 1.3 文章列表（分页）
```
GET /api/posts?page=1&limit=10&category=分类&tag=标签&keyword=关键词
```
- `limit` 最大 50；四个查询参数均可选。
- 只返回已发布文章（`draft=0`）。

```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "slug": "hello-world",
        "title": "标题",
        "date": "2026-07-26",
        "updated": "2026-07-26T…",
        "tags": ["Valaxy"],
        "categories": ["前端"],
        "excerpt": "摘要…",
        "cover": "https://img.lwsnb.eu.cc/cover/xxx.png",
        "type": "post",
        "top": 0,
        "hide": ""
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 2, "total_pages": 1 }
  }
}
```

### 1.4 文章详情
```
GET /api/posts/:slug
```
- 404：`{ "success": false, "error": "Post not found" }`
- 草稿不返回（即使知道 slug）。

`data` 字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| slug/title/date/updated/tags/categories/excerpt/cover/type/top/hide | 同列表 | — |
| content | string | **Markdown 原文**（含 frontmatter，需自行解析/剔除） |
| summary | string | AI 摘要（`''` 表示未生成） |
| frontmatter | object | 解析好的元数据 |
| comment | boolean | 是否开启评论 |

### 1.5 相册图片
```
GET /api/album/file/album/<name>        # 图片字节流（公开直出，Cache-Control 一年）
```

> 相册列表 `GET /api/album` 需要认证（见 §4）；App 端展示图片直接用图片 URL 即可。
> 图片也可通过 `https://img.lwsnb.eu.cc/file/album/<name>` 访问（边缘缓存）。

### 1.6 封面图（公开读）
```
GET /cover/<name>      # AI/SVG 生成的封面 PNG（img.lwsnb.eu.cc 域名下同样可用）
GET /file/<name>       # 历史图片床代理
```

### 1.7 SEO 文件（一般 App 用不到）
```
GET /sitemap.xml   GET /robots.txt   GET /rss.xml   GET /llms.txt
GET /render/homepage    # 预渲染 HTML（爬虫用，App 不要解析它）
```

---

## 2. 登录与 2FA（TOTP 二步验证）

### 2.1 GitHub OAuth 登录（推荐，无 2FA 绑定前的唯一免 Token 通道）
```
GET /api/auth/github/config     # → data.client_id（App 拼授权 URL 用）
POST /api/auth/github           # body: { "code": "<OAuth 授权码>" }
```
成功 `data`：`{ "login": "lws666", "token": "<UPLOAD_TOKEN>" }`。
仅允许账号 `lws666`；其他账号 403。

### 2.2 Token 直登
```
GET /api/admin/verify           # Header: Authorization: Bearer <token>
```
200 = token 有效。**注意：该接口只验证 token，不涉及 2FA。**

### 2.3 TOTP 生命周期（全部要求 Bearer token）

```
GET  /api/admin/totp/status     → { "enabled": false }
POST /api/admin/totp/setup      → { "secret": "<base32>", "otpauth": "otpauth://totp/…" }
POST /api/admin/totp/confirm    body: { "code": "123456" } → { "enabled": true }
POST /api/admin/totp/session    body: { "code": "123456" } → { "token": "<session>", "ttlSeconds": 43200 }
POST /api/admin/totp/disable    body: { "code": "123456" } → { "enabled": false }
```

App 登录标准流程：

```
1. POST /admin/verify（Bearer token）           → 200
2. GET  /admin/totp/status                      → enabled?
   ├─ false →（首次使用会先自动 setup，见下）直接可用
   └─ true  → 弹验证码输入框
3. POST /admin/totp/session { code }            → session_token（存 12h）
4. 之后所有写操作带 Authorization: TOTP <session_token>
```

> `POST /setup` 在「未确认绑定」状态下重复调用会重新生成密钥（旧的作废）；
> 已启用状态下调 setup 返回 400「二步验证已启用」。
> 验证码 30 秒刷新，每个码只能用一次（重放返回 400「已被使用」）。

---

## 3. 管理接口（需要认证；2FA 启用后写操作需 TOTP）

### 3.1 发布 / 更新文章
```
POST /api/admin/posts
Authorization: TOTP <session>   （或 Bearer + X-TOTP-Code）
Content-Type: application/json
```
```json
{
  "slug": "my-post",              // 必填，唯一键，重复则覆盖更新
  "title": "标题",                 // 必填
  "date": "2026-01-01",           // 可选，默认今天
  "categories": ["前端"],          // 可选
  "tags": ["Vue", "TS"],          // 可选
  "cover": "https://…",           // 可选
  "excerpt": "摘要",               // 可选
  "content": "# Markdown 正文",    // 可选
  "draft": false,                 // 可选，true=草稿
  "type": "post",                 // 可选（post/bilibili/yuque/…）
  "top": 0,                       // 可选，置顶权重
  "hide": "",                     // 可选：""/index/all
  "comment": true,                // 可选
  "toc": true,                    // 可选
  "nav": true                     // 可选
}
```
→ 201 `{ "slug": "my-post", "url": "/posts/my-post" }`

### 3.2 管理列表（含草稿）
```
GET /api/admin/posts?page=1&limit=50
```
响应结构与公开列表一致，但包含草稿。

### 3.3 管理详情（含草稿）
```
GET /api/admin/posts/:slug
```
同公开详情，但草稿也返回。

### 3.4 AI 摘要
```
POST /api/admin/posts/:slug/summary    # 生成（Workers AI）→ { slug, summary, model, neurons }
PUT  /api/admin/posts/:slug/summary    # 手动覆盖 body: { "summary": "…" }
```

### 3.5 删除文章
```
DELETE /api/admin/posts/:slug
```
→ `{ "deleted": true }`（同时删 B2 上的 markdown）

### 3.6 上传文章（markdown 一把梭，兼容旧版）
```
POST /api/upload
Content-Type: application/json
{ "slug": "可选", "markdown": "---\ntitle: x\n---\n\n正文", "cover": "可选", "autoCover": true }
```
→ 201 `{ "slug": "…", "url": "/posts/…" }`

---

## 4. 相册管理

```
POST   /api/album          # multipart/form-data，字段名 file；≤10MB
                        # 允许: jpeg/png/gif/webp/avif/svg+xml
DELETE /api/album/:id      # 按 id 删除
```
POST 成功 `data`：`{ "id", "b2_key", "filename", "url", … }`。

---

## 5. 封面生成

```
POST /api/cover
{ "engine": "svg",          // 默认 svg；或 "agnes" / "workers-ai"
  "text": "封面文案",        // svg 引擎：text/excerpt/title 至少一个
  "title": "…", "excerpt": "…", "tags": "…", "slug": "…",
  "prompt": "…" }           // ai 引擎：title 或 prompt 必填
```
→ 201 `{ "url": "https://img.lwsnb.eu.cc/cover/xxx.svg", "key": "…", "engine": "svg", … }`

```
POST /api/cover/raster      # 把 SVG 转成 PNG（社交平台不认 SVG）
{ "svg": "<svg…>", "png": "data:image/png;base64,…" }
```
→ 201 `{ "url": "https://img.lwsnb.eu.cc/cover/xxx.png" }`

---

## 6. Telegram webhook（App 用不到）

```
POST /api/tg/webhook    # GitHub webhook 专用，X-Hub-Signature-256 HMAC 校验
```

---

## 7. App 集成要点

1. **HTTP 客户端**：请设置浏览器式 `User-Agent`。Cloudflare 对无 UA / 脚本 UA 可能返回 403（error 1010）。
2. **Markdown 渲染**：`content` 是带 frontmatter 的原文。App 侧要么解析 frontmatter，要么用 `data.frontmatter`（已解析好的对象）渲染属性。
3. **分页**：所有列表都是 `page`/`limit` + `pagination.total_pages`，无游标。
4. **图片域名**：正文/封面图片在 `img.lwsnb.eu.cc`（CDN 缓存，30 天/1 年），不要硬编码 `dpdns.org` 旧域名。
5. **Token 存储**：建议安全存储（Keychain / Keystore）。TOTP 会话令牌 12h 过期，收到 401 且 body 含「二步验证」字样时应重新走 `/totp/session`。
6. **限流**：写接口没有额外限流，靠 Cloudflare；不要在 App 里做高频轮询写操作。
7. **2FA 状态探测**：登录后先 `GET /admin/totp/status`，`enabled=true` 才需要弹验证码 UI；`enabled=false` 时 Bearer token 直接可用。
