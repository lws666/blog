<script lang="ts">
  /**
   * 目录：Butterfly 的 #card-toc
   * - 吸顶（top:20px；导航固定后 70px）
   * - 当前小节高亮为强调青 #00c4b6
   */
  let { items }: { items: { id: string, text: string, level: number }[] } = $props()

  let activeId = $state('')

  $effect(() => {
    const headings = items
      .map(i => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el)

    if (!headings.length) return

    const observer = new IntersectionObserver(
      entries => {
        // 取当前可见的最靠上的标题
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]?.target.id) activeId = visible[0].target.id
      },
      { rootMargin: '-70px 0px -70% 0px', threshold: 0 }
    )

    headings.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  })
</script>

<nav class="bf-card bf-toc" aria-label="目录">
  <h3 class="bf-widget__title">目录</h3>
  <ul class="bf-toc__list">
    {#each items as item (item.id)}
      <li>
        <a
          class="bf-toc__item"
          class:bf-toc__item--h3={item.level === 3}
          class:bf-toc__item--active={activeId === item.id}
          href={`#${item.id}`}
        >{item.text}</a>
      </li>
    {/each}
  </ul>
</nav>
