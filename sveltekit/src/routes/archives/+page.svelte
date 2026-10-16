<script lang="ts">
  import Seo from '#lib/components/Seo.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
  const fmt = (d: string) => (d || '').slice(0, 10)
</script>

<Seo seo={data.seo} />

<div class="bf-layout" style="padding-top:calc(var(--nav-height) + 40px);display:block">
  <div class="bf-card" style="padding:30px 34px">
    <h1 style="font-size:1.6rem;margin:0 0 6px;color:var(--text-highlight-color)">归档</h1>
    <p style="color:var(--card-meta);font-size:0.9rem;margin:0 0 24px">共 {data.total} 篇文章</p>

    {#each data.groups as group (group.year)}
      <section style="margin-bottom:26px">
        <h2 style="font-size:1.2rem;color:var(--btn-bg);margin:0 0 10px">{group.year}</h2>
        <ul style="list-style:none;padding:0;margin:0">
          {#each group.posts as post (post.slug)}
            <li style="display:flex;gap:12px;padding:6px 8px;border-radius:var(--radius)">
              <time style="color:var(--card-meta);font-size:0.85rem;flex:0 0 90px">{fmt(post.date)}</time>
              <a href={`/blog/${post.slug}/`}>{post.title}</a>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
</div>
