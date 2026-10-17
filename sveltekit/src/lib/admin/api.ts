/**
 * 管理后台 API 客户端。
 *
 * 认证：用户名 + 密码登录换取 sess_… 会话令牌（7 天），
 * 之后所有管理请求带 Authorization: Bearer <token>。
 *
 * 注意：后端对无浏览器式 UA 的请求会 403（Cloudflare 1010），
 * 因此统一带 UA；同时统一解析 { success, data | error } 信封。
 */
import { site } from '#lib/site'

const BASE = `${site.apiBase}/api`
const TOKEN_KEY = 'admin_token'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

export class AdminError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'AdminError'
  }
}

export function getToken(): string {
  if (typeof localStorage === 'undefined') return ''
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

interface Envelope<T> {
  success: boolean
  data?: T
  error?: string
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'User-Agent': UA,
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers })

  let body: Envelope<T> | null = null
  try {
    body = (await res.json()) as Envelope<T>
  } catch {
    throw new AdminError(`服务器返回异常（HTTP ${res.status}）`, res.status)
  }

  if (res.status === 401) {
    clearToken()
    throw new AdminError('登录已过期，请重新登录', 401)
  }
  if (!res.ok || !body?.success) {
    throw new AdminError(body?.error || `请求失败（HTTP ${res.status}）`, res.status)
  }
  return body.data as T
}

/* ── 类型 ─────────────────────────────────────────────────── */

export interface AdminPost {
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
  draft?: boolean
}

export interface AdminPostDetail extends AdminPost {
  content: string
  summary: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

/* ── 认证 ─────────────────────────────────────────────────── */

export async function login(username: string, password: string): Promise<{ token: string, user: { username: string, role: string } }> {
  const data = await request<{ token: string, user: { username: string, role: string } }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ username, password }) },
  )
  setToken(data.token)
  return data
}

export async function me(): Promise<{ username: string, role: string, last_login_at: string }> {
  return request('/auth/me')
}

export async function logout(): Promise<void> {
  try { await request('/auth/logout', { method: 'POST' }) } catch { /* 忽略 */ }
  clearToken()
}

/* ── 文章 ─────────────────────────────────────────────────── */

export interface PostInput {
  slug: string
  title: string
  date?: string
  categories?: string[]
  tags?: string[]
  cover?: string
  excerpt?: string
  content?: string
  draft?: boolean
  type?: string
  top?: number
  hide?: string
  comment?: boolean
  toc?: boolean
  nav?: boolean
}

export async function listPosts(opts: { page?: number, limit?: number } = {}): Promise<{ posts: AdminPost[], pagination: Pagination }> {
  const q = new URLSearchParams({
    page: String(opts.page ?? 1),
    limit: String(opts.limit ?? 20),
  })
  return request(`/admin/posts?${q}`)
}

export async function getPost(slug: string): Promise<AdminPostDetail> {
  return request(`/admin/posts/${encodeURIComponent(slug)}`)
}

export async function savePost(input: PostInput): Promise<{ slug: string, url: string }> {
  return request('/admin/posts', { method: 'POST', body: JSON.stringify(input) })
}

export async function deletePost(slug: string): Promise<{ deleted: boolean }> {
  return request(`/admin/posts/${encodeURIComponent(slug)}`, { method: 'DELETE' })
}

export async function genSummary(slug: string): Promise<{ slug: string, summary: string }> {
  return request(`/admin/posts/${encodeURIComponent(slug)}/summary`, { method: 'POST' })
}

/* ── 封面 ─────────────────────────────────────────────────── */

export async function makeCover(opts: { title: string, text?: string, excerpt?: string, tags?: string }): Promise<{ url: string }> {
  return request('/cover', { method: 'POST', body: JSON.stringify({ engine: 'svg', ...opts }) })
}

/* ── 相册 ─────────────────────────────────────────────────── */

export interface AlbumImage {
  id: number
  filename: string
  url: string
  size: number
  created_at: string
}

export async function listAlbum(): Promise<{ images: AlbumImage[], pagination: Pagination }> {
  const r = await request<{ images: AlbumImage[], pagination: Pagination }>('/album?limit=100')
  // 后端返回的是相对路径（/api/album/file/...），在 Pages 域名下会 404，
  // 这里补全成 Worker 的绝对地址。
  r.images = r.images.map(img => ({
    ...img,
    url: img.url?.startsWith('/') ? `${site.apiBase}${img.url}` : img.url,
  }))
  return r
}

export async function uploadAlbum(file: File): Promise<AlbumImage> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/album`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Authorization: `Bearer ${getToken()}`,
    },
    body: form,
  })
  const body = (await res.json()) as Envelope<AlbumImage>
  if (!res.ok || !body.success) throw new AdminError(body.error || '上传失败', res.status)
  const img = body.data as AlbumImage
  if (img?.url?.startsWith('/')) img.url = `${site.apiBase}${img.url}`
  return img
}

export async function deleteAlbum(id: number): Promise<void> {
  await request(`/album/${id}`, { method: 'DELETE' })
}
