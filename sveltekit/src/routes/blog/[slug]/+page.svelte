<script lang="ts">
  import Seo from '#lib/components/Seo.svelte'
  import Toc from '#lib/components/Toc.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const fmt = (d: string) => (d || '').slice(0, 10)
  const cleanTag = (t: unknown) => String(t).replace(/"/g, '')
</script>

<Seo seo={data.seo} />

<!-- 文章 banner：短 banner（主题为 400px） -->
{#if data.post.cover}
  <div class="bf-banner bf-banner--post" style="background-image:url('{data.post.cover}')">
    <div class="bf-banner__inner">
      <h1 class="bf-banner__title">{data.post.title}</h1>
    </div>
  </div>
{/if}

<div class="bf-layout" style="padding-top:{data.post.cover ? '40px' : 'calc(var(--nav-height) + 40px)'}">
  <div class="bf-main">
    <article class="bf-card bf-post">
      <!-- 有封面时标题在 banner 的 <h1> 里，这里不再重复 -->
      {#if !data.post.cover}
        <h1 class="bf-post__title">{data.post.title}</h1>
      {/if}

      <div class="bf-post__meta">
        <span>📅 {fmt(data.post.date)}</span>
        {#if data.post.categories?.length}
          <span>📂 {data.post.categories.map(cleanTag).join(' / ')}</span>
        {/if}
        <span>✍️ 约 {Math.max(1, Math.round((data.post.content?.length ?? 0) / 400))} 分钟阅读</span>
      </div>

      {#if data.post.summary}
        <blockquote style="margin:0 0 24px">{data.post.summary}</blockquote>
      {/if}

      <!-- 正文（SSR 直出，爬虫无需 JS） -->
      <div class="bf-content">{@html data.html}</div>

      {#if data.post.tags?.length}
        <div style="margin-top:26px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <span style="font-size:12px;color:var(--card-meta)">标签：</span>
          {#each data.post.tags as tag (String(tag))}
            <a class="bf-tag" href={`/tags/${encodeURIComponent(cleanTag(tag))}/`}>{cleanTag(tag)}</a>
          {/each}
        </div>
      {/if}
    </article>

    <!-- 上下篇 -->
    {#if data.prev || data.next}
      <nav class="bf-post-nav" aria-label="文章导航">
        {#if data.prev}
          <a class="bf-post-nav__item" href={`/blog/${data.prev.slug}/`} rel="prev">
            <span class="bf-post-nav__inner">
              <span class="bf-post-nav__label">← 上一篇</span>
              <strong>{data.prev.title}</strong>
            </span>
          </a>
        {/if}
        {#if data.next}
          <a class="bf-post-nav__item" href={`/blog/${data.next.slug}/`} rel="next">
            <span class="bf-post-nav__inner">
              <span class="bf-post-nav__label">下一篇 →</span>
              <strong>{data.next.title}</strong>
            </span>
          </a>
        {/if}
      </nav>
    {/if}
  </div>

  <!-- 侧栏：TOC 吸顶 -->
  <aside class="bf-sidebar">
    {#if data.toc.length}
      <Toc items={data.toc} />
    {/if}
    <div class="bf-card bf-widget">
      <h3 class="bf-widget__title">返回</h3>
      <a href="/blog/" style="color:var(--btn-bg);font-size:0.9rem">← 全部文章</a>
    </div>
  </aside>
</div>
