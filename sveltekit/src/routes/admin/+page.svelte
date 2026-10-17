<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { adminAuth } from '#lib/admin/store.svelte'
  import { login, listPosts, deletePost, type AdminPost, type Pagination } from '#lib/admin/api'

  /* ── 登录 ── */
  let username = $state('admin')
  let password = $state('')
  let loggingIn = $state(false)
  let loginError = $state('')

  async function doLogin(e: SubmitEvent) {
    e.preventDefault()
    if (loggingIn) return
    loggingIn = true
    loginError = ''
    try {
      const r = await login(username.trim(), password)
      adminAuth.setUser(r.user.username, r.user.role)
      await loadPosts()
    } catch (err) {
      loginError = (err as Error).message
    } finally {
      loggingIn = false
    }
  }

  /* ── 文章列表 ── */
  let posts = $state<AdminPost[]>([])
  let pagination = $state<Pagination>({ page: 1, limit: 20, total: 0, total_pages: 1 })
  let loading = $state(false)
  let listError = $state('')
  let keyword = $state('')
  let deleting = $state('')

  async function loadPosts(page = 1) {
    loading = true
    listError = ''
    try {
      const r = await listPosts({ page, limit: 20 })
      posts = r.posts
      pagination = r.pagination
    } catch (e) {
      listError = (e as Error).message
    } finally {
      loading = false
    }
  }

  async function doDelete(slug: string, title: string) {
    if (!confirm(`确定删除《${title}》？\n\n会同时删除 B2 上的 markdown 文件，不可恢复。`)) return
    deleting = slug
    try {
      await deletePost(slug)
      await loadPosts(pagination.page)
    } catch (e) {
      listError = (e as Error).message
    } finally {
      deleting = ''
    }
  }

  const filtered = $derived(
    keyword.trim()
      ? posts.filter(p =>
          p.title.toLowerCase().includes(keyword.trim().toLowerCase())
          || p.slug.includes(keyword.trim()))
      : posts,
  )

  const fmt = (d: string) => (d || '').slice(0, 10)

  onMount(() => { if (adminAuth.ready) loadPosts() })
</script>

<svelte:head><title>文章 · 管理后台</title></svelte:head>

{#if !adminAuth.ready}
  <!-- ── 登录 ── -->
  <div class="adm-login">
    <form class="adm-login__card" onsubmit={doLogin}>
      <h1 class="adm-login__title">管理后台</h1>
      <p class="adm-login__sub">登录后可发布、编辑与删除文章</p>

      {#if loginError}
        <div class="adm-alert adm-alert--error">{loginError}</div>
      {/if}

      <div class="adm-field">
        <label class="adm-label" for="u">用户名</label>
        <input id="u" class="adm-input" bind:value={username} autocomplete="username" required />
      </div>

      <div class="adm-field">
        <label class="adm-label" for="p">密码</label>
        <input
          id="p" class="adm-input" type="password" bind:value={password}
          autocomplete="current-password" required
        />
      </div>

      <button class="adm-btn adm-btn--primary" style="width:100%" disabled={loggingIn} type="submit">
        {#if loggingIn}<span class="adm-spinner"></span>{/if}
        {loggingIn ? '登录中…' : '登录'}
      </button>
    </form>
  </div>
{:else}
  <!-- ── 文章列表 ── -->
  <header class="adm-head">
    <div>
      <h1 class="adm-title">文章</h1>
      <p class="adm-sub">共 {pagination.total} 篇 · 含草稿</p>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <input class="adm-input" style="width:180px" placeholder="搜索标题或 slug" bind:value={keyword} />
      <a class="adm-btn adm-btn--primary" href="/admin/new/">写文章</a>
    </div>
  </header>

  {#if listError}
    <div class="adm-alert adm-alert--error">{listError}</div>
  {/if}

  <div class="adm-card">
    {#if loading}
      <div class="adm-empty">加载中…</div>
    {:else if filtered.length === 0}
      <div class="adm-empty">
        {keyword ? '没有匹配的文章' : '还没有文章，点右上角「写文章」开始'}
      </div>
    {:else}
      <div class="adm-list">
        {#each filtered as p (p.slug)}
          <div class="adm-item">
            {#if p.cover}
              <img class="adm-item__thumb" src={p.cover} alt="" loading="lazy" />
            {:else}
              <div class="adm-item__thumb"></div>
            {/if}

            <div class="adm-item__main">
              <a class="adm-item__title" href={`/admin/edit/?slug=${encodeURIComponent(p.slug)}`}>
                {p.title}
              </a>
              <div class="adm-item__meta">
                <span>{fmt(p.date)}</span>
                <code style="font-size:0.74rem">{p.slug}</code>
                {#if p.draft}<span class="adm-badge adm-badge--draft">草稿</span>{/if}
                {#if p.categories?.length}
                  <span>{p.categories.join(' / ')}</span>
                {/if}
              </div>
            </div>

            <div class="adm-item__actions">
              <a class="adm-btn adm-btn--sm" href={`/blog/${p.slug}/`} target="_blank" rel="noopener">预览</a>
              <a class="adm-btn adm-btn--sm" href={`/admin/edit/?slug=${encodeURIComponent(p.slug)}`}>编辑</a>
              <button
                class="adm-btn adm-btn--sm adm-btn--danger"
                disabled={deleting === p.slug}
                onclick={() => doDelete(p.slug, p.title)}
              >{deleting === p.slug ? '删除中' : '删除'}</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if pagination.total_pages > 1}
    <div style="display:flex;gap:8px;justify-content:center;margin-top:18px">
      <button class="adm-btn adm-btn--sm" disabled={pagination.page <= 1}
        onclick={() => loadPosts(pagination.page - 1)}>上一页</button>
      <span style="align-self:center;font-size:0.82rem;color:var(--adm-muted)">
        {pagination.page} / {pagination.total_pages}
      </span>
      <button class="adm-btn adm-btn--sm" disabled={pagination.page >= pagination.total_pages}
        onclick={() => loadPosts(pagination.page + 1)}>下一页</button>
    </div>
  {/if}
{/if}
