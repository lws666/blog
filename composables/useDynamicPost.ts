/**
 * Composable: fetch a single post from Worker API.
 * Returns post metadata + Markdown content.
 *
 * Usage:
 *   const slug = computed(() => route.params.slug as string)
 *   const { post, content, loading, error } = useDynamicPost(slug)
 */

import { ref, computed, watch, type Ref } from 'vue'
import { apiGet } from './api'
import type { ApiPostDetail, PostDetail } from './types'

export function useDynamicPost(slug: Ref<string>) {
  const post = ref<PostDetail | null>(null) as Ref<PostDetail | null>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch(currentSlug: string): Promise<void> {
    if (!currentSlug) {
      error.value = 'slug is required'
      return
    }

    loading.value = true
    error.value = null

    try {
      const data = await apiGet<ApiPostDetail>(`/posts/${encodeURIComponent(currentSlug)}`)

      post.value = {
        path: `/posts/${data.slug}`,
        slug: data.slug,
        title: data.title,
        date: data.date,
        updated: data.updated || data.date,
        tags: data.tags || [],
        categories: data.categories || [],
        excerpt: data.excerpt || '',
        cover: data.cover || '',
        type: data.type || 'post',
        top: data.top || 0,
        hide: data.hide || '',
        draft: false,
        content: data.content || '',
      }
    } catch (e) {
      error.value = (e as Error).message
      post.value = null
    } finally {
      loading.value = false
    }
  }

  // Fetch whenever slug changes (immediate triggers on mount)
  watch(
    slug,
    (newSlug) => {
      fetch(newSlug)
    },
    { immediate: true },
  )

  return {
    post: computed(() => post.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    refresh: () => fetch(slug.value),
  }
}
