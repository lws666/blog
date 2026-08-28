<script setup lang="ts">
/**
 * MusicPlayer — floating mini music player backed by the self-hosted
 * Meting API (https://music.lwsnb.dpdns.org).
 *
 * Design constraints:
 *  - Collapsed by default; expands only on click (never auto-expands).
 *  - Never autoplays: APlayer is created with autoplay false, and the
 *    playlist is not even fetched until the user first opens the panel.
 *  - Styled with the theme's own CSS variables (--va-c-*) so it follows
 *    valaxy-theme-yun in both light and dark mode.
 *  - Client-only: APlayer touches window/document, so it is imported
 *    dynamically after mount and the whole thing lives behind <ClientOnly>.
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

interface Song {
  title: string
  author: string
  pic: string
  url: string
  lrc: string
}

const props = withDefaults(defineProps<{
  /** Meting API base, e.g. https://music.lwsnb.dpdns.org */
  api?: string
  /** netease | tencent */
  server?: string
  /** song | playlist | artist | album */
  type?: string
  /** Playlist / song id */
  id?: string
  /** Panel title */
  title?: string
}>(), {
  api: 'https://music.lwsnb.dpdns.org',
  server: 'netease',
  type: 'playlist',
  id: '60198',
  title: '音乐',
})

const open = ref(false)
const loading = ref(false)
const errorMsg = ref('')
const loaded = ref(false)
const playerEl = ref<HTMLElement | null>(null)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let player: any = null

/** Map Meting's response to APlayer's audio shape */
function toAudio(list: Song[]) {
  return list.map(s => ({
    name: s.title,
    artist: s.author,
    url: s.url,
    cover: s.pic,
    lrc: s.lrc,
    // No per-track `theme`: APlayer would use it as an inline
    // background-color on the cover, overriding our themed accent.
  }))
}

async function initPlayer() {
  if (loaded.value || loading.value) return

  loading.value = true
  errorMsg.value = ''

  try {
    const url = `${props.api}/api?server=${encodeURIComponent(props.server)}`
      + `&type=${encodeURIComponent(props.type)}`
      + `&id=${encodeURIComponent(props.id)}`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`API ${res.status}`)

    const data = (await res.json()) as Song[]
    if (!Array.isArray(data) || !data.length) throw new Error('歌单为空')

    // APlayer is browser-only — load it lazily so SSG/build stays clean
    const [{ default: APlayer }] = await Promise.all([
      import('aplayer'),
      import('aplayer/dist/APlayer.min.css'),
    ])

    await nextTick()
    if (!playerEl.value) throw new Error('容器未就绪')

    player = new APlayer({
      container: playerEl.value,
      audio: toAudio(data),
      // Explicitly off: the player must never start on its own
      autoplay: false,
      fixed: false,
      mini: false,
      listFolded: false,
      listMaxHeight: '160px',
      lrcType: 3,
      preload: 'none',
      volume: 0.7,
      theme: '#b3b3b3',
    })

    loaded.value = true
  } catch (e) {
    errorMsg.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

/** Toggle the panel; the playlist is fetched on first open only */
function toggle() {
  open.value = !open.value
  if (open.value) initPlayer()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) open.value = false
}

/**
 * The theme renders a right-side TOC aside (.yun-aside) on article and
 * listing pages. On long articles it reaches the viewport bottom on the
 * right — together with the back-to-top button there is no room left for
 * this player. When detected, the player flips to the BOTTOM-LEFT corner
 * (its original position) instead of overlapping the TOC.
 */
const tocAvoid = ref(false)

function updateTocAvoid() {
  const aside = document.querySelector('.yun-aside')
  if (!aside) {
    tocAvoid.value = false
    return
  }
  const asideBottom = aside.getBoundingClientRect().bottom
  const vh = window.innerHeight
  // The player's default resting row occupies the last ~112px of viewport
  // height (button 40px + bottom offset 72px). If the aside descends into
  // that band, the right corner is full.
  tocAvoid.value = asideBottom > vh - 112
}

