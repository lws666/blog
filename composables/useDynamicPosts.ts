/**
 * Composable: fetch post list from Worker API.
 * Returns data in Valaxy-compatible Post format.
 *
 * Usage:
 *   const { posts, loading, error, refresh } = useDynamicPosts()
 *   const { posts, loading } = useDynamicPosts({ category: 'dev', page: 1 })
 */

import { ref, computed, type Ref } from 'vue'
import { apiGet } from './api'
import type { ApiPostItem, ApiPostList, Post, Pagination } from './types'

export interface UseDynamicPostsOptions {
  page?: number
  limit?: number
  category?: string
  tag?: string
  keyword?: string
}

export function useDynamicPosts(options: UseDynamicPostsOptions = {}) {
  const posts = ref<Post[]>([]) as Ref<Post[]>
  const pagination = ref<Pagination | null>(null) as Ref<Pagination | null>
  const loading = ref(false)
  const error = ref<string | null>(null)
  const opts = ref(options)

  async function fetch(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      console.log('[DynamicPosts] fetching /posts...', { page: opts.value.page, limit: opts.value.limit })
      const data = await apiGet<ApiPostList>('/posts', {
        page: opts.value.page,
        limit: opts.value.limit,
        category: opts.value.category,
        tag: opts.value.tag,
        keyword: opts.value.keyword,
      })

      console.log('[DynamicPosts] received', data.posts?.length, 'posts')
      posts.value = data.posts.map(mapPost)
      pagination.value = data.pagination
    } catch (e) {
      console.error('[DynamicPosts] fetch failed:', (e as Error).message)
      error.value = (e as Error).message
      posts.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Change page and re-fetch.
   */
  function setPage(page: number): void {
    opts.value.page = page
    fetch()
  }

  /**
   * Update filters and re-fetch (resets to page 1).
   */
  function setFilters(filters: Partial<UseDynamicPostsOptions>): void {
    opts.value = { ...opts.value, ...filters, page: 1 }
    fetch()
  }

  // Auto-fetch on mount
  if (import.meta.client || !import.meta.env.SSR) {
    fetch()
  }

  return {
    posts: computed(() => posts.value),
    pagination: computed(() => pagination.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    refresh: fetch,
    setPage,
    setFilters,
  }
}

/**
 * Map API post item to Valaxy-compatible Post format.
 */
function mapPost(item: ApiPostItem): Post {
  return {
    path: `/posts/${item.slug}`,
    slug: item.slug,
    title: item.title,
    date: item.date,
    updated: item.updated || item.date,
    tags: item.tags || [],
    categories: item.categories || [],
    excerpt: item.excerpt || '',
    cover: item.cover || '',
    type: item.type || 'post',
    top: item.top || 0,
    hide: item.hide || '',
    draft: false,
  }
}
