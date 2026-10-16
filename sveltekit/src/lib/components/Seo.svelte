<script lang="ts">
  import type { HeadMeta } from '#lib/seo'

  let { seo }: { seo: HeadMeta } = $props()
</script>

<!--
  所有 SEO 标签必须包在 <svelte:head> 内，SvelteKit 才会把它们渲染进
  文档 <head>；否则会落在 <body> 里，爬虫读不到（会丢掉 title/canonical/JSON-LD）。
-->
<svelte:head>
  <!-- 基础 -->
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <meta name="robots" content={seo.robots} />
  <link rel="canonical" href={seo.canonical} />

  <!-- Open Graph -->
  <meta property="og:site_name" content={seo.ogSiteName} />
  <meta property="og:title" content={seo.ogTitle} />
  <meta property="og:description" content={seo.ogDescription} />
  <meta property="og:url" content={seo.ogUrl} />
  <meta property="og:type" content={seo.ogType} />
  <meta property="og:image" content={seo.ogImage} />
  <meta property="og:locale" content="zh_CN" />

  {#if seo.publishedTime}
    <meta property="article:published_time" content={seo.publishedTime} />
  {/if}
  {#if seo.modifiedTime}
    <meta property="article:modified_time" content={seo.modifiedTime} />
  {/if}
  {#each seo.tags as tag (tag)}
    <meta property="article:tag" content={tag} />
  {/each}

  <!-- Twitter -->
  <meta name="twitter:card" content={seo.twitterCard} />
  <meta name="twitter:title" content={seo.twitterTitle} />
  <meta name="twitter:description" content={seo.twitterDescription} />
  <meta name="twitter:image" content={seo.twitterImage} />

  <!-- 结构化数据：经 {@html} 注入，避免 Svelte 把 <script> 当作组件脚本解析 -->
  {@html `<script type="application/ld+json">${JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c')}</script>`}
</svelte:head>
