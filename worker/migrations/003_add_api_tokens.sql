-- 003: 可签发的 API 子令牌（只读 / 读写）
-- 管理员（UPLOAD_TOKEN 本尊）可通过 /api/admin/tokens 签发/吊销。
-- 库里只存 SHA-256 哈希，明文只在创建响应里出现一次。
-- scope: 'read' = 只读（GET），'write' = 读写（含写操作，不要求 2FA）
--
-- Run:
--   npx wrangler d1 execute blog --remote --file=migrations/003_add_api_tokens.sql

CREATE TABLE IF NOT EXISTS api_tokens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash    TEXT UNIQUE NOT NULL,   -- SHA-256 hex of "blg_…"
  name          TEXT NOT NULL DEFAULT '',
  scope         TEXT NOT NULL DEFAULT 'read',
  created_at    TEXT NOT NULL,
  last_used_at  TEXT NOT NULL DEFAULT '',
  revoked       INTEGER NOT NULL DEFAULT 0
);
