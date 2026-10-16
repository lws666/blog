<script lang="ts">
  import Seo from '#lib/components/Seo.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()
</script>

<Seo seo={data.seo} />

<div class="bf-layout" style="padding-top:calc(var(--nav-height) + 60px);display:block;text-align:center">
  <h1 style="font-size:4rem;margin:0;color:var(--btn-bg)">404</h1>
  <p style="color:var(--font-color);font-size:1.1rem">这个页面不存在或已被移除</p>
  <div style="margin-top:24px;display:flex;gap:12px;justify-content:center">
    <a class="bf-pagination__btn" href="/">回首页</a>
    <a class="bf-pagination__btn" href="/blog/">看博客</a>
  </div>
</div>
