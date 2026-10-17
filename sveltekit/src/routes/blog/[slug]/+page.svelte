<script lang="ts">
  import Seo from '#lib/components/Seo.svelte'
  import Toc from '#lib/components/Toc.svelte'
  import AiSummary from '#lib/components/AiSummary.svelte'
  import TwikooComment from '#lib/components/TwikooComment.svelte'
  import Icon from '#lib/components/Icon.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const fmt = (d: string) => (d || '').slice(0, 10)
  const cleanTag = (t: unknown) => String(t).replace(/"/g, '')
  const hasBanner = $derived(!!data.post.cover)
</script>

<Seo seo={data.seo} />

<!-- 文章 banner：标题/日期/标签叠在图上（对齐老版 bf-post-banner） -->
{#if hasBanner}
  <header class="bf-post-banner" style="background-image:url('{data.post.cover}')">
    <div class="bf-post-banner__inner">
      <h1 class="bf-post-banner__title">{data.post.title}</h1>
      <div class="bf-post-banner__meta">
        <span><Icon name="archive" size={13} /> {fmt(data.post.date)}</span>
        {#if data.post.categories?.length}
          <span><Icon name="folder" size={13} /> {data.post.categories.map(cleanTag).join(' / ')}</span>
        {/if}
        {#each (data.post.tags ?? []).slice(0, 3) as tag (String(tag))}
          <span><Icon name="tag" size={13} /> {cleanTag(tag)}</span>
        {/each}
      </div>
    </div>
  </header>
{/if}

<!-- 内容卡 + 右栏；有 banner 时上移压住它（对齐老版 -mt-14） -->
<div class="bf-container" class:bf-container--overlap={hasBanner}>
  <main class="bf-post-main">
    <article class="bf-card bf-post">
      {#if !hasBanner}
        <h1 class="bf-post__title">{data.post.title}</h1>
        <div class="bf-post__meta">
          <span><Icon name="archive" size={13} /> {fmt(data.post.date)}</span>
          {#if data.post.categories?.length}
            <span><Icon name="folder" size={13} /> {data.post.categories.map(cleanTag).join(' / ')}</span>
          {/if}
        </div>
      {/if}

          <!-- AI 摘要（仿安知鱼 .post-ai-description） -->
      {#if data.post.summary}
        <AiSummary summary={data.post.summary} />
      {/if}

      <!-- 正文（SSR 直出，爬虫无需 JS） -->
      <div class="bf-content">{@html data.html}</div>

      {#if data.post.tags?.length}
        <div class="bf-post__tags">
          <span class="bf-post__tags-label">标签：</span>
          {#each data.post.tags as tag (String(tag))}
            <a class="bf-tag" href={`/tags/${encodeURIComponent(cleanTag(tag))}/`}>{cleanTag(tag)}</a>
          {/each}
        </div>
      {/if}
    </article>

    <!-- 评论（Twikoo） -->
    <TwikooComment path={data.post.slug} dark={false} />

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
  </main>

  <!-- 右栏：与首页一致的 300px 吸顶列（对齐老版 BfSidebar） -->
  <aside class="bf-aside">
    <div class="bf-aside__inner">
      <!-- 目录：使用 Toc 组件（含跟随阅读位置的滑块动画） -->
      {#if data.toc.length}
        <Toc items={data.toc} />
      {/if}

      <section class="bf-card bf-widget">
        <h3 class="bf-widget__title"><Icon name="file" size={15} /> 返回</h3>
        <a href="/blog/" class="bf-widget__back">← 全部文章</a>
      </section>
    </div>
  </aside>
</div>
