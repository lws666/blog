import { Hono } from 'hono'
import { success, badRequest, notFound } from '../utils/response'
import { hashPassword, resolveCredential } from '../auth'
import type { Env } from '../index'

/**
 * 子用户管理（仅管理员）。
 *
 * POST   /api/admin/users            — 创建子用户 { username, password, role: 'read'|'write' }
 * GET    /api/admin/users            — 列出全部用户
 * PUT    /api/admin/users/:username  — 改密码/角色/禁用 { password?, role?, disabled? }
 * DELETE /api/admin/users/:username  — 删除用户（连带其全部会话）
 *
 * 规则：
 * - username 仅小写字母数字下划线，3~24 位；角色只有 read/write
 *   （admin 只有一个，即种子账号，不可创建第二个 admin）
 * - 不允许删除/禁用 admin 自己
 * - 删除/禁用/改密码会作废该用户全部会话
 * - 独立路由（不在 admin.ts 的中间件链内），因此自行解析凭证；
 *   管理员可用 UPLOAD_TOKEN 或 admin 角色的 sess_ 会话
 */
export function createUsersRouter() {
  const router = new Hono<{ Bindings: Env, Variables: { auth: { is_admin: boolean, scope: string } } }>()

  // 守卫 helper：Hono 子 app 里 use('/users*') 不命中（嵌套路径匹配
  // 限制），所以每个 handler 第一行显式调用
  const guard = async (c: any): Promise<Response | null> => {
    const authHeader = c.req.header('Authorization') || ''
    const cred = await resolveCredential(c.env.DB, c.env.UPLOAD_TOKEN, authHeader)
    const isAdmin = cred?.kind === 'admin'
    if (!isAdmin)
      return c.json({ success: false, error: '仅管理员可管理用户' }, 403)
    return null
  }

  function validUsername(name: string): boolean {
    return /^[a-z0-9_]{3,24}$/.test(name)
  }

  // ── GET /users ───────────────────────────────────────────────
  router.get('/users', async (c) => {
    const denied = await guard(c); if (denied) return denied
    const { results } = await c.env.DB.prepare(
      `SELECT u.id, u.username, u.role, u.disabled, u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS active_sessions
       FROM users u ORDER BY u.id ASC`,
    ).all()
    return success({ users: results })
  })

  // ── POST /users ──────────────────────────────────────────────
  router.post('/users', async (c) => {
    const denied = await guard(c); if (denied) return denied
    const body = await c.req.json<{ username?: string, password?: string, role?: string }>()
    const username = (body.username || '').trim().toLowerCase()
    const password = body.password || ''
    const role = body.role === 'write' ? 'write' : 'read'

    if (!validUsername(username))
      return badRequest('用户名需为 3~24 位小写字母/数字/下划线')
    if (password.length < 8)
      return badRequest('密码至少 8 位')
    if (username === 'admin')
      return badRequest('admin 是内置管理员，不能重复创建')

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
      .bind(username).first()
    if (existing)
      return badRequest('用户名已存在')

    const hash = await hashPassword(password)
    const res = await c.env.DB.prepare(
      'INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
    ).bind(username, hash, role, new Date().toISOString()).run()

    return success({
      id: res.meta?.last_row_id,
      username,
      role,
    }, 201)
  })

  // ── PUT /users/:username ─────────────────────────────────────
  router.put('/users/:username', async (c) => {
    const denied = await guard(c); if (denied) return denied
    const target = c.req.param('username')
    if (target === 'admin')
      return badRequest('admin 请用专门的流程管理（暂不支持在线改）')
    const body = await c.req.json<{ password?: string, role?: string, disabled?: boolean }>()

    const user = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
      .bind(target).first<{ id: number }>()
    if (!user)
      return notFound('User not found')

    if (body.password !== undefined) {
      if (body.password.length < 8)
        return badRequest('密码至少 8 位')
      const hash = await hashPassword(body.password)
      await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .bind(hash, user.id).run()
      // 改密码后作废其全部会话
      await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run()
    }
    if (body.role !== undefined) {
      if (body.role !== 'read' && body.role !== 'write')
        return badRequest('role 只能是 read 或 write')
      await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?')
        .bind(body.role, user.id).run()
    }
    if (body.disabled !== undefined) {
      await c.env.DB.prepare('UPDATE users SET disabled = ? WHERE id = ?')
        .bind(body.disabled ? 1 : 0, user.id).run()
      if (body.disabled)
        await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run()
    }

    return success({ updated: true, username: target })
  })

  // ── DELETE /users/:username ──────────────────────────────────
  router.delete('/users/:username', async (c) => {
    const denied = await guard(c); if (denied) return denied
    const target = c.req.param('username')
    if (target === 'admin')
      return badRequest('不能删除内置管理员')
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
      .bind(target).first<{ id: number }>()
    if (!user)
      return notFound('User not found')
    await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id).run()
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run()
    return success({ deleted: true, username: target })
  })

  return router
}
