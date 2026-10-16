<script lang="ts">
  import Seo from '#lib/components/Seo.svelte'
  import { site } from '#lib/site'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  const friends = [
    { name: '本站 GitHub', url: 'https://github.com/lws666', desc: '源码与提交记录' }
  ]
</script>

<Seo seo={data.seo} />

<div class="bf-layout" style="padding-top:calc(var(--nav-height) + 32px);display:block">
  <div class="bf-card bf-post" style="max-width:820px;margin:0 auto">
    <h1 class="bf-post__title">友链</h1>
    <div class="bf-content">
      <p>欢迎交换友链，可通过下方任一方式联系我。</p>
      <ul>
        {#each friends as f (f.url)}
          <li><a href={f.url} rel="noopener" target="_blank">{f.name}</a> —— {f.desc}</li>
        {/each}
      </ul>
      <h2>联系方式</h2>
      <ul>
        {#each site.social.filter(s => s.href.startsWith('http')) as s (s.href)}
          <li><a href={s.href} rel="me noopener" target="_blank">{s.name}</a></li>
        {/each}
      </ul>
    </div>
  </div>
</div>
