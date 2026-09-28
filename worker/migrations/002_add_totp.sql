-- 002: TOTP 二步验证（谷歌身份验证器）
-- 每个管理账号一行；secret 为 base32（认证 App 扫码用）。
-- confirmed=0 表示绑定流程进行中（扫码后输入验证码确认才启用）。
-- last_used_step 防止同一个 30 秒验证码被重放。
--
-- Run:
--   npx wrangler d1 execute blog --remote --file=migrations/002_add_totp.sql

CREATE TABLE IF NOT EXISTS totp_secrets (
  account        TEXT PRIMARY KEY,   -- 登录账号（当前固定 'lws666'）
  secret         TEXT NOT NULL,      -- base32 TOTP 密钥
  confirmed      INTEGER NOT NULL DEFAULT 0,
  last_used_step INTEGER NOT NULL DEFAULT 0
);
