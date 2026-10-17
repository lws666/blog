<script lang="ts">
  /**
   * AI 摘要卡片 —— 仿安知鱼主题的 .post-ai-description。
   *
   * 规格来自 hexo.anheyu.com 实测（getComputedStyle）：
   *   外层：背景 #f7f7f9、圆角 12px、边框 1px solid #e3e8f7、
   *         padding 12px 16px、margin-bottom 10px
   *   标题行：flex，图标 + "AI-摘要"（16px/700）+ 切换 + 刷新 + 朗读 + 标签
   *   正文：白底、圆角 8px、padding 8px 12px、15px/1.4
   *   按钮：背景 #235eb3、白字、圆角 6px、padding 5px 10px
   *   标签：背景 #235eb3、圆角 4px、12px、白字 90%
   *
   * 交互：折叠/展开、打字机式逐字显示、朗读（Web Speech API）。
   */
  let { summary }: { summary: string } = $props()

  let expanded = $state(true)
  let typed = $state('')
  let typing = $state(false)
  let speaking = $state(false)
  let timer: ReturnType<typeof setInterval> | undefined

  /** 打字机：逐字显示摘要（仿安知鱼的加载观感） */
  function typeOut() {
    if (timer) clearInterval(timer)
    if (!expanded) { typed = summary; return }
    typed = ''
    typing = true
    let i = 0
    const step = Math.max(18, Math.min(45, 1200 / Math.max(summary.length, 1)))
    timer = setInterval(() => {
      i += 2
      typed = summary.slice(0, i)
      if (i >= summary.length) {
        if (timer) clearInterval(timer)
        typed = summary
        typing = false
      }
    }, step)
  }

  function toggle() {
    expanded = !expanded
    if (expanded) typeOut()
    else { typed = summary; typing = false; if (timer) clearInterval(timer) }
  }

  /** 朗读（Web Speech API，不支持则忽略） */
  function speak() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    if (speaking) {
      window.speechSynthesis.cancel()
      speaking = false
      return
    }
    const u = new SpeechSynthesisUtterance(summary)
    u.lang = 'zh-CN'
    u.rate = 1
    u.onend = () => (speaking = false)
    u.onerror = () => (speaking = false)
    speaking = true
    window.speechSynthesis.speak(u)
  }

  $effect(() => {
    typeOut()
    return () => {
      if (timer) clearInterval(timer)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  })
</script>

<div class="post-ai-description">
  <div class="ai-title">
    <span class="ai-title__icon" aria-hidden="true">✦</span>
    <span class="ai-title-text">AI-摘要</span>

    <button class="ai-pill" title="展开/收起" onclick={toggle}>
      {expanded ? '收起' : '切换'}
    </button>

    <button class="ai-icon" title="重新生成" onclick={typeOut} aria-label="重新显示">
      ↻
    </button>

    <button
      class="ai-icon"
      class:ai-icon--active={speaking}
      title={speaking ? '停止朗读' : '朗读摘要'}
      onclick={speak}
      aria-label="朗读摘要"
    >◉</button>

    <span class="ai-tag">Lwsnb GPT</span>
  </div>

  {#if expanded}
    <div class="ai-explanation">
      {typed}{#if typing}<span class="ai-caret">▍</span>{/if}
    </div>
  {/if}
</div>
