# AGENTS.md — Valaxy Blog Project

## 1. 项目定位

这是一个 Valaxy 博客项目。

项目根目录：

/home/lws666/blog

核心技术：

- Valaxy
- Vue
- Vite
- TypeScript
- Valaxy Theme Yun
- Cloudflare Worker
- Cloudflare D1
- Backblaze B2
- Vercel

不要把本项目与 ~/deepseek-harness 混淆。

~/deepseek-harness 是 DSH 源码项目，不是本博客项目。

---

## 2. DSH 工作规则

当前项目使用 DSH。

所有操作默认以当前项目根目录为上下文。

开始任务前：

1. pwd
2. git rev-parse --show-toplevel
3. git status
4. 检查相关文件
5. 理解现有实现
6. 再决定修改方案

不要因为问题看起来简单就直接修改文件。

---

## 3. 修改原则

### 最小修改

优先修改最少的文件。

不要：

- 重构无关代码
- 顺手升级依赖
- 修改无关配置
- 删除已有功能
- 重写整个组件
- 为了一个 Bug 修改大量代码

除非确实必要，否则不要改变现有架构。

### 修改前

先分析：

- 当前实现
- 数据流
- 调用链
- 生产环境行为
- 开发环境行为
- API 地址
- 构建流程

### 修改后

至少检查：

- TypeScript
- Vue 编译
- API 调用
- 路由
- Git diff
- Git status

---

# 4. Valaxy 项目结构

主要工作目录：

pages/
components/
layouts/
styles/
locales/

主要配置：

valaxy.config.ts
site.config.ts
package.json

文章通常位于：

pages/posts/

不要修改 node_modules。

不要直接修改 Valaxy 或 Theme Yun 的 node_modules 源码。

如果需要修改主题行为：

优先在项目自己的：

components/
layouts/
styles/
pages/

进行覆盖。

---

# 5. Valaxy 规则

## 页面

优先检查：

pages/

文章：

pages/posts/

## 组件

项目自定义组件：

components/

Valaxy 支持自动注册项目 components 下的 Vue 组件。

## 布局

项目布局：

layouts/

如果需要修改文章布局，优先检查项目自己的 layouts，而不是直接修改主题源码。

## 样式

优先修改：

styles/

不要直接修改 node_modules 中主题的 CSS。

## 配置

修改配置前优先检查：

valaxy.config.ts
site.config.ts

不要随意修改 runtime 生成内容。

---

# 6. Valaxy Theme Yun

项目使用 Valaxy Theme Yun。

遇到主题显示问题时，先判断问题属于：

1. 项目页面
2. 项目组件
3. 项目布局
4. 项目样式
5. Valaxy 配置
6. Theme Yun 默认实现

优先使用项目覆盖机制。

不要直接修改 node_modules/valaxy-theme-yun。

---

# 7. 动态博客架构

项目使用：

Valaxy + Cloudflare Worker + D1 + Backblaze B2

Worker：

https://blog-worker.13318678430.workers.dev

前端部署：

Vercel

---

# 8. Worker / API 规则

Worker 负责动态文章相关 API。

修改 API 时必须同时考虑：

开发环境：
本地 Vite / API proxy

生产环境：
Vercel → Cloudflare Worker

不要只修开发环境而破坏生产环境。

不要硬编码错误的 localhost API 地址到生产构建。

检查 API 地址时：

1. composables/api.ts
2. setup/main.ts
3. Vite 配置
4. 环境变量
5. Worker URL
6. Vercel production build

---

# 9. D1

D1 是博客动态数据存储。

涉及数据库修改时：

先检查：

- schema
- migration
- SQL
- Worker API
- 前端数据结构

不要直接删除数据库数据。

不要修改生产数据，除非用户明确要求。

遇到 SQL 错误：

先检查参数数量、字段名称、SQL schema 和 migration。

特别注意 INSERT / UPDATE 参数是否完整。

---

# 10. Backblaze B2

B2 用于 Valaxy/博客相关文件存储。

涉及上传、图片、附件时：

检查：

- Worker
- B2 bucket
- Access Key
- Secret Key
- 上传 API
- 文件 URL

不要输出或暴露：

UPLOAD_TOKEN
B2_ACCESS_KEY_ID
B2_SECRET_ACCESS_KEY

不要把 .dev.vars、密钥或 token 提交到 Git。

---

# 11. Vercel

生产环境使用 Vercel。

遇到：

- 页面正常但刷新 404
- 静态资源 404
- API 404
- CSS/JS 404
- 动态路由失败

先分别判断：

1. Vercel 路由
2. Valaxy 路由
3. SPA fallback
4. 静态资源 base
5. Worker API
6. 构建产物

不要看到 404 就立即修改 Worker。

---

# 12. Debug 规则

出现错误时不要猜。

先建立最小复现。

检查：

```bash
pwd
git status
git diff
```

再按顺序定位：

1. 查看错误日志，找到错误来源
2. grep 定位相关代码
3. 查看调用链与数据流
4. 分析根因后再修改

修改后验证：

```bash
npm run build
```

至少确认：TypeScript、Vue 编译、API 请求、路由、页面显示均正常。
