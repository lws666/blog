<script setup lang="ts">
/**
 * GiscusComment — GitHub Discussions powered comments.
 *
 * Why a custom component: valaxy-theme-yun's YunComment only knows
 * waline / twikoo / artalk, so giscus needs its own mount.
 *
 * SPA notes:
 *  - The giscus <script> only reads its data-* attributes once, on first
 *    load. On client-side route changes we therefore re-create it, keyed
 *    by the current path, instead of relying on the initial injection.
 *  - Theme is synced to Valaxy's dark mode (which toggles `html.dark`)
 *    via postMessage, so switching the site theme restyles the iframe
 *    without a reload.
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

const props = withDefaults(defineProps<{
  repo?: string
  repoId?: string
  category?: string
  categoryId?: string
  mapping?: string
  inputPosition?: 'top' | 'bottom'
  lang?: string
}>(), {
  repo: 'lws666/blog',
  repoId: 'R_kgDOSdNCkw',
  category: 'Announcements',
  categoryId: 'DIC_kwDOSdNCk84DEFt2',
  mapping: 'pathname',
  inputPosition: 'top',
  lang: 'zh-CN',
})

const route = useRoute()
const container = ref<HTMLElement | null>(null)
let observer: MutationObserver | null = null

/** Map the site's dark state to a giscus theme name */
function currentTheme(): string {
  const isDark = document.documentElement.classList.contains('dark')
  return isDark ? 'dark' : 'light'
}

/** Tell an already-loaded giscus iframe to change theme */
function applyTheme(theme: string) {
  const iframe = container.value?.querySelector<HTMLIFrameElement>('iframe.giscus-frame')
  iframe?.contentWindow?.postMessage(
    { giscus: { setConfig: { theme } } },
    'https://giscus.app',
  )
}

/** (Re)create the giscus script inside our container */
function mountGiscus() {
  const el = container.value
  if (!el) return

  // Clear any previous instance (route change / re-mount)
  el.innerHTML = ''

  const script = document.createElement('script')
  script.src = 'https://giscus.app/client.js'
  script.async = true
  script.crossOrigin = 'anonymous'

  script.setAttribute('data-repo', props.repo)
  script.setAttribute('data-repo-id', props.repoId)
  script.setAttribute('data-category', props.category)
  script.setAttribute('data-category-id', props.categoryId)
  script.setAttribute('data-mapping', props.mapping)
  script.setAttribute('data-strict', '0')
  script.setAttribute('data-reactions-enabled', '1')
  script.setAttribute('data-emit-metadata', '0')
  script.setAttribute('data-input-position', props.inputPosition)
  script.setAttribute('data-theme', currentTheme())
  script.setAttribute('data-lang', props.lang)
  script.setAttribute('data-loading', 'lazy')

  el.appendChild(script)
}

onMounted(() => {
  mountGiscus()

  // Follow the site's dark-mode toggle (html.dark)
  observer = new MutationObserver(() => applyTheme(currentTheme()))
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

// Re-mount when navigating between posts (giscus won't re-read attrs itself)
watch(() => route.path, () => mountGiscus())
</script>

<template>
  <div class="giscus-wrapper">
    <div ref="container" class="giscus" />
  </div>
</template>

<style scoped>
.giscus-wrapper {
  max-width: 780px;
  margin: 2rem auto 0;
}
</style>
