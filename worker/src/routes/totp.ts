import { Hono } from 'hono'
import { createAuthMiddleware } from '../middleware/auth'
import { success, badRequest } from '../utils/response'
import {
  verifyTotpCode,
  base32Encode,
  timingSafeEqual,
} from '../totp'
import type { Env } from '../index'

/**
 * TOTP 二步验证（谷歌身份验证器）— admin API 的第二道门。
 *
 * 设计：
 * - 密钥不是直接存明文，而是 HMAC-SHA256(UPLOAD_TOKEN, random) 的
 *   base32 —— 拿到数据库备份的人仍需 UPLOAD_TOKEN 才能恢复出可用密钥，
 *   拿到 UPLOAD_TOKEN 的人仍需数据库里的密文才能伪造验证码。
 * - 会话令牌 = HMAC-SHA256(UPLOAD_TOKEN, `totp-session:${account}:${step}`)，
 *   12 小时有效（按 30s step 计），无需服务端会话表；丢 token 不丢第二因子。
 * - 所有 /api/admin/* 写操作都要求 X-TOTP-Code 头（或已签发的会话令牌
 *   放在 Authorization 里替代原 token）。
 *
 * 路由（全部要求 Bearer UPLOAD_TOKEN）：
 * GET  /api/admin/totp/status   — 是否已绑定
 * POST /api/admin/totp/setup    — 生成密钥，返回 otpauth:// 与 base32
 * POST /api/admin/totp/confirm  — 输入验证码确认绑定
 * POST /api/admin/totp/session  — 用验证码换 12h 会话令牌（日常登录用）
 * POST /api/admin/totp/disable  — 关闭二步验证（需验证码）
 */

const ACCOUNT = 'lws666'
const SESSION_TTL_STEPS = 1440 // 30s × 1440 = 12h

/** HMAC-SHA256(UPLOAD_TOKEN, message) → hex */
async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 从密文恢复出真实的 base32 TOTP 密钥 */
async function deriveSecret(ciphertext: string, uploadToken: string): Promise<string> {
  const raw = await hmacHex(uploadToken, `totp-secret:${ciphertext}`)
  // HMAC 输出 32 字节，取前 20 字节（160 bit，与认证 App 常见密钥长度一致）
  const bytes = new Uint8Array(20)
  for (let i = 0; i < 20; i++)
    bytes[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16)
  return base32Encode(bytes)
}

/** 派生密钥是否在 ±step 内有效；同时返回匹配到的 step 供防重放记录 */
async function checkCode(
  env: Env,
  stored: { secret: string, confirmed: number, last_used_step: number },
  code: string,
): Promise<{ ok: boolean, matchedStep?: number, reason?: string }> {
  const realSecret = await deriveSecret(stored.secret, env.UPLOAD_TOKEN)
  const res = await verifyTotpCode(realSecret, code)
  if (!res.ok || res.matchedStep === undefined)
    return { ok: false, reason: '验证码错误或已过期' }

  // 防重放：同一个 step 的验证码只能用一次（登录/确认/关闭各场景共用）
  if (res.matchedStep <= stored.last_used_step)
    return { ok: false, reason: '该验证码已被使用，请等待下一个（约 30 秒）' }

  return { ok: true, matchedStep: res.matchedStep }
}

