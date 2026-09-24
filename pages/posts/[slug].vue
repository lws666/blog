<script setup lang="ts">
import { ref, watch, onMounted, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteConfig, runContentUpdated } from 'valaxy'
import { useHead } from '@unhead/vue'
import type { MarkdownIt } from 'markdown-it'
import { useDynamicPost } from '../../composables/useDynamicPost'
import GiscusComment from '../../components/GiscusComment.vue'

const route = useRoute()
const siteConfig = useSiteConfig()
const { post, loading, error, refresh } = useDynamicPost()

// ── Dynamic SEO: canonical, OG, JSON-LD ──────────────────────
const siteUrl = computed(() => (siteConfig.value.url || '').replace(/\/+$/, ''))
useHead(() => {
  const p = post.value
  if (!p) return {}

  const postUrl = `${siteUrl.value}/posts/${p.slug}`
  const siteTitle = siteConfig.value.title || '权益のblog'
  const desc = p.excerpt || siteConfig.value.description || ''
  const authorName = siteConfig.value.author?.name || '权益'
  const authorUrl = siteConfig.value.author?.avatar || undefined

  return {
    // Document title — composed by valaxy's global titleTemplate
    // ("{title} - {siteTitle}"). Previously only og:/twitter: were set,
    // so the tab title stayed the generic site title.
    title: p.title,
    // Canonical URL
    link: [
      { rel: 'canonical', href: postUrl },
    ],
    meta: [
      // Per-post description (global head only falls back to the site one)
      { name: 'description', content: desc },
      // Override og:type to 'article' for blog posts
      { property: 'og:type', content: 'article' },
      { property: 'og:url', content: postUrl },
      { property: 'article:published_time', content: p.date },
      ...(p.updated ? [{ property: 'article:modified_time', content: p.updated }] : []),
      ...(p.tags?.length ? p.tags.map(tag => ({ property: 'article:tag', content: tag })) : []),
      // Twitter card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: p.title },
      { name: 'twitter:description', content: desc },
      ...(p.cover ? [{ name: 'twitter:image', content: p.cover }] : []),
    ],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'BlogPosting',
              headline: p.title,
              description: desc,
              image: p.cover || undefined,
              datePublished: p.date,
              dateModified: p.updated || p.date,
              author: {
                '@type': 'Person',
                name: authorName,
                url: authorUrl,
              },
              url: postUrl,
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl.value },
                { '@type': 'ListItem', position: 2, name: siteTitle, item: `${siteUrl.value}/` },
                { '@type': 'ListItem', position: 3, name: p.title, item: postUrl },
              ],
            },
          ],
        }),
      },
    ],
  }
})

const html = ref('')
const md = ref<MarkdownIt | null>(null)

/** Strip YAML frontmatter (--- ... ---) from markdown content */
function removeFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\s*/, '')
}

/**
 * Heading -> anchor id.
 *
 * Copied from Valaxy's own slugify (packages/valaxy/src/slugify.ts) so that
 * anchors on dynamic posts are identical to the ones generated for static
 * posts at build time.
 */
