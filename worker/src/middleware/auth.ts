/**
 * Bearer Token authentication middleware for upload endpoints.
 */

export function createAuthMiddleware(token: string) {
  return (request: Request): Response | null => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const providedToken = authHeader.slice(7)

    if (providedToken !== token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    return null // authorized
  }
}
