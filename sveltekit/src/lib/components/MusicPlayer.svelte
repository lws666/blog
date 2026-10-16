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
  let srcError = $state(false)
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

      // 探测音源可用性：网易云外链近年常被 302 到 404 页，
      // 此时提示用户而不是静默无声
      await probeSources(data)

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

  /**
   * 探测每首歌的直链是否真的返回音频。
   * Meting 的 type=url 是 302 到网易云外链，若上游封锁会落到 /404（HTML）。
   */
  async function probeSources(list: Song[]) {
    try {
      const s0 = list[0]
      if (!s0?.url) return
      const r = await fetch(s0.url, { method: 'GET', redirect: 'follow' })
      const ct = r.headers.get('content-type') || ''
      // 不是音频即视为音源失效
      if (!/audio|octet-stream|mpeg/i.test(ct)) srcError = true
    } catch {
      // CORS / 网络失败也提示（浏览器无法直接取音频流）
      srcError = true
    }
  }

  $effect(() => {
    if (open) queueMicrotask(initPlayer)
  })

  $effect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        open = false
        try { player?.pause?.() } catch { /* ignore */ }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  $effect(() => () => {
    try { player?.destroy?.() } catch { /* ignore */ }
    player = null
  })
</script>

{#if open}
  <section class="yun-music-panel" aria-label={d.music}>
    <header class="yun-music-head">
      <span class="yun-music-title">{d.music}</span>
      <button
        class="yun-music-close"
        title="收起"
        aria-label="收起"
        onclick={() => {
          open = false
          try { player?.pause?.() } catch { /* ignore */ }
        }}>×</button
      >
    </header>

    {#if loading}
      <p class="yun-music-hint">加载中…</p>
    {:else if errorMsg}
      <p class="yun-music-hint yun-music-err">{errorMsg}</p>
    {:else if srcError}
      <p class="yun-music-hint yun-music-err">
        ⚠ 音源暂不可用（音乐 API 上游返回的不是音频流），播放可能无声
      </p>
    {/if}

    <!-- APlayer 挂载点 -->
    <div class="yun-music-body" bind:this={container}></div>
  </section>
{/if}
