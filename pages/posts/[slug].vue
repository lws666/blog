<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSiteConfig } from 'valaxy'
import { useHead } from '@unhead/vue'
import type { MarkdownIt } from 'markdown-it'
import { useDynamicPost } from '../../composables/useDynamicPost'
import YunComment from 'valaxy-theme-yun/components/YunComment.vue'

const route = useRoute()
const siteConfig = useSiteConfig()
const { post, loading, error, refresh } = useDynamicPost()

// ── Dynamic SEO: OpenGraph + JSON-LD BlogPosting ──────────────
const siteUrl = computed(() => (siteConfig.value.url || '').replace(/\/+$/, ''))
useHead(() => {
  const p = post.value
  if (!p) return {}

  const postUrl = `${siteUrl.value}/posts/${p.slug}`
  const desc = p.excerpt || siteConfig.value.description || ''

  return {
    meta: [
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
          '@type': 'BlogPosting',
          headline: p.title,
          description: desc,
          image: p.cover || undefined,
          datePublished: p.date,
          dateModified: p.updated || p.date,
          author: {
            '@type': 'Person',
            name: siteConfig.value.author?.name || 'lws',
          },
          url: postUrl,
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

// Fetch post when slug changes (immediate triggers on mount)
watch(
  () => route.params.slug as string,
  (slug) => { refresh(slug) },
  { immediate: true },
)

// Dynamically import markdown-it on mount
onMounted(async () => {
  const markdownit = await import('markdown-it')
  md.value = markdownit.default({
    html: true,
    linkify: true,
    typographer: true,
  })
})

// Render markdown when both content and md instance are ready
watch(
  [() => post.value?.content, md],
  ([content, mdInstance]) => {
    if (content && mdInstance) {
      html.value = mdInstance.render(removeFrontmatter(content))
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
        <YunComment />
      </ClientOnly>
    </div>
  </article>
</template>
