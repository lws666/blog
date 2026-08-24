-- Migration: add AI summary cache column to posts
--
-- Additive and idempotent-by-intent: ALTER TABLE ADD COLUMN does not touch
-- existing rows (they get the '' default), so this is safe to run on the
-- live database. SQLite has no "ADD COLUMN IF NOT EXISTS" — if the column
-- already exists the statement errors out harmlessly and can be ignored.
--
-- Run:
--   npx wrangler d1 execute blog --remote --file=migrations/001_add_summary.sql

ALTER TABLE posts ADD COLUMN summary TEXT DEFAULT '';
