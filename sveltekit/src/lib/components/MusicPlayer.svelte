<script lang="ts">
  import { t } from '#lib/i18n.svelte'

  /**
   * 音乐播放器 —— 与老版 Valaxy 站（components/MusicPlayer.vue）1:1 对齐。
   *
   * 结构（老版）：
   *   .yun-music（fixed，右下，纵向 flex）
   *     └ section.yun-music-panel   ← 面板在按钮「上方」，点按钮展开/收起
   *          header.yun-music-head（标题 + × 收起）
   *          p.yun-music-hint（加载中 / 错误）
   *          div.yun-music-body ← APlayer 挂载点
   *     └ button.yun-music-btn      ← 圆形音乐按钮（打开时变 ×）
   *
   * 老版没有遮罩层，关闭靠：再点按钮 / 面板里的 × / Esc。
   * 数据源：自建 Meting API（同老版）。
   */
  const API = 'https://music.lwsnb.eu.cc'
  const SERVER = 'netease'
  const TYPE = 'playlist'
  const ID = '18318692237'

  interface Song { title: string; author: string; pic: string; url: string; lrc?: string }

  let { open = $bindable(false) }: { open?: boolean } = $props()

  let loading = $state(false)
  let errorMsg = $state('')
  let container = $state<HTMLElement | null>(null)
  let loaded = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let player: any = null

  const d = $derived(t())

  /** Meting -> APlayer 音频结构（无 per-track theme，避免覆盖主题色） */
  const toAudio = (list: Song[]) =>
    list.map(s => ({
      name: s.title,
      artist: s.author,
      url: s.url,
      cover: s.pic,
      lrc: s.lrc,
    }))

  async function initPlayer() {
    if (loaded || loading) return
    loading = true
    errorMsg = ''
    try {
      const url = `${API}/api?server=${SERVER}&type=${TYPE}&id=${ID}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = (await res.json()) as Song[]
      if (!Array.isArray(data) || !data.length) throw new Error('歌单为空')

      // UMD 包：必须用 import 的 default 导出（不是 window.APlayer）
      await import('aplayer/dist/APlayer.min.css')
      const mod = await import('aplayer')
      const APlayerCtor = ((mod as { default?: unknown }).default ?? mod) as
        | (new (o: unknown) => unknown)
        | undefined
      if (typeof APlayerCtor !== 'function') throw new Error('APlayer 加载失败')

      await new Promise(r => requestAnimationFrame(r))
      if (!container) throw new Error('容器未就绪')

      player = new APlayerCtor({
        container,
        audio: toAudio(data),
        autoplay: false,      // 绝不自动播放
        fixed: false,
        mini: false,
        listFolded: false,
        listMaxHeight: '160px',
        lrcType: 3,
        preload: 'none',
        volume: 0.7,
        theme: '#49b1f5',
      })
      loaded = true
    } catch (e) {
      errorMsg = (e as Error).message || '加载失败'
    } finally {
      loading = false
    }
  }

  function toggle() {
    open = !open
    if (open) queueMicrotask(initPlayer)
    else { try { player?.pause?.() } catch { /* ignore */ } }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) open = false
  }

  $effect(() => {
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  })

  $effect(() => () => {
    // 卸载时销毁播放器，避免离开页面后仍在播放
    try { player?.destroy?.() } catch { /* ignore */ }
    player = null
  })
</script>

<div class="yun-music" class:is-open={open}>
  {#if open}
    <section class="yun-music-panel" aria-label="音乐播放器">
      <header class="yun-music-head">
        <span class="yun-music-title">{d.music}</span>
        <button class="yun-music-close" title="收起" aria-label="收起" onclick={() => (open = false)}>
          ×
        </button>
      </header>

      {#if loading}
        <p class="yun-music-hint">加载中…</p>
      {:else if errorMsg}
        <p class="yun-music-hint yun-music-err">{errorMsg}</p>
      {/if}

      <!-- APlayer 挂载点 -->
      <div class="yun-music-body" bind:this={container}></div>
    </section>
  {/if}

  <!-- 圆形音乐按钮（打开时显示 ×） -->
  <button
    class="yun-music-btn"
    title={open ? '收起音乐' : '打开音乐'}
    aria-label={open ? '收起音乐' : '打开音乐'}
    aria-expanded={open}
    onclick={toggle}
  >
    {#if open}
      <span class="yun-music-x" aria-hidden="true">×</span>
    {:else}
      <span class="yun-music-note" aria-hidden="true">♪</span>
    {/if}
  </button>
</div>
