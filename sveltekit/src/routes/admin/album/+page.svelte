<script lang="ts">
  import { onMount } from 'svelte'
  import { adminAuth } from '#lib/admin/store.svelte'
  import { listAlbum, uploadAlbum, deleteAlbum, type AlbumImage } from '#lib/admin/api'

  let images = $state<AlbumImage[]>([])
  let loading = $state(false)
  let uploading = $state(false)
  let err = $state('')
  let msg = $state('')
  let fileInput = $state<HTMLInputElement | null>(null)

  async function load() {
    loading = true
    err = ''
    try {
      images = (await listAlbum()).images
    } catch (e) {
      err = (e as Error).message
    } finally {
      loading = false
    }
  }

  async function onPick(e: Event) {
    const files = (e.target as HTMLInputElement).files
    if (!files?.length) return
    uploading = true
    err = ''
    msg = ''
    let ok = 0
    try {
      for (const f of Array.from(files)) {
        await uploadAlbum(f)
        ok += 1
      }
      msg = `已上传 ${ok} 张`
      await load()
    } catch (e2) {
      err = (e2 as Error).message
    } finally {
      uploading = false
      if (fileInput) fileInput.value = ''
    }
  }

  async function del(img: AlbumImage) {
    if (!confirm(`删除图片 ${img.filename}？`)) return
    try {
      await deleteAlbum(img.id)
      images = images.filter(i => i.id !== img.id)
    } catch (e) {
      err = (e as Error).message
    }
  }

  function copy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      msg = '链接已复制'
      setTimeout(() => (msg = ''), 1500)
    })
  }

  onMount(() => { if (adminAuth.ready) load() })
</script>

<svelte:head><title>相册 · 管理后台</title></svelte:head>

<header class="adm-head">
  <div>
    <h1 class="adm-title">相册</h1>
    <p class="adm-sub">{images.length} 张图片</p>
  </div>
  <div>
    <input
      bind:this={fileInput}
      type="file" accept="image/*" multiple
      style="display:none" onchange={onPick}
    />
    <button class="adm-btn adm-btn--primary" disabled={uploading}
      onclick={() => fileInput?.click()}>
      {uploading ? '上传中…' : '上传图片'}
    </button>
  </div>
</header>

{#if err}<div class="adm-alert adm-alert--error">{err}</div>{/if}
{#if msg}<div class="adm-alert adm-alert--ok">{msg}</div>{/if}

<div class="adm-card">
  {#if loading}
    <div class="adm-empty">加载中…</div>
  {:else if images.length === 0}
    <div class="adm-empty">还没有图片</div>
  {:else}
    <div class="adm-grid">
      {#each images as img (img.id)}
        <div class="adm-tile">
          <img src={img.url} alt={img.filename} loading="lazy" />
          <button class="adm-tile__del" title="删除" onclick={() => del(img)}>×</button>
          <button
            class="adm-btn adm-btn--sm"
            style="position:absolute;bottom:6px;left:6px;right:6px;font-size:0.72rem;padding:3px"
            onclick={() => copy(img.url)}
          >复制链接</button>
        </div>
      {/each}
    </div>
  {/if}
</div>
