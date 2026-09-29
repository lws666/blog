import { Hono } from 'hono'
import { createAuthMiddleware } from '../middleware/auth'
import { success, badRequest, notFound } from '../utils/response'
import type { Env } from '../index'

/**
 * 可签发的 API 子令牌（App 用）。
 *
 * 管理员令牌（UPLOAD_TOKEN 本尊）可以创建/吊销两类子令牌：
 *   scope 'read'  — 只读：全部公开 GET（posts/album 列表、详情、stats…）
 *   scope 'write' — 读写：在只读之上放开写操作；不要求 2FA
 *     （2FA 是业主个人登录的管理员令牌的第二因子；App 拿到的写令牌
 *      本身就是业主主动签发的授权，设备端无人的验证器可打码）
 *
 * 安全：
 * - 库里只存 SHA-256(token)；明文 blg_… 只在创建响应中出现一次
 * - 令牌可吊销（revoked=1），可查 last_used_at
 * - 子令牌不能访问 /api/admin/tokens（令牌管理）与 /api/admin/totp/*
 *   （2FA 管理）——那些是管理员本尊的权限
 */

export interface TokenRow {
  id: number
  token_hash: string
  name: string
  scope: string
  created_at: string
  last_used_at: string
  revoked: number
}

export async function sha256Hex(input: string): Promise<string> {
  const mac = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export function generateApiToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const body = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  return `blg_${body}`
}

/** 归一化 Authorization：Bearer blg_… / Bearer <admin token> / TOTP <…> */
export function bearerOf(request: Request): string {
  const auth = request.headers.get('Authorization') || ''
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
}

/**
 * 查找令牌行（按明文）。管理员令牌不在表里 → 返回 null（调用方按
 * 管理员逻辑处理）。吊销/未知 → null。
 */
export async function findApiToken(db: D1Database, plaintext: string): Promise<TokenRow | null> {
  const hash = await sha256Hex(plaintext)
  return db.prepare(
    'SELECT id, token_hash, name, scope, created_at, last_used_at, revoked FROM api_tokens WHERE token_hash = ? AND revoked = 0',
  ).bind(hash).first() as unknown as TokenRow | null
}

export function createTokensRouter() {
  const router = new Hono<{ Bindings: Env, Variables: { auth: { is_admin: boolean, scope: string } } }>()

  // ── 仅管理员令牌（UPLOAD_TOKEN 本尊）可管理子令牌 ─────────────
  router.use('*', async (c, next) => {
    const rejected = createAuthMiddleware(c.env.UPLOAD_TOKEN)(c.req.raw)
    if (rejected) {
      const body = await rejected.json()
      return c.json(body, rejected.status as 401)
    }
    await next()
  })

  // ── GET /tokens — 列出全部子令牌（不含哈希） ─────────────────
  router.get('/tokens', async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT id, name, scope, created_at, last_used_at, revoked FROM api_tokens ORDER BY id DESC',
    ).all()
    return success({ tokens: results })
  })

  // ── POST /tokens — 签发 ─────────────────────────────────────
  router.post('/tokens', async (c) => {
    const body = await c.req.json<{ name?: string, scope?: string }>()
    const scope = body.scope === 'write' ? 'write' : 'read'
    const name = (body.name || '').trim().slice(0, 60)

    const plaintext = generateApiToken()
    const hash = await sha256Hex(plaintext)
    const now = new Date().toISOString()

    const res = await c.env.DB.prepare(
      'INSERT INTO api_tokens (token_hash, name, scope, created_at) VALUES (?, ?, ?, ?)',
    ).bind(hash, name, scope, now).run()

    return success({
      id: res.meta?.last_row_id,
      token: plaintext, // 仅此一次
      name,
      scope,
      created_at: now,
    }, 201)
  })

  // ── DELETE /tokens/:id — 吊销 ────────────────────────────────
  router.delete('/tokens/:id', async (c) => {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0)
      return badRequest('Invalid id')
    const res = await c.env.DB.prepare(
      'UPDATE api_tokens SET revoked = 1 WHERE id = ?',
    ).bind(id).run()
    if (!res.success || (res.meta?.changes ?? 0) === 0)
      return notFound('Token not found')
    return success({ revoked: true, id })
  })

  return router
}
