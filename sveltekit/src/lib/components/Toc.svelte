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
    /**
     * 滑块 top = 当前项中线 - 滑块半高（9px）。
     * 但对**最后一项**要用底边对齐：否则最后一项的行高（27px）比滑块
     * （18px）高，中线定位会让滑块底部比列表底部少 3~4px，
     * 滚到页面最底时视觉上「动画还没到底」。
     */
    const links = listEl.querySelectorAll<HTMLAnchorElement>('a.bf-toc__item')
    const isLast = links.length > 0 && links[links.length - 1] === el
    markerTop = isLast
      ? el.offsetTop + el.offsetHeight - 18   // 底边对齐，保证滚到底时滑块贴底
      : el.offsetTop + el.offsetHeight / 2 - 9
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
    void activeId
    void items
    requestAnimationFrame(updateMarker)
  })

  /**
   * 滚动时持续校正滑块。
   *
   * 根因：IntersectionObserver 只在标题进出观察区时触发回调。滚到文章末尾后，
   * 最后一个标题已经稳定在观察区里，activeId 不再变化 → 滑块停在旧位置，
   * 视觉上「滑到底了动画还没到底」。
   * 这里用 scroll 事件按 rAF 节流，按当前 active 项重新计算 top，
   * 保证滑块始终精确对齐。
   */
  $effect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0

        /**
         * 接近页面底部时强制把最后一项设为 active。
         *
         * 根因：IntersectionObserver 用 rootMargin '-70%' 判定当前小节，
         * 最后一个小节只有在滚到很靠下时才会命中。于是用户读到最后
         * 却看到滑块停在倒数第二项上（差 32px 没到底）。
         * 这里在距底 ≤ 40% 视口时直接激活最后一项。
         */
        const links = listEl?.querySelectorAll<HTMLAnchorElement>('a.bf-toc__item')
        const lastLink = links && links.length ? links[links.length - 1] : null
        const nearBottom =
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - window.innerHeight * 0.4
        if (nearBottom && lastLink) {
          const lastId = (lastLink.getAttribute('href') || '').replace(/^#/, '')
          if (lastId && activeId !== lastId) activeId = lastId
        }
        updateMarker()
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
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
