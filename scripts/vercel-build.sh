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


# ── Anzhiyu-style fullpage loading (ported) ────────────────────
# Mirror of APP_SKELETON in src/index.js: full-viewport overlay with the
# site avatar pulsing + green dot; fades out on Vue mount (inline interval
# adds .loaded when .loading-bg disappears from #app). Inline-only, zero
# extra requests; runs only on the Vercel copy of the shell.
find .vercel/output/static -name 'index.html' | while read -r f; do
  if ! grep -q 'loading-box' "$f"; then
    python3 - "$f" <<'PYIN'
import sys, pathlib
f = pathlib.Path(sys.argv[1])
s = f.read_text()
AVATAR = 'https://img.lwsnb.eu.cc/file/1770349295364_IMG_20250823_144910_239.jpg'
css = (
 '<style id="az-loading-style">'
 '#loading-box{user-select:none;-webkit-user-select:none}'
 '#loading-box .loading-bg{display:flex;width:100%;height:100%;position:fixed;'
 'background:var(--va-c-bg,#f7f9fe);z-index:1001;opacity:1;overflow:hidden;'
 'transition:opacity .5s;align-items:center;justify-content:center}'
 '#loading-box .loading-img{width:100px;height:100px;border-radius:50%;margin:auto;'
 'border:4px solid #f0f0f2;animation-duration:.2s;animation-name:az-loading-action;'
 'animation-iteration-count:infinite;animation-direction:alternate;object-fit:cover}'
 '#loading-box .loading-image-dot{width:30px;height:30px;background:#6bdf8f;'
 'position:absolute;border-radius:50%;border:6px solid #fff;top:50%;left:50%;'
 'transform:translate(18px,24px)}'
 '#loading-box .loading-img{opacity:0;transition:opacity .15s}'
 '#loading-box .loading-img.az-ready{opacity:1}'
 '#loading-box .az-ring{position:absolute;width:100px;height:100px;margin:auto;'
 'border:4px solid rgba(73,177,245,.25);border-top-color:#49b1f5;border-radius:50%;'
 'animation:az-spin .8s linear infinite;box-shadow:0 0 0 4px #f0f0f2}'
 '#loading-box .az-ring.done{display:none}'
 '#loading-box.loaded .loading-bg{opacity:0;z-index:-1000;pointer-events:none}'
 '@keyframes az-loading-action{0%{opacity:1}100%{opacity:.4}}'
 '@keyframes az-show-loading{from{opacity:0}to{opacity:1}}'
 '@keyframes az-spin{to{transform:rotate(360deg)}}'
 '@media (prefers-reduced-motion:reduce){#loading-box .loading-img,#loading-box .az-ring{animation:none}}'
 '</style>')
box = (
 '<link rel="preload" as="image" href="' + AVATAR + '">'
 '<div id="loading-box" onclick="this.classList.add(\'loaded\')">'
 '<div class="loading-bg">'
 '<div class="az-ring" aria-hidden="true"></div>'
 f'<img class="loading-img" alt="加载头像" src="{AVATAR}">'
 '<div class="loading-image-dot"></div>'
 '</div>'
 '<script>(function(){'
 'var b=document.getElementById("loading-box");'
 'if(!b)return;'
 'var st=document.getElementById("az-loading-style");'
 'if(st)document.head.appendChild(st);'
 'var t0=Date.now(),avatarSeen=false;'
 'var img=b.querySelector(".loading-img");'
 'var ring=b.querySelector(".az-ring");'
 'function markAvatar(){if(!avatarSeen){avatarSeen=true;t0=Date.now();'
 'if(ring)ring.classList.add("done");'
 'if(img)img.classList.add("az-ready")}}'
 'if(img){if(img.complete&&img.naturalWidth>0)markAvatar();else{img.addEventListener("load",markAvatar);img.addEventListener("error",markAvatar)}}'
 'var done=false;'
 'function end(){if(done)return;done=true;'
 'var wait=Math.max(0,3000-(Date.now()-t0));'
 'setTimeout(function(){b.classList.add("loaded");'
 'setTimeout(function(){b.remove();var s=document.getElementById("az-loading-style");if(s)s.remove()},500)},wait)}'
 'window.addEventListener("load",end);'
 'setTimeout(end,12000);'
 'b.addEventListener("click",end);'
 'var t=setInterval(function(){'
 'var bg=b.querySelector(".loading-bg");'
 'if(!bg||getComputedStyle(bg).position!=="fixed"){end();clearInterval(t)}},60);'
 'setTimeout(function(){clearInterval(t)},12000);'
 '})();</' + 'script>'
 '</div>')
if '</body>' in s:
    # style 插到 </head> 前;box 插到 </body> 前 —— 都在 #app 之外,
    # Vue 水合不会触碰,最短显示时长因此可靠。
    s = s.replace('</head>', css + '</head>', 1)
    s = s.replace('</body>', box + '</body>', 1)
    f.write_text(s)
    print('injected anzhiyu loading:', f)
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
