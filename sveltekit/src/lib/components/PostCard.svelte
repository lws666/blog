<script lang="ts">
  import type { PostListItem } from '#lib/api'

  let { post }: { post: PostListItem } = $props()

  const fmtDate = (d: string) => (d || '').slice(0, 10)
  const cleanTag = (t: unknown) => String(t).replace(/"/g, '')
</script>

<article class="bf-card bf-post-card" class:bf-post-card--cover={!!post.cover}>
  {#if post.cover}
    <a href={`/blog/${post.slug}/`} class="bf-post-card__cover" aria-label={post.title} tabindex="-1">
      <img src={post.cover} alt={post.title} loading="lazy" decoding="async" />
    </a>
  {/if}

  <div class="bf-post-card__body">
    <h2 class="bf-post-card__title">
      <a href={`/blog/${post.slug}/`}>{post.title}</a>
    </h2>

    {#if post.excerpt}
      <p class="bf-post-card__excerpt">{post.excerpt}</p>
    {/if}

    <div class="bf-post-card__meta">
      <span>📅 {fmtDate(post.date)}</span>
      {#if post.categories?.length}
        <span>📂 {post.categories.map(cleanTag).join(' / ')}</span>
      {/if}
      {#if post.tags?.length}
        <span class="bf-post-card__tags">
          {#each post.tags.slice(0, 3) as tag (String(tag))}
            <a class="bf-tag" href={`/tags/${encodeURIComponent(cleanTag(tag))}/`}>{cleanTag(tag)}</a>
          {/each}
        </span>
      {/if}
    </div>
  </div>
</article>
