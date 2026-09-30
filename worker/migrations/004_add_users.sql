-- 004: 用户名 + 密码认证（替代/兼容令牌体系）
-- - admin / BlogUpload_lws666 为种子管理员（PBKDF2-SHA256, 10 万次迭代）
-- - 管理员可创建子用户（role: 'read' | 'write'），并禁用/重置/删除
-- - 登录签发 sess_… 会话令牌（SHA-256 哈希入库，7 天滑动过期）
-- - 兼容：UPLOAD_TOKEN 本尊与 blg_… 子令牌继续有效
--
-- Run:
--   npx wrangler d1 execute blog --remote --file=migrations/004_add_users.sql

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- pbkdf2$<iter>$<b64salt>$<b64hash>
  role          TEXT NOT NULL DEFAULT 'read',  -- 'admin' | 'write' | 'read'
  totp_enabled  INTEGER NOT NULL DEFAULT 0,   -- 管理员 2FA 开关（自选）
  disabled      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  last_login_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,         -- SHA-256 hex of "sess_…"
  user_id     INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
