<script lang="ts">
  import { adminAuth } from '#lib/admin/store.svelte'
  import Editor from '#lib/admin/components/Editor.svelte'
  import { goto } from '$app/navigation'

  function onSaved(slug: string) {
    goto(`/admin/edit/?slug=${encodeURIComponent(slug)}`)
  }
</script>

<svelte:head><title>写文章 · 管理后台</title></svelte:head>

{#if !adminAuth.ready}
  <div class="adm-empty">请先登录</div>
{:else}
  <Editor onSaved={onSaved} />
{/if}
