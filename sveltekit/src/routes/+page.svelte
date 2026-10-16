<script lang="ts">
  import Hero from '#lib/components/Hero.svelte'
  import Seo from '#lib/components/Seo.svelte'
  import Sidebar from '#lib/components/Sidebar.svelte'
  import PostCard from '#lib/components/PostCard.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<Seo seo={data.seo} />
<Hero subtitles={['折腾代码，也记录生活', 'Cloudflare Workers · SvelteKit · 自托管']} />

<div class="bf-layout">
  <div class="bf-main">
    {#each data.recent as post (post.slug)}
      <PostCard {post} />
    {/each}

    {#if data.recent.length === 0}
      <div class="bf-card bf-empty">还没有文章</div>
    {/if}

    <div class="bf-card" style="padding:20px;text-align:center">
      <a href="/blog/" style="color:var(--btn-bg);font-weight:600">查看全部文章 →</a>
    </div>
  </div>

  <Sidebar recentPosts={data.recent} categories={data.categories} tags={data.tags} stats={data.stats} />
</div>
