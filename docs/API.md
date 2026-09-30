# Blog API 完整参考（App 开发用）

Base URL：`https://api.lwsnb.eu.cc`

所有 JSON 响应都是同一信封：

```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": "错误信息" }
```

**认证方式：**

| 凭证 | Header | 权限 | 2FA |
|---|---|---|---|
| **用户会话 `sess_…`（admin 角色）** | `Authorization: Bearer sess_…` | 全部（含用户/令牌/2FA 管理） | 启用后写操作需 TOTP |
| 管理员令牌（兼容） | `Authorization: Bearer <UPLOAD_TOKEN>` | 同上（等同 admin 会话） | 启用后写操作需 TOTP |
| TOTP 会话 | `Authorization: TOTP <totp_session>` | 等同管理员写通道 | —（本身就是第二因子） |
| **用户会话 `sess_…`（write 角色）** | `Authorization: Bearer sess_…` | 读写（发文/删文/上传），**无 2FA 要求** | 不需要 |
| **用户会话 `sess_…`（read 角色）** | `Authorization: Bearer sess_…` | 只读（一切 GET，含含草稿的 admin 列表） | 不需要 |
| 子令牌 `blg_…`（兼容，read/write） | `Authorization: Bearer blg_…` | 同名角色的用户会话 | 不需要 |

> - 内置管理员：`admin`（密码即原 UPLOAD_TOKEN `BlogUpload_lws666`）。
> - 子用户由管理员在 `POST /api/admin/users` 创建（见 §5）。
> - 子用户/子令牌**不能**访问 `/api/admin/users`、`/api/admin/tokens`（令牌管理）、`/api/admin/totp/*`（2FA 管理）——401/403。
> - 2FA 是否启用**由管理员本人决定**（`/admin/totp/setup|confirm|disable`）；启用只影响管理员凭证自己的写操作，read/write 子用户与子令牌不受影响。
> - 公开接口（GET /api/posts 等）无需任何认证。

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

> 相册列表 `GET /api/album` 需要认证（见 §6）；App 端展示图片直接用图片 URL 即可。
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

## 2. 登录（用户名 + 密码）

### 2.1 登录 → 会话令牌
```
POST /api/auth/login
Content-Type: application/json
{ "username": "admin", "password": "…" }
```
→ 200
```json
{
  "success": true,
  "data": {
    "token": "sess_…",            // 后续所有管理接口的凭证
    "expires_in": 604800,         // 7 天（秒）
    "user": { "id": 1, "username": "admin", "role": "admin" }
  }
}
```
- 401：`{ "success": false, "error": "用户名或密码错误" }`
- 禁用用户登录：401 `该用户已被禁用`
- 口令在服务端为 PBKDF2-SHA256（10 万次迭代）哈希；`sess_…` 明文只出现这一次。

### 2.2 当前用户信息
```
GET /api/auth/me        # Authorization: Bearer sess_…
```
→ `{ "username": "admin", "role": "admin", "totp_enabled": false, "last_login_at": "…" }`

### 2.3 登出（吊销当前会话）
```
POST /api/auth/logout        # Authorization: Bearer sess_…
```
→ `{ "logged_out": true }`；之后该 `sess_…` 立即失效（401）。

### 2.4 GitHub OAuth 登录（管理员本人专用，保留）
```
GET /api/auth/github/config     # → data.client_id（App 拼授权 URL 用）
POST /api/auth/github           # body: { "code": "<OAuth 授权码>" }
```
成功 `data`：`{ "login": "lws666", "token": "<UPLOAD_TOKEN>" }`。
仅允许账号 `lws666`；其他账号 403。

### 2.5 Token 直登（兼容）
```
GET /api/admin/verify           # Authorization: Bearer <UPLOAD_TOKEN | sess_… | blg_…>
```
200 = 凭证有效。**注意：该接口只验证凭证，不涉及 2FA。**

### 2.6 2FA（TOTP，管理员自选，只约束管理员写操作）

```
GET  /api/admin/totp/status     → { "enabled": false }
POST /api/admin/totp/setup      → { "secret": "<base32>", "otpauth": "otpauth://totp/…" }
POST /api/admin/totp/confirm    body: { "code": "123456" } → { "enabled": true }
POST /api/admin/totp/session    body: { "code": "123456" } → { "token": "<totp_session>", "ttlSeconds": 43200 }
POST /api/admin/totp/disable    body: { "code": "123456" } → { "enabled": false }
```

管理员登录标准流程：

```
1. POST /auth/login                             → sess_…（7 天）
2. GET  /admin/totp/status                      → enabled?
   ├─ false → 直接可用（Bearer sess_…）
   └─ true  → POST /admin/totp/session { code } → totp_session（12h）
3. 写操作带 Authorization: TOTP <totp_session>
   （只读操作始终用 Bearer sess_… 即可）
```

