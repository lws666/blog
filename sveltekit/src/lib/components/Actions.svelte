<script lang="ts">
  let visible = $state(false)

  $effect(() => {
    const onScroll = () => (visible = window.scrollY > 300)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  })

  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
</script>

<div class="bf-actions">
  <button
    class="bf-action"
    class:bf-action--hidden={!visible}
    aria-label="回到顶部"
    title="回到顶部"
    onclick={toTop}>↑</button
  >
</div>
