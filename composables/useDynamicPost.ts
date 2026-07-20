/**
 * Composable: fetch a single post from Worker API.
 * Returns post metadata + Markdown content.
 *
 * Usage:
 *   const { post, content, loading, error } = useDynamicPost()
 *   // Call refresh(slug) when slug changes
 */

import { ref, computed } from 'vue'
import { apiGet } from './api'
import type { ApiPostDetail, PostDetail } from './types'

export function useDynamicPost() {
  const post = ref<PostDetail | null>(null) as Ref<PostDetail | null>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch(slug: string): Promise<void> {
    if (!slug) {
      error.value = 'slug is required'
      return
    }

    loading.value = true
    error.value = null

    try {
      const data = await apiGet<ApiPostDetail>(`/posts/${encodeURIComponent(slug)}`)

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

  return {
    post: computed(() => post.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    refresh: fetch,
  }
}
