import type { ApiResponse } from '../types'

export function success<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function error(message: string, status = 500): Response {
  const body: ApiResponse = { success: false, error: message }
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function notFound(message = 'Not Found'): Response {
  return error(message, 404)
}

export function badRequest(message: string): Response {
  return error(message, 400)
}

export function unauthorized(message = 'Unauthorized'): Response {
  return error(message, 401)
}
