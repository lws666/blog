import { Hono } from 'hono'
import { success, badRequest, error as errRes } from '../utils/response'
import type { Env } from '../index'

/**
 * Auth API: GitHub OAuth login for the admin dashboard.
 *
 * GET  /api/auth/github/config — public client_id (frontend button visibility)
 * POST /api/auth/github        — exchange OAuth code, verify identity,
 *                                issue the admin token
 *
 * This router is mounted OUTSIDE the Bearer-token middleware: access control
 * here IS the GitHub OAuth check below. Only the account `lws666` may obtain
 * an admin token. The OAuth app requests NO scopes (public data only).
 */
const ALLOWED_GITHUB_LOGIN = 'lws666'

export function createAuthRouter() {
  const router = new Hono<{ Bindings: Env }>()

  // ── GET /github/config — is OAuth configured? ────────────────
  // The client_id is public (it appears in the authorize URL anyway);
  // the frontend uses it to build the redirect and to decide whether
  // to show the GitHub button. No secret ever leaves this worker.
  router.get('/github/config', (c) => {
    return success({ client_id: c.env.GITHUB_CLIENT_ID || null })
  })

  // ── POST /github — code → token → identity check ─────────────
  router.post('/github', async (c) => {
    try {
      const { code } = await c.req.json<{ code?: string }>()
      if (!code) return badRequest('code is required')
      if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) {
        return errRes('GitHub OAuth 尚未配置')
      }

      // 1. Exchange the one-time code for an access token. The client
      //    secret never leaves the worker.
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: c.env.GITHUB_CLIENT_ID,
          client_secret: c.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      })
      const tokenData = await tokenRes.json<{ access_token?: string, error?: string, error_description?: string }>()
      if (!tokenData.access_token) {
        return errRes(tokenData.error_description || tokenData.error || 'GitHub 授权码无效或已过期')
      }

      // 2. Fetch the identity behind the token
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'blog-worker',
        },
      })
      if (!userRes.ok) return errRes('无法获取 GitHub 用户信息')
      const user = await userRes.json<{ login?: string }>()

      // 3. Hard gate: only the owner's account may log in
      if ((user.login || '').toLowerCase() !== ALLOWED_GITHUB_LOGIN) {
        return c.json(
          { success: false, error: `仅 ${ALLOWED_GITHUB_LOGIN} 可登录，当前账号: ${user.login || '未知'}` },
          403,
        )
      }

      // 4. Issue the same admin token the password path uses
      return success({ login: user.login, token: c.env.UPLOAD_TOKEN })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  return router
}
