/**
 * 后端 API 客户端 —— 对接现有 Cloudflare Worker（api.lwsnb.eu.cc）。
 *
 * 统一信封：{ success: true, data } | { success: false, error }
 * 公开接口无需认证；管理接口用 Bearer token。
 */
import { site } from './site'

export interface PostListItem {
  slug: string
  title: string
  date: string
  updated: string
  tags: string[]
  categories: string[]
  excerpt: string
  cover: string
  type: string
  top: number
  hide: string
}

export interface PostDetail extends PostListItem {
  content: string
  summary: string
  frontmatter: Record<string, unknown>
  comment: boolean
}

export interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface PostListResult {
  posts: PostListItem[]
  pagination: Pagination
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

interface Envelope<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 统一的请求封装。
 * - f: SvelteKit 的 fetch（传入以便在 SSR 时继承 cookie / 走内部优化）
 */
async function request<T>(f: typeof fetch, path: string, init?: RequestInit): Promise<T> {
  const res = await f(`${site.apiBase}${path}`, {
    ...init,
    headers: {
      // Cloudflare 对无 UA / 脚本 UA 会 403（error 1010），必须带浏览器式 UA
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  let body: Envelope<T> | null = null
  try {
    body = (await res.json()) as Envelope<T>
  } catch {
    throw new ApiError(`后端返回非 JSON（HTTP ${res.status}）`, res.status)
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(body?.error || `请求失败（HTTP ${res.status}）`, res.status)
  }
  return body.data as T
}

/** 文章列表（仅已发布） */
export function fetchPosts(
  f: typeof fetch,
  opts: { page?: number; limit?: number; category?: string; tag?: string; keyword?: string } = {},
): Promise<PostListResult> {
  const q = new URLSearchParams()
  q.set('page', String(opts.page ?? 1))
  q.set('limit', String(opts.limit ?? site.postsPerPage))
  if (opts.category) q.set('category', opts.category)
  if (opts.tag) q.set('tag', opts.tag)
  if (opts.keyword) q.set('keyword', opts.keyword)
  return request<PostListResult>(f, `/api/posts?${q}`)
}

/** 文章详情（草稿不返回，404 抛错） */
export function fetchPost(f: typeof fetch, slug: string): Promise<PostDetail> {
  return request<PostDetail>(f, `/api/posts/${encodeURIComponent(slug)}`)
}

/** 站点统计 */
export function fetchStats(f: typeof fetch): Promise<Record<string, number>> {
  return request<Record<string, number>>(f, `/api/stats`)
}

/** 相册列表（需要认证；公开页面用图片直链即可） */
export function fetchAlbum(f: typeof fetch, opts: { page?: number; limit?: number } = {}): Promise<{
  images: { id: number; filename: string; url: string; created_at: string }[]
  pagination: Pagination
}> {
  const q = new URLSearchParams()
  q.set('page', String(opts.page ?? 1))
  q.set('limit', String(opts.limit ?? 50))
  return request(f, `/api/album?${q}`)
}
