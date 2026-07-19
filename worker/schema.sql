-- D1 Database Schema for Valaxy Dynamic Blog
-- Run: wrangler d1 execute blog-db --file=schema.sql

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT UNIQUE NOT NULL,
  title      TEXT NOT NULL DEFAULT '',       -- JSON: 支持 i18n (e.g. {"zh-CN":"标题","en":"Title"})
  date       TEXT NOT NULL,                  -- ISO 8601
  updated    TEXT DEFAULT '',                -- ISO 8601
  tags       TEXT DEFAULT '[]',              -- JSON array  ["tag1","tag2"]
  categories TEXT DEFAULT '[]',              -- JSON array  ["cat1","cat2"]
  excerpt    TEXT DEFAULT '',
  cover      TEXT DEFAULT '',
  type       TEXT DEFAULT 'post',            -- 卡片类型 (post/bilibili/yuque/...)
  top        INTEGER DEFAULT 0,              -- 置顶优先级, 越大越靠前
  draft      INTEGER DEFAULT 0,              -- 0=发布 1=草稿
  hide       TEXT DEFAULT '',                -- 隐藏: ''/index/all
  password   TEXT DEFAULT '',                -- 加密密码
  encrypt    INTEGER DEFAULT 0,              -- 0=不加密 1=加密
  comment    INTEGER DEFAULT 1,              -- 0=关闭评论 1=开启
  toc        INTEGER DEFAULT 1,              -- 0=隐藏目录 1=显示
  nav        INTEGER DEFAULT 1,              -- 0=隐藏前后导航 1=显示
  pinned     INTEGER DEFAULT 0,              -- 0=不固定 1=固定（旧版 top 替代）

  -- 存储
  b2_key     TEXT NOT NULL DEFAULT '',       -- B2 对象键: posts/{slug}/index.md
  content    TEXT DEFAULT NULL,              -- Markdown 原文（迁移兼容，后续可移除）

  -- 额外前体字段兜底
  frontmatter TEXT DEFAULT '{}',             -- JSON: 未被独立列覆盖的任意前体字段

  -- 时间戳
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_top  ON posts(top DESC);
CREATE INDEX IF NOT EXISTS idx_posts_draft_date ON posts(draft, date DESC);

-- 上传文件记录表（可选，用于管理已上传的 B2 资源）
CREATE TABLE IF NOT EXISTS uploads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  b2_key     TEXT NOT NULL,                  -- B2 对象键
  filename   TEXT NOT NULL,                  -- 原始文件名
  mime_type  TEXT NOT NULL,                  -- MIME
  size       INTEGER NOT NULL,               -- bytes
  url        TEXT NOT NULL,                   -- 公开访问 URL
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_uploads_b2_key ON uploads(b2_key);
