/**
 * API client for the Worker backend.
 * Handles fetch, error handling, and base URL configuration.
 */

import type { ApiResponse } from './types'

export interface ApiConfig {
  /** API base URL, default: /api */
  baseUrl: string
}

const config: ApiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE || '/api',
}

/**
 * Configure the API client (call during app setup).
 */
export function configureApi(baseUrl: string): void {
  config.baseUrl = baseUrl.replace(/\/+$/, '')
}

/**
 * Generic GET request.
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

  const res = await fetch(url)

  const body: ApiResponse<T> = await res.json()

  if (!body.success || !body.data) {
    throw new Error(body.error || `API error: ${res.status}`)
  }

  return body.data
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
