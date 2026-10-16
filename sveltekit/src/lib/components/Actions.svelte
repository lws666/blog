<script lang="ts">
  import Icon from './Icon.svelte'
  import MusicPlayer from './MusicPlayer.svelte'
  import { i18n, t, toggleLang } from '#lib/i18n.svelte'

  let {
    theme,
    onToggleTheme,
    hasToc = false,
    tocItems = []
  }: {
    theme: 'light' | 'dark'
    onToggleTheme: () => void
    /** 文章页传 true，显示目录悬浮按钮 */
    hasToc?: boolean
    /** 目录条目（由文章页提供） */
    tocItems?: { id: string, text: string, level: number }[]
  } = $props()

  let visible = $state(false)
  let pct = $state(0)
  let tocOpen = $state(false)
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

<!-- 目录抽屉 -->
{#if tocItems.length}
  <!-- 遮罩（点空白关闭） -->
  {#if tocOpen}
    <button class="bf-toc-overlay bf-action--mobile-only" aria-label="关闭目录" onclick={() => (tocOpen = false)}></button>
  {/if}

  <aside
    class="bf-toc-drawer bf-action--mobile-only"
    class:bf-toc-drawer--open={tocOpen}
    aria-label={d.toc}
    aria-hidden={!tocOpen}
  >
    <div class="bf-toc-drawer__head">
      <span>{d.toc}</span>
      <button aria-label="关闭" title="关闭" onclick={() => (tocOpen = false)}>
        <Icon name="close" size={15} />
      </button>
    </div>
    <ul class="bf-toc__list">
      {#each tocItems as it (it.id)}
        <li>
          <a
            class="bf-toc__item"
            class:bf-toc__item--h3={it.level === 3}
            href={`#${it.id}`}
            onclick={() => (tocOpen = false)}
          >{it.text}</a>
        </li>
      {/each}
    </ul>
  </aside>
{/if}

<!-- 音乐面板（浮层，不占列位置） -->
<MusicPlayer bind:open={musicOpen} />

<div class="bf-actions">
  <!-- 顺序（自下而上）：回到顶部 → 主题 → 语言 → 目录
       与老版右下角排列一致（老版：gotop 在最下） -->

  <!-- 目录：仅移动端（桌面走右栏目录卡） -->
  {#if hasToc}
    <button
      class="bf-action bf-action--mobile-only"
      aria-label={d.toc}
      title={d.toc}
      onclick={() => (tocOpen = !tocOpen)}
    >
      <Icon name={tocOpen ? 'close' : 'list'} size={17} />
    </button>
  {/if}

  <!-- 音乐播放器（球在列内，面板浮在列左侧） -->
  <button
    class="yun-music-btn"
    aria-label={d.toggleMusic}
    title={d.toggleMusic}
    aria-expanded={musicOpen}
    onclick={() => (musicOpen = !musicOpen)}
  >
    <Icon name={musicOpen ? 'close' : 'music2'} size={17} />
  </button>

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

  <!-- 回到顶部（带百分比环，最下） -->
  <button
    class="bf-gotop"
    class:show={visible}
    aria-label={`${d.backToTop}（当前 ${pct}%）`}
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
    <!-- 文字为滚动百分比（对齐线上实测：环内显示 89 这样的数字） -->
    <span class="bf-gotop-text">{pct}</span>
  </button>
</div>
