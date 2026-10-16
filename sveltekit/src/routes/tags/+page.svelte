<script lang="ts">
  import Seo from '#lib/components/Seo.svelte'
  import type { PageData } from './$types'
  let { data }: { data: PageData } = $props()
</script>

<Seo seo={data.seo} />
<div class="bf-layout" style="padding-top:calc(var(--nav-height) + 32px);display:block">
  <div class="bf-card" style="padding:30px 34px">
    <h1 style="font-size:1.6rem;margin:0 0 20px;color:var(--text-highlight-color)">标签</h1>
    <div class="bf-cloud">
      {#each data.tags as c (c.name)}
        <a class="bf-cloud__item" href={`/tags/${encodeURIComponent(c.name)}/`}>
          {c.name}<span class="bf-cloud__count">{c.count}</span>
        </a>
      {/each}
    </div>
  </div>
</div>
