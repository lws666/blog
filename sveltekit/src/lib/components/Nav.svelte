<script lang="ts">
  import { site } from '#lib/site'
  import { page } from '$app/state'
  import Icon from './Icon.svelte'
  import type { IconName } from '#lib/icons'

  // 主题/语言/音乐按钮统一放在右下角悬浮按钮组（Actions.svelte）
  let { onToggleTheme, theme }: { onToggleTheme: () => void; theme: 'light' | 'dark' } = $props()

  let fixed = $state(false)
  let menuOpen = $state(false)

  $effect(() => {
    const onScroll = () => (fixed = window.scrollY > 56)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  })

  const isActive = (href: string) => {
    const p = page.url.pathname
    return href === '/' ? p === '/' : p.startsWith(href)
  }
</script>

<nav class="bf-nav" class:bf-nav--fixed={fixed}>
  <!-- 品牌：头像 + 站点完整标题（与线上一致） -->
  <a href="/" class="bf-nav__brand">
    <img src={site.author.avatar} alt="" width="32" height="32" class="bf-nav__avatar" />
    <span>{site.titleFull}</span>
  </a>

  <div class="bf-nav__links" class:bf-nav__links--open={menuOpen}>
    {#each site.nav as link (link.href)}
      <a
        href={link.href}
        class="bf-nav__link"
        class:bf-nav__link--active={isActive(link.href)}
        onclick={() => (menuOpen = false)}
      >
        <span class="bf-nav__icon" aria-hidden="true"><Icon name={link.icon as IconName} size={15} /></span>
        <span>{link.label}</span>
      </a>
    {/each}
  </div>

  <div class="bf-nav__actions">
    <button class="bf-nav__toggle" aria-label="菜单" onclick={() => (menuOpen = !menuOpen)}>
      {menuOpen ? '✕' : '☰'}
    </button>
  </div>
</nav>
