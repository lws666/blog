/**
 * API client for the Worker backend.
 * Handles fetch, error handling, and base URL configuration.
 */

import type { ApiResponse } from './types'

export interface ApiConfig {
  /** API base URL, default: /api */
  baseUrl: string
}

/**
 * API base URL.
 *
 * Client: "/api" — same-origin. The entry Worker forwards it to blog-worker
 * via a service binding, so the browser reuses the connection it already has
 * (no second DNS + TLS handshake) and does not depend on the api.* subdomain
 * being reachable.
 *
 * SSR/prerender: relative URLs cannot be fetched from Node, so fall back to
 * the public origin.
 *
 * Dev: valaxy.config.ts proxies /api to the Worker.
 */
const API_ORIGIN = 'https://api.lwsnb.eu.cc'
const API_BASE = typeof window === 'undefined' ? `${API_ORIGIN}/api` : '/api'

const config: ApiConfig = {
  baseUrl: API_BASE,
}

/** Abort a single attempt after this long — a hung request must not hang the page */
const REQUEST_TIMEOUT_MS = 8000
/** Back-off between attempts; length also decides the retry count */
const RETRY_DELAYS_MS = [400, 1200]

/**
 * Configure the API client (call during app setup).
 */
export function configureApi(baseUrl: string): void {
  config.baseUrl = baseUrl.replace(/\/+$/, '')
}

/** HTTP-level failure that is not worth retrying (4xx other than 408/429) */
class ApiHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function isRetryable(e: unknown): boolean {
  if (e instanceof ApiHttpError) {
    return e.status === 408 || e.status === 429 || e.status >= 500
  }
  // Network error, abort/timeout, non-JSON body (e.g. an edge error page)
  return true
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Generic GET request, with a timeout and bounded retries.
 *
 * Post loading used to fail outright on a single slow or flaky round trip,
 * which surfaced as "文章加载不出来" until a manual reload.
 */
export async function apiGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  let url = `${config.baseUrl}${path}`

  if (params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        searchParams.set(key, String(value))
      }
    }
    const qs = searchParams.toString()
    if (qs) url += `?${qs}`
  }

  let lastError: unknown

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(url, { signal: controller.signal })

      let body: ApiResponse<T> | undefined
      try {
        body = await res.json()
      } catch {
        // Non-JSON body: an edge error page, a challenge, or a truncated
        // response. Retryable.
        throw new ApiHttpError(`接口返回了非 JSON 响应 (HTTP ${res.status})`, res.status)
      }

      if (!body.success || !body.data) {
        throw new ApiHttpError(body.error || `API error: ${res.status}`, res.status)
      }

      return body.data
    } catch (e) {
      lastError = e
      if (!isRetryable(e) || attempt === RETRY_DELAYS_MS.length) break
      await sleep(RETRY_DELAYS_MS[attempt])
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * Generic POST request.
 */
export async function apiPost<T>(path: string, data: unknown): Promise<T> {
  const url = `${config.baseUrl}${path}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const body: ApiResponse<T> = await res.json()

  if (!body.success || !body.data) {
    throw new Error(body.error || `API error: ${res.status}`)
  }

  return body.data
}
