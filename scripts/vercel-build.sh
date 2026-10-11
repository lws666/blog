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


# ── noindex for the Vercel mirror ──────────────────────────────
# The Vercel deployment is a CDN line, not a canonical site: search
# engines must not index it. X-Robots-Tag (above) only fires on
# deployment-scoped responses — custom domains bypass it — so also
# inject a <meta robots> into every built index.html. This copy lives
# only in .vercel/output/static; the Cloudflare dist/ is untouched.
find .vercel/output/static -name 'index.html' | while read -r f; do
  # Drop the theme's own index,follow — conflicting robots directives are
  # unreliable across engines; keep exactly one, restrictive, directive.
  sed -i -e 's#<meta name="robots" content="index,follow[^>]*>##g' "$f"
  if ! grep -q 'name="robots"' "$f"; then
    sed -i 's#<head>#<head>\n    <meta name="robots" content="noindex, nofollow" />#' "$f"
  fi
done

cat > .vercel/output/config.json <<'EOF'
{
  "version": 3,
  "routes": [
    { "src": "/api/(.*)", "dest": "https://api.lwsnb.eu.cc/api/$1" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html", "headers": { "X-Robots-Tag": "noindex, nofollow" } }
  ]
}
EOF
