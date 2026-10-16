<script lang="ts">
  /**
   * 真实错误页 —— acofork 全站 soft 404（未匹配路径返回 200 + 首页内容），
   * 这里给出正确的 404 状态码与独立页面。
   */
  import { page } from '$app/state'
</script>

<div class="bf-layout" style="padding-top:calc(var(--nav-height) + 60px);display:block;text-align:center">
  <h1 style="font-size:4rem;margin:0;color:var(--btn-bg)">{page.status}</h1>
  <p style="color:var(--font-color);font-size:1.1rem">
    {page.status === 404 ? '这个页面不存在或已被移除' : page.error?.message || '出错了'}
  </p>
  <div style="margin-top:24px;display:flex;gap:12px;justify-content:center">
    <a class="bf-pagination__btn" href="/">回首页</a>
    <a class="bf-pagination__btn" href="/blog/">看博客</a>
  </div>
</div>
