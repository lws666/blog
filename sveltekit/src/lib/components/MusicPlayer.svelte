<script lang="ts">
  import { t } from '#lib/i18n.svelte'

  /**
   * 音乐播放器面板 —— 与老版 components/MusicPlayer.vue 的「面板部分」一致。
   *
   * 与老版的结构差异（有意）：老版把「面板 + 圆形按钮」包在 .yun-music 里
   * 自行 fixed 定位；本项目右下角是多项悬浮球列，音乐球已并入该列
   * （由 Actions.svelte 渲染），因此这里只输出面板，不再自带按钮，
   * 否则两个球会在同一位置重叠、盖住相邻按钮。
   *
   * 数据源与老版相同：自建 Meting API。
   */
  import { site } from '#lib/site'

  const API = site.music.api
  const SERVER = site.music.server
  const TYPE = site.music.type
  const ID = site.music.id

  import { probeAll, type RawSong } from '#lib/music'

  interface Song { title: string; author: string; pic: string; url: string; lrc?: string }

  let { open = $bindable(false) }: { open?: boolean } = $props()

  let loading = $state(false)
  let errorMsg = $state('')
  let container = $state<HTMLElement | null>(null)
  let loaded = false
  /** 正在逐首探测音源可用性 */
  let probing = $state(false)
  /** 因不可播放而被跳过的曲目数 */
  let skipped = $state(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let player: any = null

  const d = $derived(t())

  const toAudio = (list: Song[]) =>
    list.map(s => ({ name: s.title, artist: s.author, url: s.url, cover: s.pic, lrc: s.lrc }))

  async function initPlayer() {
    if (loaded || loading) return
    loading = true
    errorMsg = ''
    try {
      const url = `${API}/api?server=${SERVER}&type=${TYPE}&id=${ID}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`API ${res.status}`)
      const raw = (await res.json()) as RawSong[]
      if (!Array.isArray(raw) || !raw.length) throw new Error('歌单为空')

      // 逐首探测：只保留真正返回音频的曲目
      probing = true
      const { songs: probed, playableCount } = await probeAll(raw)
      probing = false
      const data = probed.filter(s => s.playable)
      skipped = probed.length - playableCount
      if (!data.length) {
        throw new Error(
          `歌单中 ${probed.length} 首全部无法播放（音源受版权/VIP 限制）`,
        )
      }

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

  $effect(() => {
    if (open) queueMicrotask(initPlayer)
  })

  $effect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') open = false
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // 仅在组件真正卸载（离开页面）时销毁；关闭面板不销毁，
  // 否则重新打开时 loaded=true 会让 initPlayer 直接 return，
  // 结果就是「关了再开没有播放器/没有声音」
  $effect(() => () => {
    try { player?.destroy?.() } catch { /* ignore */ }
    player = null
    loaded = false
  })
</script>

<section
  class="yun-music-panel"
  class:yun-music-panel--hidden={!open}
  aria-label={d.music}
  aria-hidden={!open}
>
    <header class="yun-music-head">
      <span class="yun-music-title">{d.music}</span>
      <button
        class="yun-music-close"
        title="收起"
        aria-label="收起"
        onclick={() => (open = false)}>×</button
      >
    </header>

    {#if loading}
      <p class="yun-music-hint">{probing ? '正在检测音源…' : '加载中…'}</p>
    {:else if errorMsg}
      <p class="yun-music-hint yun-music-err">{errorMsg}</p>
    {:else if skipped > 0}
      <p class="yun-music-hint">已跳过 {skipped} 首不可播放的歌曲</p>
    {/if}

  <!-- APlayer 挂载点 -->
  <div class="yun-music-body" bind:this={container}></div>
</section>
