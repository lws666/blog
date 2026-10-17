#!/usr/bin/env bash
# Vercel build script — SvelteKit 版（静态预渲染站点）。
#
# 产物形态（与 Cloudflare Pages 一致）：
#   - sveltekit/build/* 为 adapter-static 预渲染的静态 HTML
#   - /admin/* 由 admin.html（SPA fallback）接管
#   - 未知路径 → 404.html（真实 404，不是 200+首页）
#   - /api/* → 代理到 api.lwsnb.eu.cc（blog-worker）
#
# Vercel 输出 API（Build Output v3）：
#   static/      纯静态文件
#   config.json  路由：/api 代理 → filesystem → /admin/* 重写 → 404
set -euo pipefail
cd "$(dirname "$0")/.."   # 仓库根

# 1) 构建 SvelteKit（根 package.json 的 workspaces 不含 sveltekit/，
#    所以直接进目录构建；Vercel 的 installCommand 只装根依赖）
if [ ! -f sveltekit/build/index.html ] || [ "${VERCEL_FORCE_BUILD:-0}" = "1" ]; then
  (cd sveltekit && npm install --no-audit --no-fund && npm run build)
fi

# 2) 组装 Build Output v3
rm -rf .vercel/output
mkdir -p .vercel/output/static
cp -r sveltekit/build/* .vercel/output/static/

# _redirects 是 Cloudflare Pages 的机制，Vercel 不识别，移除避免泄露
rm -f .vercel/output/static/_redirects

# 3) 路由：API 代理 + /admin/* → admin.html + 兜底 404.html
#    注意顺序：filesystem 放在 admin 重写之前——真实存在的静态文件
#    （/blog/xxx/index.html 等）优先；/admin/new/ 这类无实体目录的
#    路径才落到重写。
cat > .vercel/output/config.json <<'EOF'
{
  "version": 3,
  "routes": [
    { "src": "/api/(.*)", "dest": "https://api.lwsnb.eu.cc/api/$1" },
    { "src": "/twikoo", "dest": "https://api.lwsnb.eu.cc/twikoo" },
    { "handle": "filesystem" },
    { "src": "/admin/(.*)", "dest": "/admin.html" },
    { "src": "/(.*)", "dest": "/404.html", "status": 404 }
  ]
}
EOF

echo "vercel build output ready: .vercel/output/static"
