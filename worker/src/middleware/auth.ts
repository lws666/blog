/**
 * Bearer Token authentication middleware for upload endpoints.
 *
 * opts.allowTotp: also accept `Authorization: TOTP <token>` without checking
 * it here — the caller's 2FA gate (requireTotp) validates that scheme.
 * Needed so TOTP session tokens reach the 2FA gate instead of being rejected
 * as an unknown auth scheme. The TOTP management router itself must NOT
 * enable this (a session must never be able to mint new sessions).
 */

export function createAuthMiddleware(token: string, opts: { allowTotp?: boolean } = {}) {
  return (request: Request): Response | null => {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader || (!authHeader.startsWith('Bearer ') && !(opts.allowTotp && authHeader.startsWith('TOTP ')))) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // TOTP scheme is validated downstream by requireTotp
    if (authHeader.startsWith('TOTP ')) {
      return null
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
