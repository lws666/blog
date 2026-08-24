// Cloudflare D1 row types

export interface PostRow {
  id: number
  slug: string
  title: string
  date: string
  updated: string
  tags: string          // JSON array string
  categories: string    // JSON array string
  excerpt: string
  cover: string
  type: string
  top: number
  draft: number         // 0 or 1
  hide: string
  password: string
  encrypt: number       // 0 or 1
  comment: number       // 0 or 1
  toc: number           // 0 or 1
  nav: number           // 0 or 1
  pinned: number        // 0 or 1
  b2_key: string
  content: string | null
  summary: string       // AI 生成的摘要（'' = 未生成）
  frontmatter: string   // JSON object string
  created_at: string
  updated_at: string
}

// Upload (album) row
export interface UploadRow {
  id: number
  b2_key: string
  filename: string
  mime_type: string
  size: number
  url: string
  created_at: string
}

// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// Pagination info
export interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

// Post list API output (without content, password)
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

// Post detail API output (with content)
export interface PostDetail extends PostListItem {
  content: string
  /** AI-generated summary ('' when not generated) */
  summary: string
  frontmatter: Record<string, unknown>
  /** Enable/disable comments (true by default) */
  comment: boolean
}
