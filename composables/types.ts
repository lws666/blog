/**
 * Frontend types matching Valaxy's Post format.
 * Used to bridge Worker API responses → Valaxy components.
 */

// Raw API response from worker
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Post list item from API
export interface ApiPostItem {
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

// Post detail from API
export interface ApiPostDetail extends ApiPostItem {
  content: string
  frontmatter: Record<string, unknown>
}

export interface Pagination {
  page: number
  limit: number
  total: number
  total_pages: number
}

// Paginated list response
export interface ApiPostList {
  posts: ApiPostItem[]
  pagination: Pagination
}

// Stats response
export interface ApiStats {
  post_count: number
  category_count: number
  tag_count: number
}

// Post type compatible with Valaxy components
// Must match the shape consumed by YunPostCard and usePostList
export interface Post {
  path: string
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
  draft: boolean
}

// Post detail with markdown content
export interface PostDetail extends Post {
  content: string
}
