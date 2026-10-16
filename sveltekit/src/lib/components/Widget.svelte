<script lang="ts">
  let { title, children }: { title?: string; children?: import('svelte').Snippet } = $props()
</script>

<section class="bf-card bf-widget">
  {#if title}
    <h3 class="bf-widget__title">{title}</h3>
  {/if}
  {@render children?.()}
</section>
