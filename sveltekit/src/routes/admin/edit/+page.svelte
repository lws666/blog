<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { adminAuth } from '#lib/admin/store.svelte'
  import { getPost, type AdminPostDetail } from '#lib/admin/api'
  import Editor from '#lib/admin/components/Editor.svelte'

  // 用 ?slug= 而非动态路由：adapter-static 无法预渲染未知动态路径
  const slug = $derived(page.url.searchParams.get('slug') ?? '')

  let post = $state<AdminPostDetail | null>(null)
  let loading = $state(true)
  let err = $state('')

  async function load() {
    if (!slug) { loading = false; err = '缺少 slug 参数'; return }
    loading = true
    err = ''
    try {
      post = await getPost(slug)
    } catch (e) {
      err = (e as Error).message
    } finally {
      loading = false
    }
  }

  onMount(() => { if (adminAuth.ready) load() })
  $effect(() => { if (adminAuth.ready && slug && !post && !loading) load() })
</script>

<svelte:head><title>编辑 · 管理后台</title></svelte:head>

{#if !adminAuth.ready}
  <div class="adm-empty">请先登录</div>
{:else if loading}
  <div class="adm-empty">加载中…</div>
{:else if err}
  <div class="adm-alert adm-alert--error">{err}</div>
  <a class="adm-btn" href="/admin/">← 返回列表</a>
{:else if post}
  {#key post.slug}
    <Editor {post} />
  {/key}
{/if}