const onResize = () => updateTocAvoid()

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', onResize)
  // Wait for the page (and its aside) to render, then keep in sync on nav
  setTimeout(updateTocAvoid, 300)
  setTimeout(updateTocAvoid, 1200)
  watch(() => route.path, () => {
    setTimeout(updateTocAvoid, 300)
    setTimeout(updateTocAvoid, 1200)
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  // Release the audio element so navigating away cannot keep sound running
  player?.destroy?.()
  player = null
})
</script>

<template>
  <div class="yun-music" :class="{ 'is-open': open, 'toc-avoid': tocAvoid }">
    <!-- Panel -->
    <transition name="yun-music-fade">
      <section v-show="open" class="yun-music-panel" aria-label="音乐播放器">
        <header class="yun-music-head">
          <span class="yun-music-title">{{ title }}</span>
          <button class="yun-music-close" title="收起" @click="open = false">
            &times;
          </button>
        </header>

        <p v-if="loading" class="yun-music-hint">加载中…</p>
        <p v-else-if="errorMsg" class="yun-music-hint yun-music-err">
          {{ errorMsg }}
        </p>

        <!-- APlayer mounts here -->
        <div ref="playerEl" class="yun-music-body" />
      </section>
    </transition>

    <!-- Toggle button -->
    <button
      class="yun-music-btn"
      :title="open ? '收起音乐' : '打开音乐'"
      :aria-expanded="open"
      @click="toggle"
    >
      <div :class="open ? 'i-ri-close-line' : 'i-ri-music-2-line'" />
    </button>
  </div>
</template>

<style lang="scss">
.yun-music {
  position: fixed;
  right: 1rem;
  bottom: 4.5rem; /* above the theme's back-to-top button (right, bottom:1rem) */
  z-index: 15;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;

  /* Right corner is full (long TOC aside + back-to-top): flip to bottom-left */
  &.toc-avoid {
    right: auto;
    left: 1rem;
    bottom: 1rem;
    align-items: flex-start;
  }
}

.yun-music-btn {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: var(--va-c-text-2, #666);
  background: var(--va-c-bg, #fff);
  border: 1px solid var(--va-c-divider, rgba(125, 125, 125, 0.2));
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.08);
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s, transform 0.2s;

  &:hover {
    color: var(--va-c-primary, #0078e7);
    border-color: var(--va-c-primary, #0078e7);
    transform: scale(1.06);
  }
}

.yun-music-panel {
  width: min(20rem, calc(100vw - 2rem));
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: var(--va-c-bg, #fff);
  border: 1px solid var(--va-c-divider, rgba(125, 125, 125, 0.2));
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.12);
}

.yun-music-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--va-c-divider, rgba(125, 125, 125, 0.2));
}

.yun-music-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--va-c-primary, #0078e7);
}

.yun-music-close {
  font-size: 1.1rem;
  line-height: 1;
  color: var(--va-c-text-2, #888);
  background: none;
  border: none;
  cursor: pointer;

  &:hover { color: var(--va-c-primary, #0078e7); }
}

.yun-music-hint {
  margin: 0.25rem 0;
  font-size: 0.75rem;
  opacity: 0.6;
}

.yun-music-err { color: var(--va-c-danger, #e34d59); }

/* Blend APlayer into the theme */
.yun-music-body.aplayer {
  margin: 0;
  background: transparent;
  box-shadow: none;
  font-family: inherit;
}

.yun-music-body.aplayer .aplayer-info { border-bottom: none; }

.yun-music-body.aplayer .aplayer-title,
.yun-music-body.aplayer .aplayer-author {
  color: var(--va-c-text-1, #333);
}

.yun-music-body.aplayer .aplayer-list ol li {
  border-top-color: var(--va-c-divider, rgba(125, 125, 125, 0.15));
  color: var(--va-c-text-2, #666);
}

.yun-music-body.aplayer .aplayer-list ol li:hover {
  background: var(--va-c-bg-soft, rgba(125, 125, 125, 0.08));
}

.yun-music-body.aplayer .aplayer-list ol li.aplayer-list-light {
  background: var(--va-c-bg-mute, rgba(125, 125, 125, 0.12));
}

.yun-music-fade-enter-active,
.yun-music-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.yun-music-fade-enter-from,
.yun-music-fade-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

@media (max-width: 768px) {
  .yun-music {
    right: 0.75rem;
    bottom: 4.25rem;
  }
}
</style>
