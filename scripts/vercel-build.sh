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
# Script lives in scripts/ — the project root is its parent.
# (Vercel runs `bash scripts/vercel-build.sh` from the repo root.)
cd "$(dirname "$0")/.."

rm -rf dist .valaxy
# Call valaxy's real entry with node. node_modules/.bin/valaxy is a symlink,
# which does not survive Vercel's file upload (only regular files are
# uploaded), and `npx valaxy` may resolve to the registry package.
node node_modules/valaxy/bin/valaxy.mjs build

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
