/**
 * Composable: fetch a single post from Worker API.
 * Returns post metadata + Markdown content.
 *
 * Usage:
 *   const { post, content, loading, error } = useDynamicPost()
 *   // Call refresh(slug) when slug changes
 */

import { ref, computed, type Ref } from 'vue'
import { apiGet } from './api'
import type { ApiPostDetail, PostDetail } from './types'

/** sessionStorage key prefix for the stale-while-revalidate cache */
const CACHE_PREFIX = 'post-cache:'
/** Ignore cached entries older than this (a day) */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface CachedPost {
  at: number
  post: PostDetail
}

function readCache(slug: string): PostDetail | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + slug)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedPost
    if (!parsed?.post || Date.now() - parsed.at > CACHE_TTL_MS) return null
    return parsed.post
  } catch {
    return null
  }
}

function writeCache(slug: string, post: PostDetail): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + slug, JSON.stringify({ at: Date.now(), post }))
  } catch {
    // Quota or private mode — the cache is an optimisation, never a requirement.
  }
}

export function useDynamicPost() {
  const post = ref<PostDetail | null>(null) as Ref<PostDetail | null>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetch(slug: string): Promise<void> {
    if (!slug) {
      error.value = 'slug is required'
      return
    }

    // Paint the last visit immediately, then revalidate in the background.
    // Reading a post is the most latency-sensitive path on the site, and a
    // slow or failed round trip must not leave the reader with a blank page.
    const cached = readCache(slug)
    if (cached) {
      post.value = cached
      error.value = null
      loading.value = false
    } else {
      post.value = null
      loading.value = true
      error.value = null
    }

    try {
      const data = await apiGet<ApiPostDetail>(`/posts/${encodeURIComponent(slug)}`)

      const fresh: PostDetail = {
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
        comment: data.comment !== undefined ? data.comment : true,
        summary: data.summary || '',
        content: data.content || '',
      }

      post.value = fresh
      writeCache(slug, fresh)
    } catch (e) {
      // With cached content on screen, a failed revalidation is invisible —
      // only surface the error when there is nothing to show.
      if (!post.value) {
        error.value = (e as Error).message
        post.value = null
      } else {
        console.warn('[useDynamicPost] revalidate failed:', (e as Error).message)
      }
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
