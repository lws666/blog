<script lang="ts">
  let { page, totalPages, basePath = '/blog' }: { page: number; totalPages: number; basePath?: string } =
    $props()

  const href = (p: number) => (p <= 1 ? `${basePath}/` : `${basePath}/page/${p}/`)

  // 页码窗口：当前页前后各 2 页
  const windowPages = $derived(() => {
    const out: number[] = []
    const start = Math.max(1, page - 2)
    const end = Math.min(totalPages, start + 4)
    for (let i = start; i <= end; i++) out.push(i)
    return out
  })
</script>

{#if totalPages > 1}
  <nav class="bf-card bf-pagination" aria-label="分页导航">
    <a
      class="bf-pagination__btn"
      class:bf-pagination__btn--disabled={page <= 1}
      href={href(Math.max(1, page - 1))}
      rel="prev"
      aria-label="上一页">‹</a
    >

    {#if windowPages()[0] > 1}
      <a class="bf-pagination__btn" href={href(1)}>1</a>
      {#if windowPages()[0] > 2}<span>…</span>{/if}
    {/if}

    {#each windowPages() as p (p)}
      <a
        class="bf-pagination__btn"
        class:bf-pagination__btn--active={p === page}
        href={href(p)}
        aria-current={p === page ? 'page' : undefined}>{p}</a
      >
    {/each}

    {#if windowPages()[windowPages().length - 1] < totalPages}
      {#if windowPages()[windowPages().length - 1] < totalPages - 1}<span>…</span>{/if}
      <a class="bf-pagination__btn" href={href(totalPages)}>{totalPages}</a>
    {/if}

    <a
      class="bf-pagination__btn"
      class:bf-pagination__btn--disabled={page >= totalPages}
      href={href(Math.min(totalPages, page + 1))}
      rel="next"
      aria-label="下一页">›</a
    >
  </nav>
{/if}