> - 2FA 只拦截**管理员凭证**（admin 会话 / UPLOAD_TOKEN）的写操作；
>   read/write 子用户与 blg_ 子令牌完全不受影响。
> - `POST /setup` 在「未确认绑定」状态下重复调用会重新生成密钥（旧的作废）；
>   已启用状态下调 setup 返回 400「二步验证已启用」。
> - 验证码 30 秒刷新，每个码只能用一次（重放返回 400「已被使用」）。
> - 也可用单次验证码头代替会话：`X-TOTP-Code: 123456` + `Authorization: Bearer sess_…`。

---

## 3. 管理接口（需要认证；管理员写操作在 2FA 启用后需 TOTP）

| 操作 | admin 会话 | write 用户/令牌 | read 用户/令牌 |
|---|---|---|---|
| GET（列表/详情，含草稿） | ✅ | ✅ | ✅ |
| POST/PUT/DELETE（内容/相册/封面） | ✅（2FA 启用后需 TOTP） | ✅ | ❌ 403 |
| /admin/users、/admin/tokens、/admin/totp | ✅ | ❌ 401/403 | ❌ 401/403 |

### 3.1 发布 / 更新文章
```
POST /api/admin/posts
Authorization: Bearer sess_…        （admin 在 2FA 启用后改用 TOTP 会话）
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

## 4. 用户管理（仅管理员）

```
POST   /api/admin/users            # 创建子用户
GET    /api/admin/users            # 列出全部用户（含 active_sessions）
PUT    /api/admin/users/:username  # 改密码 / 改角色 / 禁用
DELETE /api/admin/users/:username  # 删除用户（连带其全部会话）
```

创建：
```json
{ "username": "app_read", "password": "至少8位", "role": "read" }
```
- `username`：3~24 位小写字母/数字/下划线；不能是 `admin`（内置）。
- `role`：`read`（只读）或 `write`（读写）；**不能创建第二个 admin**。
→ 201 `{ "id": 2, "username": "app_read", "role": "read" }`

修改（PUT body 任意组合）：
```json
{ "password": "新密码", "role": "write", "disabled": true }
```
- 改密码 / 禁用都会**立即作废该用户的所有会话**。
- 不能修改/禁用/删除 `admin` 自身。

列表 `data.users[]` 字段：
`id, username, role, disabled, created_at, last_login_at, active_sessions`

> 子用户登录走同一个 `POST /api/auth/login`，拿到的 `sess_…` 会话按其角色受限。

---

## 5. API 子令牌管理（仅管理员；旧体系，继续可用）

```
GET    /api/admin/tokens             # 列出全部（含已吊销）
POST   /api/admin/tokens             # 签发 { "name": "App-只读", "scope": "read" | "write" }
DELETE /api/admin/tokens/:id         # 吊销
```
签发响应 `data`：`{ "id", "token": "blg_…", "name", "scope", "created_at" }`。
**`token` 明文只出现这一次**，立刻保存；库里只有 SHA-256 哈希，丢了只能吊销重发。
`last_used_at` 可观察令牌是否被使用过。

> 新接入推荐用 §4 的用户体系（可改密/禁用/看登录时间）；`blg_` 令牌适合
> 无人值守的机器对机器场景（没有"登录"动作）。

---

## 6. 相册管理

```
GET    /api/album?page=1&limit=50    # 列表（管理员或 read/write 子用户/子令牌）
POST   /api/album                    # multipart/form-data，字段名 file；≤10MB
                                     # 允许: jpeg/png/gif/webp/avif/svg+xml
DELETE /api/album/:id                # 按 id 删除（管理员或 write）
```
POST 成功 `data`：`{ "id", "b2_key", "filename", "url", … }`。

---

## 7. 封面生成

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

## 8. Telegram webhook（App 用不到）

```
POST /api/tg/webhook    # GitHub webhook 专用，X-Hub-Signature-256 HMAC 校验
```

---

## 9. App 集成要点

1. **HTTP 客户端**：请设置浏览器式 `User-Agent`。Cloudflare 对无 UA / 脚本 UA 可能返回 403（error 1010）。
2. **登录流程**：`POST /auth/login` → 存 `sess_…`（7 天）→ 每个请求带 `Authorization: Bearer sess_…`。401 时重新登录。
3. **2FA 探测**：登录后 `GET /auth/me` 看 `role`；管理员账号再 `GET /admin/totp/status`，`enabled=true` 时写操作前需 `POST /admin/totp/session` 换 12h 的 TOTP 会话。read/write 子用户永远不需要验证码。
4. **Markdown 渲染**：`content` 是带 frontmatter 的原文。App 侧要么解析 frontmatter，要么用 `data.frontmatter`（已解析好的对象）渲染属性。
5. **分页**：所有列表都是 `page`/`limit` + `pagination.total_pages`，无游标。
6. **图片域名**：正文/封面图片在 `img.lwsnb.eu.cc`（CDN 缓存，30 天/1 年），不要硬编码 `dpdns.org` 旧域名。
7. **凭证存储**：`sess_…` 与密码放安全存储（Keychain / Keystore）。登出调 `/auth/logout` 吊销服务端会话。
8. **限流**：写接口没有额外限流，靠 Cloudflare；不要在 App 里做高频轮询写操作。
