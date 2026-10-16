<script lang="ts">
  import Icon from './Icon.svelte'

  /**
   * 音乐播放器 —— 使用自建 API（与 Valaxy 版一致）：
   *   https://music.lwsnb.eu.cc/api?server=netease&type=playlist&id=<歌单ID>
   * 返回 JSON 数组：[{ title, author, pic, url, lrc }]
   *
   * 用原生 <audio> 实现（不引第三方库）：列表可点、显示封面/歌名/歌手，
   * 支持上一首/下一首，懒加载（首次展开才请求）。
   */
  const API = 'https://music.lwsnb.eu.cc/api'
  const SERVER = 'netease'
  const PLAYLIST = '18318692237'

  interface Song { title: string; author: string; pic: string; url: string; lrc?: string }

  let { open = $bindable(false) }: { open?: boolean } = $props()

  let songs = $state<Song[]>([])
  let index = $state(0)
  let loading = $state(false)
  let error = $state('')
  let audioEl = $state<HTMLAudioElement | null>(null)
  let playing = $state(false)
  let loaded = false

  const current = $derived(songs[index])

  async function load() {
    if (loaded) return
    loaded = true
    loading = true
    error = ''
    try {
      const r = await fetch(`${API}?server=${SERVER}&type=playlist&id=${PLAYLIST}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      songs = Array.isArray(data) ? data : []
      if (!songs.length) error = '歌单为空'
    } catch (e) {
      error = (e as Error).message || '加载失败'
    } finally {
      loading = false
    }
  }

  function play(i: number) {
    index = i
    playing = true
    queueMicrotask(() => audioEl?.play().catch(() => (playing = false)))
  }

  function toggle() {
    if (!audioEl) return
    if (audioEl.paused) {
      audioEl.play().then(() => (playing = true)).catch(() => (playing = false))
    } else {
      audioEl.pause()
      playing = false
    }
  }

  function step(d: number) {
    if (!songs.length) return
    play((index + d + songs.length) % songs.length)
  }

  // 展开时加载歌单
  $effect(() => {
    if (open) load()
  })
</script>

{#if open}
  <div class="bf-music-panel">
    {#if loading}
      <p class="bf-music-msg">加载中…</p>
    {:else if error}
      <p class="bf-music-msg">⚠ {error}</p>
    {:else if current}
      <div class="bf-music-now">
        {#if current.pic}
          <img class="bf-music-pic" src={current.pic} alt="" loading="lazy" />
        {/if}
        <div class="bf-music-meta">
          <strong title={current.title}>{current.title}</strong>
          <span>{current.author}</span>
        </div>
      </div>

      <div class="bf-music-ctrl">
        <button aria-label="上一首" onclick={() => step(-1)}><Icon name="prev" size={15} /></button>
        <button class="bf-music-play" aria-label={playing ? '暂停' : '播放'} onclick={toggle}>
          <Icon name={playing ? 'pause' : 'play'} size={17} />
        </button>
        <button aria-label="下一首" onclick={() => step(1)}><Icon name="next" size={15} /></button>
      </div>

      <ul class="bf-music-list">
        {#each songs.slice(0, 40) as s, i (s.url)}
          <li>
            <button class:active={i === index} onclick={() => play(i)} title={`${s.title} - ${s.author}`}>
              {s.title}<span> — {s.author}</span>
            </button>
          </li>
        {/each}
      </ul>

      <audio
        bind:this={audioEl}
        src={current.url}
        preload="none"
        onplay={() => (playing = true)}
        onpause={() => (playing = false)}
        onended={() => step(1)}
      ></audio>
    {/if}
  </div>
{/if}
