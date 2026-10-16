<script lang="ts">
  import { site } from '#lib/site'
  const year = new Date().getFullYear()
</script>

<footer class="bf-footer">
  <div>
    © {year} <a href="/">{site.name}</a> · {site.tagline}
  </div>
  <div>
    Powered by <a href="https://kit.svelte.dev" rel="noopener">SvelteKit</a> ·
    <a href="/rss.xml">RSS</a> ·
    <a href="/sitemap.xml">Sitemap</a>
  </div>
</footer>
