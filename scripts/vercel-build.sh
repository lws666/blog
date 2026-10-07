#!/usr/bin/env bash
# Vercel build script — kept out of vercel.json because the CLI rejects
# buildCommand longer than 256 chars.
#
# 1. Clean build
# 2. Copy dist/* into .vercel/output/static
# 3. Emit .vercel/output/config.json:
#      /api/*  → proxy to api.lwsnb.eu.cc (blog-worker)  — dynamic posts
#      filesystem → serve dist assets
#      everything else → /index.html (SPA fallback)
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist .valaxy
# Use the repo-local valaxy binary (node_modules/.bin). Plain `npx valaxy`
# can resolve to the registry package and fail with "No pages directory
# found" because it runs outside the project's dependency tree.
./node_modules/.bin/valaxy build

mkdir -p .vercel/output/static
cp -r dist/* .vercel/output/static/

cat > .vercel/output/config.json <<'EOF'
{
  "version": 3,
  "routes": [
    { "src": "/api/(.*)", "dest": "https://api.lwsnb.eu.cc/api/$1" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
EOF
