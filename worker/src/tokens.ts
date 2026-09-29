import type { TokenRow } from './routes/tokens'

/**
 * 令牌鉴权层：识别「管理员令牌」与「API 子令牌」。
 *
 * - 管理员（UPLOAD_TOKEN 本尊）：is_admin=true，一切权限（2FA 语义照旧）
 * - 子令牌 blg_…：is_admin=false，scope 'read'/'write'
 *
 * 返回 null 表示无法识别（调用方回 401）。
 */
export async function resolveToken(
  db: D1Database,
  uploadToken: string,
  plaintext: string,
): Promise<{ is_admin: boolean, scope: 'admin' | 'read' | 'write', row: TokenRow | null } | null> {
  if (plaintext === uploadToken)
    return { is_admin: true, scope: 'admin', row: null }
  if (plaintext.startsWith('blg_')) {
    const hash = await sha256Hex(plaintext)
    const row = await db.prepare(
      'SELECT id, token_hash, name, scope, created_at, last_used_at, revoked FROM api_tokens WHERE token_hash = ? AND revoked = 0',
    ).bind(hash).first() as unknown as TokenRow | null
    if (!row)
      return null
    // touch last_used_at（fire-and-forget，不阻塞响应）
    db.prepare('UPDATE api_tokens SET last_used_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), row.id).run()
    return { is_admin: false, scope: row.scope === 'write' ? 'write' : 'read', row }
  }
  return null
}

async function sha256Hex(input: string): Promise<string> {
  const mac = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
}
