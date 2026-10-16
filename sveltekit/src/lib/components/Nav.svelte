<script lang="ts">
  import { site } from '#lib/site'
  import { page } from '$app/state'

  let { onToggleTheme, theme }: { onToggleTheme: () => void; theme: 'light' | 'dark' } = $props()

  // 主题行为：scrollY > 56 加 .nav-fixed
  let fixed = $state(false)
  let menuOpen = $state(false)

  $effect(() => {
    const onScroll = () => (fixed = window.scrollY > 56)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  })

  const links = [
    { href: '/', label: '首页' },
    { href: '/blog/', label: '博客' },
    { href: '/archives/', label: '归档' },
    { href: '/about/', label: '关于' }
  ]

  const isActive = (href: string) => {
    const p = page.url.pathname
    return href === '/' ? p === '/' : p.startsWith(href)
  }
</script>

<nav class="bf-nav" class:bf-nav--fixed={fixed}>
  <a href="/" class="bf-nav__brand">{site.name}</a>

  <div class="bf-nav__links" class:bf-nav__links--open={menuOpen}>
    {#each links as link (link.href)}
      <a
        href={link.href}
        class="bf-nav__link"
        class:bf-nav__link--active={isActive(link.href)}
        onclick={() => (menuOpen = false)}
      >{link.label}</a>
    {/each}
  </div>

  <div style="display:flex;align-items:center;gap:2px">
    <button
      class="bf-nav__toggle"
      style="display:block"
      aria-label="切换主题"
      title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
      onclick={onToggleTheme}
    >{theme === 'dark' ? '☀' : '☾'}</button>

    <button class="bf-nav__toggle" aria-label="菜单" onclick={() => (menuOpen = !menuOpen)}>
      {menuOpen ? '✕' : '☰'}
    </button>
  </div>
</nav>
