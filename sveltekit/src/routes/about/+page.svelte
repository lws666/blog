<script lang="ts">
  import Seo from '#lib/components/Seo.svelte'
  import { site } from '#lib/site'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<Seo seo={data.seo} />

<div class="bf-layout" style="padding-top:calc(var(--nav-height) + 40px);display:block">
  <div class="bf-card bf-post" style="max-width:760px;margin:0 auto">
    <h1 class="bf-post__title">关于</h1>
    <div class="bf-content">
      <p>你好，我是 {site.author.name}，这里是 {site.name}。</p>
      <p>{site.description}</p>
      <h2>技术栈</h2>
      <ul>
        <li><strong>前端</strong>：SvelteKit（SSR，SEO 友好）</li>
        <li><strong>后端</strong>：Cloudflare Workers + D1</li>
        <li><strong>存储</strong>：Backblaze B2 + 图片 CDN</li>
      </ul>
      <h2>联系</h2>
      <ul>
        {#each site.author.sameAs as link (link)}
          <li><a href={link} rel="me noopener" target="_blank">{link}</a></li>
        {/each}
      </ul>
    </div>
  </div>
</div>
