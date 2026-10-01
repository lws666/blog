import { Hono } from 'hono'
import { success, badRequest, error as errRes } from '../utils/response'
import { loginWithPassword } from '../auth'
import type { Env } from '../index'

/**
 * Auth API.
 *
 * POST /api/auth/login        — 用户名+密码登录，签发 7 天会话令牌
 * POST /api/auth/logout       — 吊销当前会话（需要会话令牌）
 * GET  /api/auth/me           — 当前会话的用户信息
 *
 * （GitHub OAuth 登录保留在下方，仅管理员本人可用）
 */
export function createUserAuthRoutes() {
  const router = new Hono<{ Bindings: Env }>()

  // ── POST /login — 用户名 + 密码 ──────────────────────────────
  router.post('/login', async (c) => {
    try {
      const body = await c.req.json<{ username?: string, password?: string }>()
      const username = (body.username || '').trim().toLowerCase()
      const password = body.password || ''
      if (!username || !password)
        return badRequest('username and password are required')

      const result = await loginWithPassword(c.env.DB, username, password)
      if ('error' in result)
        return errRes(result.error, 401)

      return success({
        token: result.token,
        expires_in: 7 * 24 * 3600,
        user: result.user,
      })
    } catch (e) {
      return errRes((e as Error).message)
    }
  })

  // ── POST /logout — 吊销当前会话 ──────────────────────────────
  router.post('/logout', async (c) => {
    const plaintext = (c.req.header('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (plaintext.startsWith('sess_')) {
      const { sha256Hex } = await import('../auth')
      await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
        .bind(await sha256Hex(plaintext)).run()
    }
    return success({ logged_out: true })
  })

  // ── GET /me — 当前会话信息 ───────────────────────────────────
  router.get('/me', async (c) => {
    const plaintext = (c.req.header('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!plaintext.startsWith('sess_'))
      return errRes('Unauthorized', 401)
    const { userBySessionToken } = await import('../auth')
    const user = await userBySessionToken(c.env.DB, plaintext)
    if (!user)
      return errRes('Unauthorized', 401)
    return success({
      username: user.username,
      role: user.role,
      last_login_at: user.last_login_at,
    })
  })

  return router
}

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
