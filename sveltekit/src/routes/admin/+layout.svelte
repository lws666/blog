<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { adminAuth } from '#lib/admin/store.svelte'
  import { logout } from '#lib/admin/api'
  import { goto } from '$app/navigation'
  import '../../lib/theme.css'
  import '#lib/admin/admin.css'

  let { children } = $props()

  onMount(() => { adminAuth.init() })

  const nav = [
    { href: '/admin/', label: '文章', icon: '📄' },
    { href: '/admin/new/', label: '写文章', icon: '✏️' },
    { href: '/admin/album/', label: '相册', icon: '🖼' },
  ]

  async function doLogout() {
    await logout()
    adminAuth.reset()
    goto('/admin/')
  }
</script>

<svelte:head>
  <title>管理后台</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

{#if adminAuth.checking}
  <div class="adm-splash">正在验证登录状态…</div>
{:else if !adminAuth.ready}
  <!-- 登录界面由 +page.svelte 渲染 -->
  {@render children?.()}
{:else}
  <div class="adm-shell">
    <aside class="adm-side">
      <div class="adm-brand">
        <span class="adm-brand__dot"></span>
        <span>管理后台</span>
      </div>

      <nav class="adm-nav">
        {#each nav as n (n.href)}
          <a
            href={n.href}
            class="adm-nav__item"
            class:adm-nav__item--active={n.href === '/admin/'
              ? page.url.pathname === '/admin/'
              : page.url.pathname.startsWith(n.href)}
          >
            <span aria-hidden="true">{n.icon}</span>{n.label}
          </a>
        {/each}
      </nav>

      <div class="adm-side__foot">
        <div class="adm-user">
          <span class="adm-user__avatar">{adminAuth.username.slice(0, 1).toUpperCase()}</span>
          <span class="adm-user__name">{adminAuth.username}</span>
        </div>
        <div class="adm-side__links">
          <a href="/" target="_blank" rel="noopener">查看站点 ↗</a>
          <button onclick={doLogout}>退出</button>
        </div>
      </div>
    </aside>

    <main class="adm-main">
      {@render children?.()}
    </main>
  </div>
{/if}
