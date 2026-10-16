<script lang="ts">
  import '../lib/theme.css'
  import Nav from '#lib/components/Nav.svelte'
  import Footer from '#lib/components/Footer.svelte'
  import Actions from '#lib/components/Actions.svelte'
  import { page } from '$app/state'
  import { initLang, i18n, t } from '#lib/i18n.svelte'

  let { children } = $props()

  // 主题状态：读 app.html 已写入的 data-theme，避免闪烁
  let theme = $state<'light' | 'dark'>('light')

  $effect(() => {
    const cur = document.documentElement.getAttribute('data-theme')
    theme = cur === 'dark' ? 'dark' : 'light'
    initLang()
  })

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* 隐私模式下忽略 */
    }
  }

  // 只有首页有全屏 banner；其余页面导航必须实底，否则白字压白底看不见
  const hasBanner = $derived(page.url.pathname === '/')

  // 文章页会把 toc 放进 page.data；有目录时显示悬浮目录按钮
  const tocItems = $derived(
    (page.data as { toc?: { id: string, text: string, level: number }[] })?.toc ?? []
  )
</script>

<Nav onToggleTheme={toggleTheme} theme={theme} {hasBanner} />
<main>
  {@render children?.()}
</main>
<div style="max-width:var(--content-width);margin:0 auto">
  <Footer />
</div>
<Actions {theme} onToggleTheme={toggleTheme} hasToc={tocItems.length > 0} {tocItems} />
