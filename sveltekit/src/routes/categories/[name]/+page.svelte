<script lang="ts">
  import Seo from '#lib/components/Seo.svelte'
  import PostCard from '#lib/components/PostCard.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<Seo seo={data.seo} />

<div class="bf-layout" style="padding-top:calc(var(--nav-height) + 40px);display:block">
  <h1 style="font-size:1.6rem;margin:0 0 20px;color:var(--text-highlight-color)">
    分类：{data.name}
  </h1>
  {#each data.posts as post (post.slug)}
    <PostCard {post} />
  {/each}
  {#if data.posts.length === 0}
    <div class="bf-card bf-empty">该分类暂无文章</div>
  {/if}
  <div style="text-align:center;margin-top:20px">
    <a href="/blog/" style="color:var(--btn-bg)">← 返回博客</a>
  </div>
</div>
