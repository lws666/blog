#!/usr/bin/env bash
# 在 InstaBox 沙箱 lwsnb 上构建 SvelteKit 站点，并把产物拉回本地 build/。
#
# 为什么不在本机构建：本机是 Cloud Shell（资源受限），
# 按 ~/.dsh/AGENTS.md 的铁律，构建一律走沙箱。
#
# 用法：
#   bash scripts/build-on-instabox.sh            # 完整构建
#   bash scripts/build-on-instabox.sh --skip-install   # 复用已装的依赖
#
# 前置：
#   ~/.config/instabox/api-key.env 里要有 INSTABOX_API_URL + INSTABOX_API_KEY
set -euo pipefail

MACHINE="${INSTABOX_MACHINE:-lwsnb}"
REMOTE_DIR="/data/workspace/blog"
LOCAL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_SK="$(cd "$LOCAL_ROOT/sveltekit" && pwd)"
SKIP_INSTALL=0
[[ "${1:-}" == "--skip-install" ]] && SKIP_INSTALL=1

export PATH="$HOME/.local/bin:$PATH"
# shellcheck disable=SC1090
source "$HOME/.config/instabox/api-key.env"

log() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

log "唤醒/确认机器 $MACHINE"
instabox wake "$MACHINE" >/dev/null 2>&1 || true

log "推送仓库到 $MACHINE:$REMOTE_DIR"
instabox push "$MACHINE" "$LOCAL_ROOT" "$REMOTE_DIR" >/dev/null

if [[ $SKIP_INSTALL -eq 0 ]]; then
  log "安装依赖"
  instabox exec "$MACHINE" -- "bash -lc 'cd $REMOTE_DIR/sveltekit && pnpm install --no-frozen-lockfile'" 2>&1 | tail -5
fi

log "构建"
instabox exec "$MACHINE" -- "bash -lc 'cd $REMOTE_DIR/sveltekit && pnpm run build'" 2>&1 | tail -8

log "打包产物（分块 base64，绕过 exec 的 1MB 输出上限）"
instabox exec "$MACHINE" -- "bash -lc 'cd $REMOTE_DIR/sveltekit && rm -f /tmp/bf.part.* && tar cz build | base64 -w0 | split -b 800000 - /tmp/bf.part. && ls /tmp/bf.part.* | wc -l'" > /tmp/.bf.parts
PARTS=$(tail -1 /tmp/.bf.parts | tr -dc '0-9')
echo "  分块数: $PARTS"

rm -f /tmp/bf.part.* /tmp/build.b64
i=0
for idx in $(seq 1 "$PARTS"); do
  # split 默认后缀 aa ab ac ...
  suffix=$(printf "\\$(printf '%03o' $((96 + idx)))")
  instabox exec "$MACHINE" -- "bash -lc 'cat /tmp/bf.part.$suffix'" >> /tmp/build.b64 2>/dev/null
  i=$((i+1))
done
echo "  已拉取 base64: $(wc -c < /tmp/build.b64) 字节"

log "解码解压到本地 build/"
rm -rf "$LOCAL_SK/build"
base64 -d /tmp/build.b64 > /tmp/build-full.tgz
tar xzf /tmp/build-full.tgz -C "$LOCAL_SK"

FILES=$(find "$LOCAL_SK/build" -type f | wc -l)
SIZE=$(du -sh "$LOCAL_SK/build" | cut -f1)
log "完成：$FILES 个文件 / $SIZE"
echo "  部署：cd sveltekit && npx wrangler pages deploy build --project-name lwsnb-sveltekit --branch main"
