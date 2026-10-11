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


# ── First-paint skeleton inside #app ───────────────────────────
# The SPA shell ships an empty <div id="app">, so the first 0.3-0.9s is a
# white void until Vue mounts. Inject an inline skeleton (background +
# spinner) that Vue wipes on mount. Mirrors APP_SKELETON in src/index.js,
# which does the same for the Cloudflare entry Worker.
find .vercel/output/static -name 'index.html' | while read -r f; do
  if ! grep -q 'bfs-spin' "$f"; then
    python3 - "$f" <<'PYIN'
import sys, pathlib
f = pathlib.Path(sys.argv[1])
s = f.read_text()
skeleton = ('<div style="position:fixed;inset:0;display:flex;align-items:center;'
            'justify-content:center;background:var(--va-c-bg,#f7f9fe)">'
            '<div style="width:34px;height:34px;border:3px solid rgba(73,177,245,.25);'
            'border-top-color:#49b1f5;border-radius:50%;animation:bfs-spin .8s linear infinite"></div>'
            '<style>@keyframes bfs-spin{to{transform:rotate(360deg)}}'
            '@media (prefers-reduced-motion:reduce){[style*="bfs-spin"]{animation:none}}</style>'
            '</div>')
f.write_text(s.replace('<div id="app"></div>', '<div id="app">' + skeleton + '</div>'))
PYIN
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
