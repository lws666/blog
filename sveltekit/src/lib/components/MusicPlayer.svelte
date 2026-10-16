<script lang="ts">
  import Icon from './Icon.svelte'
  import { t } from '#lib/i18n.svelte'

  /**
   * 音乐播放器 —— 用 APlayer（与老版 Valaxy 站一致），外观即老版的样子：
   * 圆角封面 + 歌名/歌手 + 进度条 + 音量 + 播放列表 + 歌词滚动。
   *
   * 数据源：自建 Meting API
   *   https://music.lwsnb.eu.cc/api?server=netease&type=playlist&id=<歌单>
   *
   * 设计约束（沿用老版）：
   *  - 默认收起，点击悬浮按钮才展开；绝不自动播放
   *  - 首次展开才请求歌单
   *  - 客户端动态 import APlayer（只用 CSS/JS 时不影响预渲染）
   */
  const API = 'https://music.lwsnb.eu.cc'
  const SERVER = 'netease'
  const TYPE = 'playlist'
  const ID = '18318692237'

  interface Song { title: string; author: string; pic: string; url: string; lrc?: string }

  let { open = $bindable(false) }: { open?: boolean } = $props()

  let loading = $state(false)
  let error = $state('')
  let container = $state<HTMLElement | null>(null)
  let loaded = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let player: any = null

  const d = $derived(t())

  /** Meting -> APlayer 音频结构 */
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
    error = ''
    try {
      const url = `${API}/api?server=${SERVER}&type=${TYPE}&id=${ID}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = (await res.json()) as Song[]
      if (!Array.isArray(data) || !data.length) throw new Error('歌单为空')

      // APlayer 是 UMD 包（依赖 window/document），动态加载以保证预渲染安全。
      // UMD 在打包器下通过 default 导出，而不是挂到 window.APlayer。
      await import('aplayer/dist/APlayer.min.css')
      const mod = await import('aplayer')
      const APlayerCtor = ((mod as { default?: unknown }).default ?? mod) as
        | (new (o: unknown) => unknown)
        | undefined
      if (typeof APlayerCtor !== 'function') throw new Error('APlayer 加载失败')

      // 等待容器渲染
      await new Promise(r => requestAnimationFrame(r))
      if (!container) throw new Error('容器未就绪')

      player = new APlayerCtor({
        container,
        audio: toAudio(data),
        autoplay: false,      // 绝不自动播放
        fixed: false,
        mini: false,
        listFolded: false,
        listMaxHeight: '150px',
        lrcType: 3,
        preload: 'none',
        volume: 0.7,
        theme: '#49b1f5',
      })
      loaded = true
    } catch (e) {
      error = (e as Error).message || '加载失败'
    } finally {
      loading = false
    }
  }

  function close() {
    open = false
    // 关闭时暂停，避免后台继续播放
    try { player?.pause?.() } catch { /* ignore */ }
  }

  $effect(() => {
    if (open) queueMicrotask(initPlayer)
  })

  $effect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
</script>

{#if open}
  <button class="bf-music-scrim" aria-label="关闭音乐播放器" onclick={close}></button>

  <section class="bf-music-panel" aria-label={d.music}>
    <header class="bf-music-head">
      <span class="bf-music-head__title">
        <Icon name="music2" size={15} /> {d.music}
      </span>
      <button class="bf-music-close" aria-label="关闭" title="关闭" onclick={close}>
        <Icon name="close" size={16} />
      </button>
    </header>

    <div class="bf-music-body">
      {#if loading}
        <p class="bf-music-msg">加载中…</p>
      {:else if error}
        <p class="bf-music-msg">⚠ {error}</p>
      {/if}
      <!-- APlayer 挂载点 -->
      <div class="bf-aplayer" bind:this={container}></div>
    </div>
  </section>
{/if}
