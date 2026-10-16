<script lang="ts">
  import Seo from '#lib/components/Seo.svelte'
  import Sidebar from '#lib/components/Sidebar.svelte'
  import PostCard from '#lib/components/PostCard.svelte'
  import Pagination from '#lib/components/Pagination.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<Seo seo={data.seo} />

<div class="bf-layout" style="padding-top:calc(var(--nav-height) + 32px)">
  <main class="bf-main">
    <h1 style="font-size:1.6rem;margin:0 0 20px;color:var(--text-highlight-color)">
      博客 · 第 {data.currentPage} 页
    </h1>

    {#each data.posts as post (post.slug)}
      <PostCard {post} />
    {/each}

    <Pagination page={data.currentPage} totalPages={data.pagination.total_pages} />
  </main>

  <Sidebar recentPosts={data.posts} categories={data.categories} tags={data.tags} />
</div>
