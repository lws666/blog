<script lang="ts">
  /**
   * 目录（桌面端右栏卡片）。
   *
   * 核心动画：**左侧滑块跟随阅读位置**（对齐老版 .outline-marker）。
   * 老版实测规格：
   *   宽 4px、高 18px、left -2px、圆角 0 2px 2px 0、背景 var(--va-c-primary)
   *   transition: top .25s cubic-bezier(0,1,.5,1), background-color .4s, opacity .25s
   *   滚动时 top 在 33 / 89 / 229 / 285px 之间平滑移动
   */
  let { items }: { items: { id: string, text: string, level: number }[] } = $props()

  let activeId = $state('')
  let markerTop = $state(0)
  let markerVisible = $state(false)
  let listEl = $state<HTMLElement | null>(null)

  /** 计算当前 active 项相对列表的位置，驱动滑块 */
  function updateMarker() {
    if (!listEl || !activeId) return
    const el = listEl.querySelector<HTMLElement>(`a[href="#${CSS.escape(activeId)}"]`)
    if (!el) return
    markerTop = el.offsetTop + el.offsetHeight / 2 - 9 // 9 = 滑块半高
    markerVisible = true
  }

  // 用 IntersectionObserver 跟踪正文标题，确定当前阅读到哪一节
  $effect(() => {
    const headings = items
      .map(i => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el)
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]?.target.id) {
          activeId = visible[0].target.id
          updateMarker()
        }
      },
      { rootMargin: '-70px 0px -70% 0px', threshold: 0 },
    )

    headings.forEach(h => observer.observe(h))
    return () => observer.disconnect()
  })

  // activeId 变化或列表尺寸变化时重新定位滑块
  $effect(() => {
    // 依赖 activeId 与 items，变化即重算
    void activeId
    void items
    requestAnimationFrame(updateMarker)
  })

  // 窗口尺寸变化时重算
  $effect(() => {
    const onResize = () => updateMarker()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  })
</script>

<section class="bf-card bf-widget bf-toc-card">
  <h3 class="bf-widget__title">目录</h3>

  <div class="bf-toc-wrap" bind:this={listEl}>
    <!-- 跟随阅读位置的滑块 -->
    <div
      class="bf-toc-marker"
      class:bf-toc-marker--visible={markerVisible}
      style="top:{markerTop}px"
      aria-hidden="true"
    ></div>

    <ul class="bf-toc__list">
      {#each items as it (it.id)}
        <li>
          <a
            class="bf-toc__item"
            class:bf-toc__item--h3={it.level === 3}
            class:bf-toc__item--active={activeId === it.id}
            href={`#${it.id}`}
          >{it.text}</a>
        </li>
      {/each}
    </ul>
  </div>
</section>
