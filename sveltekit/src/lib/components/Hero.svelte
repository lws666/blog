<script lang="ts">
  import { site } from '#lib/site'

  /**
   * Banner —— 按 Butterfly 实测：
   * - 100vh 固定背景 + rgba(0,0,0,.3) 遮罩
   * - 只有 h1 站点标题 + 打字机副标题（头像不在这里）
   * - 底部滚动提示
   */
  let {
    background,
    title = site.name,
    subtitles = [site.tagline]
  }: { background?: string; title?: string; subtitles?: string[] } = $props()

  let text = $state('')
  let idx = $state(0)
  let char = $state(0)
  let deleting = $state(false)

  // Typed.js 风格：typeSpeed 150 / backSpeed 50 / loop
  $effect(() => {
    const current = subtitles[idx % subtitles.length] ?? ''
    const speed = deleting ? 50 : 150
    const t = setTimeout(() => {
      if (!deleting) {
        char += 1
        text = current.slice(0, char)
        if (char >= current.length) {
          deleting = true
          char = current.length
        }
      } else {
        char -= 1
        text = current.slice(0, Math.max(0, char))
        if (char <= 0) {
          deleting = false
          idx += 1
          char = 0
        }
      }
    }, speed)
    return () => clearTimeout(t)
  })

  const scrollDown = () =>
    window.scrollTo({ top: window.innerHeight * 0.92, behavior: 'smooth' })
</script>

<header class="bf-banner bf-banner--full" style={background ? `background-image:url('${background}')` : ''}>
  <div class="bf-banner__inner">
    <h1 class="bf-banner__title">{title}</h1>
    <div class="bf-banner__subtitle">
      {text}<span class="bf-banner__cursor">&nbsp;</span>
    </div>
  </div>
  <button class="bf-banner__scroll" onclick={scrollDown} aria-label="向下滚动">▼</button>
</header>