export function createTotpRouter() {
  const router = new Hono<{ Bindings: Env, Variables: { auth: { is_admin: boolean, scope: string } } }>()

  // ── Bearer token required on everything below ───────────────
  // 守卫：2FA 管理仅限管理员本尊凭证（UPLOAD_TOKEN）。Hono 子 app 的
  // use('/totp*') 不命中，handler 内显式调用
  const guard = async (c: any): Promise<Response | null> => {
    const rejected = createAuthMiddleware(c.env.UPLOAD_TOKEN)(c.req.raw)
    if (rejected) {
      const body = await rejected.json()
      return c.json(body, rejected.status as 401)
    }
    return null
  }

  /** 读取（或初始化）当前账号的 TOTP 行 */
  async function getRow(c: any): Promise<{ secret: string, confirmed: number, last_used_step: number }> {
    const raw = c.env.DB
    await raw.prepare(
      'CREATE TABLE IF NOT EXISTS totp_secrets (account TEXT PRIMARY KEY, secret TEXT NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0, last_used_step INTEGER NOT NULL DEFAULT 0)',
    ).run()
    const row = await raw.prepare('SELECT secret, confirmed, last_used_step FROM totp_secrets WHERE account = ?')
      .bind(ACCOUNT)
      .first() as { secret: string, confirmed: number, last_used_step: number } | null
    if (row)
      return row
    return { secret: '', confirmed: 0, last_used_step: 0 }
  }

  async function markUsedStep(c: any, step: number) {
    await c.env.DB.prepare('UPDATE totp_secrets SET last_used_step = ? WHERE account = ?')
      .bind(step, ACCOUNT)
      .run()
  }

  // ── GET /status ──────────────────────────────────────────────
  router.get('/status', async (c) => {
    const denied = await guard(c); if (denied) return denied
    const row = await getRow(c)
    return success({ enabled: row.confirmed === 1 })
  })

  // ── POST /setup — 生成（或重置）密钥，进入绑定流程 ───────────
  router.post('/setup', async (c) => {
    const denied = await guard(c); if (denied) return denied
    const row = await getRow(c)
    if (row.confirmed === 1) {
      return badRequest('二步验证已启用。如需重新绑定，请先用验证码关闭。')
    }

    // 随机熵 → HMAC 密文入库；真实 base32 密钥只出现在本次响应里
    const entropy = crypto.getRandomValues(new Uint8Array(20))
    const entropyHex = [...entropy].map(b => b.toString(16).padStart(2, '0')).join('')
    const ciphertext = await hmacHex(c.env.UPLOAD_TOKEN, `totp-entropy:${entropyHex}`)
    const realSecret = await deriveSecret(ciphertext, c.env.UPLOAD_TOKEN)

    await c.env.DB.prepare(
      'INSERT INTO totp_secrets (account, secret, confirmed, last_used_step) VALUES (?, ?, 0, 0) ON CONFLICT(account) DO UPDATE SET secret = excluded.secret, confirmed = 0, last_used_step = 0',
    ).bind(ACCOUNT, ciphertext).run()

    const otpauth = `otpauth://totp/${encodeURIComponent(`谢谢の博客 (${ACCOUNT})`)}?secret=${realSecret}&issuer=${encodeURIComponent('lwsnb.eu.cc')}&algorithm=SHA1&digits=6&period=30`
    return success({ secret: realSecret, otpauth })
  })

  // ── POST /confirm — 输入验证码确认绑定 ───────────────────────
  router.post('/confirm', async (c) => {
    const denied = await guard(c); if (denied) return denied
    const { code } = await c.req.json<{ code?: string }>()
    if (!code) return badRequest('code is required')

    const row = await getRow(c)
    if (row.confirmed === 1)
      return badRequest('二步验证已启用')
    if (!row.secret)
      return badRequest('请先调用 /setup 生成密钥')

    const check = await checkCode(c.env, row, code)
    if (!check.ok) return badRequest(check.reason || '验证码错误')

    await c.env.DB.prepare('UPDATE totp_secrets SET confirmed = 1, last_used_step = ? WHERE account = ?')
      .bind(check.matchedStep ?? 0, ACCOUNT)
      .run()
    return success({ enabled: true })
  })

  // ── POST /session — 验证码换 12h 会话令牌 ────────────────────
  router.post('/session', async (c) => {
    const denied = await guard(c); if (denied) return denied
    const { code } = await c.req.json<{ code?: string }>()
    if (!code) return badRequest('code is required')

    const row = await getRow(c)
    if (row.confirmed !== 1)
      return badRequest('二步验证未启用')

    const check = await checkCode(c.env, row, code)
    if (!check.ok) return badRequest(check.reason || '验证码错误')

    const nowStep = Math.floor(Date.now() / 1000 / 30)
    await markUsedStep(c, check.matchedStep ?? 0)
    const token = await hmacHex(c.env.UPLOAD_TOKEN, `totp-session:${ACCOUNT}:${nowStep}`)
    return success({ token, ttlSeconds: SESSION_TTL_STEPS * 30 })
  })

  // ── POST /disable — 关闭二步验证（需验证码） ─────────────────
  router.post('/disable', async (c) => {
    const denied = await guard(c); if (denied) return denied
    const { code } = await c.req.json<{ code?: string }>()
    if (!code) return badRequest('code is required')

    const row = await getRow(c)
    if (row.confirmed !== 1)
      return success({ enabled: false })

    const check = await checkCode(c.env, row, code)
    if (!check.ok) return badRequest(check.reason || '验证码错误')

    await markUsedStep(c, check.matchedStep ?? 0)
    await c.env.DB.prepare('DELETE FROM totp_secrets WHERE account = ?').bind(ACCOUNT).run()
    return success({ enabled: false })
  })

  return router
}

/**
 * Admin 写操作的 2FA 门禁：验证 Authorization 里的会话令牌，或接受
 * X-TOTP-Code 头里的验证码（直接换发一次通过）。未启用 2FA 时不拦。
 *
 * 返回 null = 放行；否则返回要直接回给客户端的 Response。
 */
export async function requireTotp(c: any): Promise<Response | null> {
  const raw = c.env.DB
  await raw.prepare(
    'CREATE TABLE IF NOT EXISTS totp_secrets (account TEXT PRIMARY KEY, secret TEXT NOT NULL, confirmed INTEGER NOT NULL DEFAULT 0, last_used_step INTEGER NOT NULL DEFAULT 0)',
  ).run()
  const row = await raw.prepare(
    'SELECT secret, confirmed, last_used_step FROM totp_secrets WHERE account = ?',
  ).bind(ACCOUNT).first() as { secret: string, confirmed: number, last_used_step: number } | null
  if (!row || row.confirmed !== 1) return null // 未启用 → 不拦

  // 1) 会话令牌：Authorization: TOTP <token>
  const auth = c.req.header('Authorization') || ''
  if (auth.startsWith('TOTP ')) {
    const provided = auth.slice(5).trim()
    const nowStep = Math.floor(Date.now() / 1000 / 30)
    for (let i = 0; i < SESSION_TTL_STEPS; i++) {
      const expected = await hmacHex(c.env.UPLOAD_TOKEN, `totp-session:${ACCOUNT}:${nowStep - i}`)
      if (timingSafeEqual(expected, provided)) return null
    }
    return c.json({ success: false, error: '二步验证会话已过期，请重新输入验证码' }, 401)
  }

  // 2) 单次验证码：X-TOTP-Code 头
  const code = c.req.header('X-TOTP-Code')
  if (code) {
    const check = await checkCode(c.env, row, String(code))
    if (check.ok) {
      await c.env.DB.prepare('UPDATE totp_secrets SET last_used_step = ? WHERE account = ?')
        .bind(check.matchedStep ?? 0, ACCOUNT)
        .run()
      return null
    }
    return c.json({ success: false, error: check.reason || '验证码错误' }, 401)
  }

  return c.json({ success: false, error: '需要二步验证（X-TOTP-Code 或 TOTP 会话令牌）' }, 401)
}
