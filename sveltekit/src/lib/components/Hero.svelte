<script lang="ts">
  import { site } from '#lib/site'

  /**
   * Hero —— 全屏背景图 + 站点大标题 + 每日一言打字机 + 双层波浪。
   *
   * 打字机实现要点（曾经的 bug）：
   * 早前用 $effect 驱动，effect 内既读又写 typed/char，Svelte 会在每次
   * 写入后重跑 effect 并清掉定时器 → 只显示第一个字就停。这里改为
   * 普通变量做游标 + 单个 setInterval 驱动，effect 只在挂载时启动一次。
   */
  let { background = site.banner }: { background?: string } = $props()

  interface Quote { text: string; from: string }

  let items = $state<Quote[]>([])
  let typed = $state('')
  let from = $state('')

  // 游标用普通变量：不是 $state，写入不会触发 effect 重跑
  let idx = 0
  let char = 0
  let deleting = false
  let hold = 0

  const TYPE_MS = 90      // 打字间隔
  const HOLD_TICKS = 22   // 打完停留（≈2s，按 TYPE_MS 计）

  /** 每日一言（Hitokoto）；失败时退回站点标语 */
  async function loadQuotes() {
    const fallback: Quote[] = site.taglines.map(x => ({ text: x, from: '' }))
    const out: Quote[] = []
    for (const c of ['d', 'i', 'k']) {
      try {
        const r = await fetch(`https://v1.hitokoto.cn/?encode=json&charset=utf-8&c=${c}`)
        const j = await r.json()
        if (j?.hitokoto) out.push({ text: j.hitokoto, from: j.from_who || j.from || '' })
      } catch { /* 单条失败忽略 */ }
    }
    items = out.length ? out : fallback
  }

  /** 启动打字机循环：打字 → 停留 → 逐字删除 → 下一句 */
  function startTyping(): () => void {
    const tick = setInterval(() => {
      if (!items.length) return
      const cur = items[idx % items.length]
      if (!cur) return

      if (!deleting) {
        char += 1
        typed = cur.text.slice(0, char)
        if (char >= cur.text.length) deleting = true
        return
      }

      // 删除前先停留
      if (char >= cur.text.length && hold < HOLD_TICKS) {
        hold += 1
        from = cur.from
        return
      }
      hold = 0

      char -= 1
      typed = cur.text.slice(0, Math.max(0, char))
      if (char <= 0) {
        deleting = false
        idx += 1
        char = 0
        from = ''
      }
    }, TYPE_MS)
    return () => clearInterval(tick)
  }

  // 挂载时加载一言并启动打字机（interval 只创建一次）
  $effect(() => {
    loadQuotes()
    return startTyping()
  })

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

  <!-- 波浪：每层宽 300%（3 个周期），左移 1/3 = 恰好一个周期，无缝循环 -->
  <svg class="bf-banner__wave bf-wave--back" viewBox="0 0 4320 120" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0,72 C240,32 480,32 720,72 C960,112 1200,112 1440,72
             C1680,32 1920,32 2160,72 C2400,112 2640,112 2880,72
             C3120,32 3360,32 3600,72 C3840,112 4080,112 4320,72
             L4320,120 L0,120 Z"
          style="fill:var(--global-bg);opacity:.45" />
  </svg>
  <svg class="bf-banner__wave bf-wave--front" viewBox="0 0 4320 120" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0,80 C240,116 480,116 720,80 C960,44 1200,44 1440,80
             C1680,116 1920,116 2160,80 C2400,44 2640,44 2880,80
             C3120,116 3360,116 3600,80 C3840,44 4080,44 4320,80
             L4320,120 L0,120 Z"
          style="fill:var(--global-bg)" />
  </svg>

  <button class="bf-banner__scroll" onclick={scrollDown} aria-label="向下滚动">▼</button>
</header>
