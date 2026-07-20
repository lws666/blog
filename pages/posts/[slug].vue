<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { MarkdownIt } from 'markdown-it'
import { useDynamicPost } from '../../composables/useDynamicPost'

const route = useRoute()
const { post, loading, error, refresh } = useDynamicPost()

const html = ref('')
const md = ref<MarkdownIt | null>(null)

// Fetch post when slug changes (immediate triggers on mount)
watch(
  () => route.params.slug as string,
  (slug) => {
    refresh(slug)
  },
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
      html.value = mdInstance.render(content)
    }
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
  </article>
</template>
