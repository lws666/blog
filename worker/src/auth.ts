/**
 * 用户名 + 密码认证核心。
 *
 * - 口令：PBKDF2-SHA256，10 万次迭代，16 字节盐（WebCrypto 派生比特，
 *   存储格式 pbkdf2$<iter>$<b64salt>$<b64hash>）
 * - 会话：sess_…（24 字节熵），SHA-256 哈希入库，7 天绝对过期
 * - 兼容：UPLOAD_TOKEN 本尊（admin 等价）与 blg_… 子令牌照旧可用
 *
 * 凭证解析结果（resolveCredential）：
 *   { kind: 'admin' }                    — users.role='admin' 的会话 / UPLOAD_TOKEN / TOTP 会话
 *   { kind: 'user', role: 'read'|'write' } — 子用户会话
 *   { kind: 'api_token', role }          — blg_… 子令牌（旧体系，继续有效）
 */

const PBKDF2_ITERATIONS = 100_000
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000

export function hashPassword(password: string): Promise<string> {
  return derivePassword(password, crypto.getRandomValues(new Uint8Array(16)))
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2')
    return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations < 1)
    return false

  // 盐与哈希段支持 hex（推荐，shell/D1 安全）与 base64（历史格式）
  let salt: Uint8Array
  let expected: string
  if (/^[0-9a-f]+$/i.test(parts[2]) && /^[0-9a-f]+$/i.test(parts[3])) {
    salt = hexToBytes(parts[2])
    expected = parts[3].toLowerCase()
  }
  else {
    salt = Uint8Array.from(atobB64(parts[2]))
    expected = parts[3]
  }

  const derived = await pbkdf2(password, salt, iterations)
  const got = bytesToHex(derived)
  // 常数时间比较
  let diff = got.length === expected.length ? 0 : 1
  for (let i = 0; i < Math.max(got.length, expected.length); i++)
    diff |= (got.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0)
  return diff === 0
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++)
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}

function derivePassword(password: string, salt: Uint8Array): Promise<string> {
  return pbkdf2(password, salt, PBKDF2_ITERATIONS).then(h => `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(h)}`)
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as ArrayBuffer, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function atobB64(s: string): Uint8Array {
  const raw = atob(s)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

export async function sha256Hex(input: string): Promise<string> {
  const mac = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface UserRow {
  id: number
  username: string
  password_hash: string
  role: string
  totp_enabled: number
  disabled: number
  created_at: string
  last_login_at: string
}

/** 登录：成功返回新建的会话令牌明文（只出现这一次） */
export async function loginWithPassword(
  db: D1Database,
  username: string,
  password: string,
): Promise<{ token: string, user: { id: number, username: string, role: string } } | { error: string }> {
  const user = await db.prepare(
    'SELECT id, username, password_hash, role, totp_enabled, disabled, created_at, last_login_at FROM users WHERE username = ?',
  ).bind(username).first() as unknown as UserRow | null

  if (!user)
    return { error: '用户名或密码错误' }
  if (user.disabled)
    return { error: '该用户已被禁用' }

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok)
    return { error: '用户名或密码错误' }

  const plaintext = `sess_${[...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('')}`
  const hash = await sha256Hex(plaintext)
  const now = Date.now()
  await db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).bind(hash, user.id, new Date(now).toISOString(), new Date(now + SESSION_TTL_MS).toISOString()).run()
  await db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .bind(new Date(now).toISOString(), user.id).run()

  return { token: plaintext, user: { id: user.id, username: user.username, role: user.role } }
}

export interface SessionRow {
  token_hash: string
  user_id: number
  created_at: string
  expires_at: string
}

/** 会话令牌 → 用户行（过期/禁用视为无效） */
export async function userBySessionToken(db: D1Database, plaintext: string): Promise<UserRow | null> {
  if (!plaintext.startsWith('sess_'))
    return null
  const hash = await sha256Hex(plaintext)
  const row = await db.prepare(
    `SELECT s.token_hash, s.user_id, s.created_at, s.expires_at,
            u.id AS uid, u.username, u.password_hash, u.role, u.totp_enabled, u.disabled, u.created_at AS u_created, u.last_login_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
  ).bind(hash).first<any>()
  if (!row)
    return null
  if (row.expires_at < new Date().toISOString())
    return null
  return {
    id: row.user_id,
    username: row.username,
    password_hash: row.password_hash,
    role: row.role,
    totp_enabled: row.totp_enabled,
    disabled: row.disabled,
    created_at: row.u_created,
    last_login_at: row.last_login_at,
  }
}

/** 旧 blg_… API 子令牌（保持兼容） */
export async function apiTokenByPlaintext(db: D1Database, plaintext: string): Promise<{ scope: 'read' | 'write' } | null> {
  if (!plaintext.startsWith('blg_'))
    return null
  const hash = await sha256Hex(plaintext)
  const row = await db.prepare(
    'SELECT scope FROM api_tokens WHERE token_hash = ? AND revoked = 0',
  ).bind(hash).first<{ scope: string }>()
  if (!row)
    return null
  return { scope: row.scope === 'write' ? 'write' : 'read' }
}

export type Credential =
  | { kind: 'admin' }
  | { kind: 'user', role: 'read' | 'write', username: string }
  | { kind: 'api_token', role: 'read' | 'write' }

/**
 * 统一凭证解析（所有受保护路由共用）：
 *   Authorization: Bearer <UPLOAD_TOKEN>   → admin
 *   Authorization: Bearer sess_…           → 按会话的用户角色
 *   Authorization: Bearer blg_…            → 旧 API 子令牌
 *   Authorization: TOTP <…>                → admin（2FA 门禁负责验证）
 */
export async function resolveCredential(
  db: D1Database,
  uploadToken: string,
  authorization: string,
): Promise<Credential | null> {
  const plaintext = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!plaintext)
    return null

  if (plaintext === uploadToken)
    return { kind: 'admin' }

  if (plaintext.startsWith('sess_')) {
    const user = await userBySessionToken(db, plaintext)
    if (!user)
      return null
    if (user.role === 'admin')
      return { kind: 'admin' }
    return { kind: 'user', role: user.role === 'write' ? 'write' : 'read', username: user.username }
  }

  if (plaintext.startsWith('blg_')) {
    const token = await apiTokenByPlaintext(db, plaintext)
    if (!token)
      return null
    return { kind: 'api_token', role: token.scope }
  }

  return null
}

export { PBKDF2_ITERATIONS, SESSION_TTL_MS }
