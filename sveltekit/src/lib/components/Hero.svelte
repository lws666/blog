<script lang="ts">
  import { site } from '#lib/site'

  /**
   * Hero —— 对齐线上：
   * - 全屏背景图（themeConfig.banner.url）+ 遮罩
   * - 大标题（Noto Serif SC 900 / 60px）
   * - 副标题为「每日一言」打字机（含出处）
   * - 底部波浪 + 下滑箭头
   */
  let { background = site.banner }: { background?: string } = $props()

  interface Quote { text: string; from: string }
  let items: Quote[] = $state([])
  let typed = $state('')
  let from = $state('')
  let idx = $state(0)
  let char = $state(0)
  let deleting = $state(false)

  /** 每日一言（Hitokoto）；失败时退回站点标语 */
  async function loadQuotes() {
    const fallback: Quote[] = site.taglines.map(t => ({ text: t, from: '' }))
    try {
      const out: Quote[] = []
      for (const c of ['d', 'i', 'k']) {
        try {
          const r = await fetch(`https://v1.hitokoto.cn/?encode=json&charset=utf-8&c=${c}`)
          const d = await r.json()
          if (d?.hitokoto) out.push({ text: d.hitokoto, from: d.from_who || d.from || '' })
        } catch { /* 单条失败忽略 */ }
      }
      items = out.length ? out : fallback
    } catch {
      items = fallback
    }
  }

  $effect(() => {
    const cur = items[idx % (items.length || 1)]
    if (!cur) return
    const speed = deleting ? 45 : 130
    const t = setTimeout(() => {
      if (!deleting) {
        char += 1
        typed = cur.text.slice(0, char)
        if (char >= cur.text.length) {
          deleting = true
          from = cur.from
        }
      } else {
        char -= 1
        typed = cur.text.slice(0, Math.max(0, char))
        if (char <= 0) {
          deleting = false
          idx += 1
          char = 0
          from = ''
        }
      }
    }, speed)
    return () => clearTimeout(t)
  })

  $effect(() => { loadQuotes() })

  const scrollDown = () => window.scrollTo({ top: window.innerHeight * 0.94, behavior: 'smooth' })
</script>

<header class="bf-banner bf-banner--full" style="background-image:url('{background}')">
  <div class="bf-banner__inner">
    <h1 class="bf-banner__title">{site.title}</h1>
    <div class="bf-banner__subtitle">
      {typed}<span class="bf-banner__cursor">&nbsp;</span>
    </div>
    {#if from}
      <div class="bf-banner__source">—— {from}</div>
    {/if}
  </div>

  <svg class="bf-banner__wave" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0,64 C240,110 480,20 720,48 C960,76 1200,28 1440,64 L1440,120 L0,120 Z"
          style="fill:var(--global-bg);opacity:.45" />
    <path d="M0,80 C260,40 520,100 780,76 C1040,52 1240,88 1440,72 L1440,120 L0,120 Z"
          style="fill:var(--global-bg)" />
  </svg>

  <button class="bf-banner__scroll" onclick={scrollDown} aria-label="向下滚动">▼</button>
</header>
