<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteConfig, runContentUpdated } from 'valaxy'
import { useHead } from '@unhead/vue'
import type { MarkdownIt } from 'markdown-it'
import { useDynamicPost } from '../../composables/useDynamicPost'
import { currentPost } from '../../composables/useCurrentPost'
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
  const siteTitle = siteConfig.value.title || '谢谢の博客'
  // Fall back to the post title, then the site description — the same order
  // the Worker uses when it pre-renders the head, so both agree for posts
  // published without a description.
  const desc = p.excerpt || p.title || siteConfig.value.description || ''
  // article:author wants a profile URL. This used to be the avatar image URL,
  // which is not what the property means; site.config.ts author.link is the
  // same value the theme feeds into the schema Person node.
  const authorUrl = siteConfig.value.author?.link || siteUrl.value

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
      // og:title / og:image / og:description were never set here, so the
      // theme fell back to the site title and the favicon: sharing a post
      // produced a card with the site name and no cover. The crawler
      // pre-render hid it, because unfurl bots read that page's tags instead.
      { property: 'og:title', content: p.title },
      { property: 'og:description', content: desc },
      { property: 'og:site_name', content: siteTitle },
      ...(p.cover ? [{ property: 'og:image', content: p.cover }] : []),
      ...(p.cover ? [{ property: 'og:image:alt', content: p.title }] : []),
      { property: 'article:published_time', content: p.date },
      ...(p.updated ? [{ property: 'article:modified_time', content: p.updated }] : []),
      ...(authorUrl ? [{ property: 'article:author', content: authorUrl }] : []),
      ...(p.tags?.length ? p.tags.map(tag => ({ property: 'article:tag', content: tag })) : []),
      // Twitter card
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: p.title },
      { name: 'twitter:description', content: desc },
      ...(p.cover ? [{ name: 'twitter:image', content: p.cover }] : []),
      ...(p.cover ? [{ name: 'twitter:image:alt', content: p.title }] : []),
    ],
    script: [
      {
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'BlogPosting',
              // Entity identity. The Worker's crawler head emits the same @id,
              // so the raw-HTML copy and this one merge into a single article
              // instead of competing (two BlogPostings on one page is what
              // makes a rich result get dropped).
              '@id': `${postUrl}#article`,
              url: postUrl,
              headline: p.title,
              description: desc,
              ...(p.cover ? { image: p.cover } : {}),
              datePublished: p.date,
              ...(p.updated ? { dateModified: p.updated } : {}),
              inLanguage: 'zh-CN',
              ...(p.tags?.length ? { keywords: p.tags.join(', '), articleSection: p.tags } : {}),
              // Reference the Person / WebSite nodes Valaxy already emits
              // app-wide rather than redefining them: this page used to ship a
              // second Person and a second BlogPosting (3 Person nodes total).
              author: { '@id': `${siteUrl.value}/#identity` },
              publisher: { '@id': `${siteUrl.value}/#website` },
              isPartOf: { '@id': `${siteUrl.value}/#website` },
              mainEntityOfPage: { '@id': postUrl },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl.value}/` },
                { '@type': 'ListItem', position: 2, name: p.title, item: postUrl },
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

  // ── Heading levels ────────────────────────────────────────────
  // The post title rendered above the article is the page's one and only <h1>.
  // Articles here write their sections with `#`, so without this the page ended
  // up with 14 h1s (12 of them from the body) and search engines had no clear
  // topic to latch onto. Demote every body heading one level, h1→h2 … h5→h6,
  // which also matches themeConfig.outline in valaxy.config.ts ([2, 4]).
  mdInstance.core.ruler.push('demote-article-headings', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'heading_open' && token.type !== 'heading_close')
        continue
      const level = Number(token.tag.slice(1))
      if (level >= 1 && level <= 5)
        token.tag = `h${level + 1}`
    }
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
      // route.meta 突变不具响应性，banner 用这个单例读取（见 useCurrentPost.ts）
      currentPost.value = p
    }
    else {
      currentPost.value = null
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  currentPost.value = null
})
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
  <!-- 标题与元信息（日期/标签）由 layouts/post.vue 的 Butterfly banner 呈现，
       这里不再重复渲染，保证每页只有一个 h1。 -->
  <article v-else>
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

