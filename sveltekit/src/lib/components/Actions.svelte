<script lang="ts">
  import Icon from './Icon.svelte'
  import { i18n, t, toggleLang } from '#lib/i18n.svelte'

  let {
    theme,
    onToggleTheme
  }: { theme: 'light' | 'dark'; onToggleTheme: () => void } = $props()

  let visible = $state(false)
  let pct = $state(0)
  let musicOpen = $state(false)

  const d = $derived(t())

  // 滚动进度 + 回到顶部可见性（对齐线上 .bf-gotop.show 与百分比环）
  $effect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      pct = h > 0 ? Math.min(100, Math.round((window.scrollY / h) * 100)) : 0
      visible = window.scrollY > 300
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  })

  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  // 进度环：r=46
  const R = 46
  const C = 2 * Math.PI * R
  const offset = $derived(C * (1 - pct / 100))
</script>

<div class="bf-actions">
  <!-- 音乐播放器 -->
  <button
    class="bf-action"
    aria-label={d.toggleMusic}
    title={d.toggleMusic}
    onclick={() => (musicOpen = !musicOpen)}
  >
    <Icon name={musicOpen ? 'close' : 'music2'} size={17} />
  </button>

  {#if musicOpen}
    <div class="bf-music-panel">
      <iframe
        title="music"
        frameborder="no"
        marginwidth="0"
        marginheight="0"
        width="300"
        height="110"
        src="//music.163.com/outchain/player?type=playlist&id=18318692237&auto=0&height=90"
      ></iframe>
    </div>
  {/if}

  <!-- 语言切换 -->
  <button
    class="bf-action"
    aria-label={d.toggleLang}
    title={`${d.toggleLang} (${i18n.lang === 'zh' ? '中文' : 'EN'})`}
    onclick={toggleLang}
  >
    <Icon name="translate" size={17} />
  </button>

  <!-- 亮暗切换 -->
  <button
    class="bf-action"
    aria-label={d.toggleTheme}
    title={d.toggleTheme}
    onclick={onToggleTheme}
  >
    <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
  </button>

  <!-- 回到顶部（带百分比环） -->
  <button
    class="bf-gotop"
    class:show={visible}
    aria-label={d.backToTop}
    title={d.backToTop}
    onclick={toTop}
  >
    <svg class="bf-gotop-ring" viewBox="0 0 100 100" aria-hidden="true">
      <circle
        cx="50" cy="50" r={R} fill="none"
        stroke="currentColor" stroke-width="6" stroke-linecap="round"
        stroke-dasharray={`${C} ${C}`}
        stroke-dashoffset={offset}
      />
    </svg>
    <span class="bf-gotop-text">{pct >= 100 ? '↑' : `${pct}`}</span>
  </button>
</div>
