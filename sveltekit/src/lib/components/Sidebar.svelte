<script lang="ts">
  import type { PostListItem } from '#lib/api'
  import Widget from './Widget.svelte'

  let {
    recentPosts = [],
    categories = [],
    tags = [],
    stats = {}
  }: {
    recentPosts?: PostListItem[]
    categories?: { name: string; count: number }[]
    tags?: { name: string; count: number }[]
    stats?: Record<string, number>
  } = $props()
</script>

<aside class="bf-sidebar">
  {#if Object.keys(stats).length}
    <Widget title="站点信息">
      <div class="bf-webinfo">
        <div>
          <span class="bf-webinfo__num">{stats.post_count ?? 0}</span>
          <span class="bf-webinfo__label">文章</span>
        </div>
        <div>
          <span class="bf-webinfo__num">{stats.category_count ?? 0}</span>
          <span class="bf-webinfo__label">分类</span>
        </div>
        <div>
          <span class="bf-webinfo__num">{stats.tag_count ?? 0}</span>
          <span class="bf-webinfo__label">标签</span>
        </div>
      </div>
    </Widget>
  {/if}

  {#if recentPosts.length}
    <Widget title="最新文章">
      <ul class="bf-widget__list">
        {#each recentPosts.slice(0, 6) as post (post.slug)}
          <li class="bf-widget__item">
            {#if post.cover}
              <img class="bf-widget__thumb" src={post.cover} alt="" loading="lazy" />
            {/if}
            <a class="bf-widget__item-title" href={`/blog/${post.slug}/`}>{post.title}</a>
          </li>
        {/each}
      </ul>
    </Widget>
  {/if}

  {#if categories.length}
    <Widget title="分类">
      <div class="bf-cloud">
        {#each categories as cat (cat.name)}
          <a class="bf-cloud__item" href={`/categories/${encodeURIComponent(cat.name)}/`}>
            {cat.name}<span class="bf-cloud__count">{cat.count}</span>
          </a>
        {/each}
      </div>
    </Widget>
  {/if}

  {#if tags.length}
    <Widget title="标签">
      <div class="bf-cloud">
        {#each tags.slice(0, 30) as tag (tag.name)}
          <a class="bf-cloud__item" href={`/tags/${encodeURIComponent(tag.name)}/`}>
            {tag.name}<span class="bf-cloud__count">{tag.count}</span>
          </a>
        {/each}
      </div>
    </Widget>
  {/if}
</aside>
