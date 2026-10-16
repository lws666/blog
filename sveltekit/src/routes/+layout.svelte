<script lang="ts">
  import '../lib/theme.css'
  import Nav from '#lib/components/Nav.svelte'
  import Footer from '#lib/components/Footer.svelte'
  import Actions from '#lib/components/Actions.svelte'
  import { page } from '$app/state'

  let { children } = $props()

  // 主题状态：读 app.html 已写入的 data-theme，避免闪烁
  let theme = $state<'light' | 'dark'>('light')

  $effect(() => {
    const cur = document.documentElement.getAttribute('data-theme')
    theme = cur === 'dark' ? 'dark' : 'light'
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

  // 是否首页（首页用全屏 banner，隐藏常规导航的文字配色差异）
  const isHome = $derived(page.url.pathname === '/')
</script>

<Nav onToggleTheme={toggleTheme} theme={theme} />
<main>
  {@render children?.()}
</main>
<div style="max-width:var(--content-width);margin:0 auto">
  <Footer />
</div>
<Actions />
