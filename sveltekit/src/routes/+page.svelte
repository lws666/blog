<script lang="ts">
  import Hero from '#lib/components/Hero.svelte'
  import Seo from '#lib/components/Seo.svelte'
  import Sidebar from '#lib/components/Sidebar.svelte'
  import PostCard from '#lib/components/PostCard.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<Seo seo={data.seo} />
<Hero />

<!-- 与线上一致：内容 74% + 侧栏 300px，同一 flex 行 -->
<div class="bf-layout">
  <main class="bf-main">
    {#each data.recent as post (post.slug)}
      <PostCard {post} />
    {/each}

    {#if data.recent.length === 0}
      <div class="bf-card bf-empty">还没有文章</div>
    {/if}

    <div class="bf-card" style="padding:18px;text-align:center">
      <a href="/blog/" style="color:var(--btn-bg);font-weight:600">查看全部文章 →</a>
    </div>
  </main>

  <Sidebar recentPosts={data.recent} categories={data.categories} tags={data.tags} stats={data.stats} />
</div>
