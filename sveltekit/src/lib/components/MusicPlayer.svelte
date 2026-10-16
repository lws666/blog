<script lang="ts">
  import Icon from './Icon.svelte'
  import { t } from '#lib/i18n.svelte'

  /**
   * 音乐播放器（右下角悬浮按钮展开的面板）。
   *
   * 数据源：自建 API
   *   https://music.lwsnb.eu.cc/api?server=netease&type=playlist&id=<歌单>
   *
   * 面板带显式关闭按钮（手机上尤其必要：原先只能再点一次悬浮按钮收起，
   * 容易被忽略而「关不掉」）。
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

  const d = $derived(t())
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
      songs = Array.isArray(data) ? data.filter((x: Song) => x?.url) : []
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
    // 等 src 更新后再播放
    queueMicrotask(() => audioEl?.play().catch(() => (playing = false)))
  }

  function toggle() {
    if (!audioEl) { if (current) play(index); return }
    if (audioEl.paused) audioEl.play().then(() => (playing = true)).catch(() => (playing = false))
    else { audioEl.pause(); playing = false }
  }

  function step(delta: number) {
    if (!songs.length) return
    play((index + delta + songs.length) % songs.length)
  }

  function close() { open = false }

  $effect(() => { if (open) load() })

  // Esc 关闭（桌面友好）
  $effect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
</script>

{#if open}
  <!-- 移动端遮罩：点击空白处也能关闭 -->
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
      {:else if current}
        <div class="bf-music-now">
          {#if current.pic}
            <img class="bf-music-pic" src={current.pic} alt="" loading="lazy"
                 class:spinning={playing} />
          {/if}
          <div class="bf-music-meta">
            <strong title={current.title}>{current.title}</strong>
            <span>{current.author}</span>
          </div>
        </div>

        <div class="bf-music-ctrl">
          <button aria-label="上一首" title="上一首" onclick={() => step(-1)}>
            <Icon name="prev" size={16} />
          </button>
          <button class="bf-music-play" aria-label={playing ? '暂停' : '播放'}
                  title={playing ? '暂停' : '播放'} onclick={toggle}>
            <Icon name={playing ? 'pause' : 'play'} size={18} />
          </button>
          <button aria-label="下一首" title="下一首" onclick={() => step(1)}>
            <Icon name="next" size={16} />
          </button>
        </div>

        <ul class="bf-music-list">
          {#each songs.slice(0, 50) as s, i (s.url + i)}
            <li>
              <button class:active={i === index} onclick={() => play(i)}
                      title={`${s.title} - ${s.author}`}>
                <span class="bf-music-index">{i + 1}</span>
                <span class="bf-music-name">{s.title}</span>
                <span class="bf-music-author">{s.author}</span>
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
  </section>
{/if}