const rControl = /[\u0000-\u001F]/g
// eslint-disable-next-line no-useless-escape
const rSpecial = /[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g
const rCombining = /[\u0300-\u036F]/g

function slugify(str: string): string {
  return str
    .normalize('NFKD')
    .replace(rCombining, '')
    .replace(rControl, '')
    .replace(rSpecial, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase()
}

// Fetch post when slug changes (immediate triggers on mount)
watch(
  () => route.params.slug as string,
  (slug) => { refresh(slug) },
  { immediate: true },
)

/**
 * Manual retry for the error state.
 * apiGet already retries transient failures; this covers the case where
 * every attempt failed (offline, edge hiccup) and the reader wants to try
 * again without a full page reload.
 */
function retry() {
  refresh(route.params.slug as string)
}

/**
 * Markdown renderer, requested as soon as this page's module is evaluated.
 * Starting the dynamic import at module scope rather than inside onMounted
 * lets the chunk download overlap the post request instead of queueing
 * behind it — the page cannot render until both are in hand.
 */
const markdownModules = Promise.all([
  import('markdown-it'),
  import('markdown-it-anchor'),
])

// Wire up the renderer once the chunk lands
onMounted(async () => {
  const [markdownit, anchor] = await markdownModules
  const mdInstance = markdownit.default({
    html: true,
    linkify: true,
    typographer: true,
  })

  // Headings need `id` attributes, otherwise the theme's TOC drops them:
  // useOutline() filters with `el => !!el.id`. Static posts get these from
  // Valaxy's build-time pipeline; dynamic (D1) posts are rendered here, so
  // the anchor plugin has to be applied explicitly.
  mdInstance.use(anchor.default, {
    // Same algorithm Valaxy uses at build time, so anchors/links match.
    slugify,
    level: [1, 2, 3, 4, 5, 6],
  })

  md.value = mdInstance
})

// Render markdown when both content and md instance are ready
watch(
  [() => post.value?.content, md],
  async ([content, mdInstance]) => {
    if (content && mdInstance) {
      html.value = mdInstance.render(removeFrontmatter(content))

      // The theme's TOC is built by useOutline(), which only recomputes on
      // Valaxy's `onContentUpdated` hook. That hook fires for build-time
      // content; our HTML lands asynchronously, so tell Valaxy to re-scan
      // the DOM once the new headings are actually painted.
      await nextTick()
      runContentUpdated()
    }
  },
  { immediate: true },
)

// Debug: log comment config
watch(
  [() => post.value?.comment, siteConfig],
  ([comment, config]) => {
    console.log('[slug] post.comment:', comment)
    console.log('[slug] siteConfig.comment:', config?.comment)
  },
  { immediate: true },
)

// Expose frontmatter to route meta for layout's useFrontmatter()
watch(
  post,
  (p) => {
    if (p) {
      route.meta.frontmatter = {
        title: p.title,
        date: p.date,
        updated: p.updated,
        tags: p.tags,
        categories: p.categories,
        cover: p.cover,
        type: p.type,
        hide: p.hide,
        // Let frontmatter handle empty strings gracefully
        excerpt: p.excerpt || undefined,
        description: p.excerpt || undefined,
        comment: p.comment,
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <!-- Loading state -->
  <div v-if="loading" class="flex justify-center py-12">
    <span class="opacity-50">加载中…</span>
  </div>

  <!-- Error state -->
  <div v-else-if="error" class="flex justify-center py-12">
    <div class="text-center">
      <p class="text-lg font-medium text-red-400">{{ error }}</p>
      <p class="mt-2 text-sm opacity-50">文章可能不存在或已被删除</p>
      <button
        class="mt-4 px-4 py-1.5 rounded text-sm bg-blue-600/30 hover:bg-blue-600 transition-all"
        @click="retry"
      >
        重新加载
      </button>
    </div>
  </div>

  <!-- Empty state (SSG build or not found) -->
  <div v-else-if="!post" class="flex justify-center py-12">
    <span class="opacity-50">文章未找到</span>
  </div>

  <!-- Post content -->
  <article v-else>
    <!-- Post title -->
    <div class="yun-post-title prose mx-auto">
      <h1 class="text-center">{{ post.title }}</h1>
    </div>

    <!-- Post meta -->
    <div class="flex justify-center gap-4 text-sm opacity-60 my-4 flex-wrap">
      <time :datetime="post.date">{{ post.date }}</time>
      <template v-if="post.tags?.length">
        <span v-for="tag in post.tags" :key="tag" class="yun-tag">
          #{{ tag }}
        </span>
      </template>
      <span v-if="post.updated && post.updated !== post.date">
        更新于 {{ post.updated }}
      </span>
    </div>

    <!-- AI summary card -->
    <aside v-if="post.summary" class="ai-summary">
      <div class="ai-summary-head">
        <span class="ai-summary-badge">✨ AI 摘要</span>
      </div>
      <p class="ai-summary-body">{{ post.summary }}</p>
    </aside>

    <!-- Rendered markdown content -->
    <div
      v-if="html"
      class="markdown-body"
      v-html="html"
    />

    <!-- Comment section -->
    <div
      v-if="html && siteConfig.comment?.enable && post?.comment !== false"
      class="mt-4"
    >
      <ClientOnly>
        <GiscusComment />
      </ClientOnly>
    </div>
  </article>
</template>

<style scoped lang="scss">
/**
 * AI summary card.
 * Uses Valaxy theme CSS variables so it follows light/dark mode.
 */
.ai-summary {
  max-width: 780px;
  margin: 1.5rem auto 2rem;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  border: 1px solid var(--va-c-divider, rgba(125, 125, 125, 0.2));
  border-left: 3px solid var(--va-c-primary, #0078e7);
  background: var(--va-c-bg-light, rgba(125, 125, 125, 0.06));
}

.ai-summary-head {
  margin-bottom: 0.5rem;
}

.ai-summary-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--va-c-primary, #0078e7);
}

.ai-summary-body {
  margin: 0;
  font-size: 0.925rem;
  line-height: 1.8;
  text-align: justify;
  opacity: 0.85;
}
</style>
