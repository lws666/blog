<script lang="ts">
  import type { HeadMeta } from '#lib/seo'

  let { seo }: { seo: HeadMeta } = $props()

  /**
   * 推断 og:image 的类型与尺寸。
   *
   * 本站封面两种来源：
   *   - 站点默认 social-preview.jpg：1200×630（hero 大图裁切）
   *   - 文章封面：可能是 PNG（1200×630），也可能是自动生成的 SVG（矢量，无固定尺寸）
   * 对 SVG 输出 image/svg+xml 且不输出 width/height —— 硬编码 PNG/固定尺寸
   * 会让微信等平台读到错误信息而放弃缩略图。
   */
  const ogImageMeta = $derived.by(() => {
    const url = (seo.ogImage || '').toLowerCase()
    if (url.endsWith('.svg')) return { type: 'image/svg+xml', width: '', height: '' }
    if (url.endsWith('.webp')) return { type: 'image/webp', width: '1200', height: '630' }
    if (url.endsWith('.jpg') || url.endsWith('.jpeg')) {
      return { type: 'image/jpeg', width: '1200', height: '630' }
    }
    return { type: 'image/png', width: '1200', height: '630' }
  })
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
  <!-- 百度站点验证（验证通过后请勿删除，否则验证状态失效） -->
  <meta name="baidu-site-verification" content="codeva-mQlXESBIa4" />

  <!-- Open Graph -->
  <meta property="og:site_name" content={seo.ogSiteName} />
  <meta property="og:title" content={seo.ogTitle} />
  <meta property="og:description" content={seo.ogDescription} />
  <meta property="og:url" content={seo.ogUrl} />
  <meta property="og:type" content={seo.ogType} />
  <meta property="og:image" content={seo.ogImage} />
  <!-- 图片类型/尺寸：微信等平台靠这些值预判卡片布局。
       必须按实际图片推断——本站封面既有 PNG 也有 SVG，
       对 SVG 硬编码 image/png 或固定尺寸会是错误信息。 -->
  <meta property="og:image:type" content={ogImageMeta.type} />
  {#if ogImageMeta.width}
    <meta property="og:image:width" content={ogImageMeta.width} />
    <meta property="og:image:height" content={ogImageMeta.height} />
  {/if}
  <meta property="og:locale" content="zh_CN" />

  <!-- 微信兜底（Microdata 三件套）
       老版本微信/企业微信会优先读 itemprop="image"，og:image 读不到时
       才回退到这里。两套并存成本极低，是「有标题描述但没缩略图」的
       常见解法。同时是 Schema.org 标准字段，Google 也识别。 -->
  <meta itemprop="name" content={seo.ogTitle} />
  <meta itemprop="description" content={seo.ogDescription} />
  <meta itemprop="image" content={seo.ogImage} />

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
