-- D1 database for the website's feedback form.
--   npx wrangler d1 execute ahd-comments --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,          -- UTC, "YYYY-MM-DD HH:MM:SS"
  kind TEXT NOT NULL,                -- suggestion | problem | thanks
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ar',
  country TEXT NOT NULL DEFAULT '',  -- two-letter code from Cloudflare, no address
  ip_hash TEXT NOT NULL DEFAULT ''   -- salted hash, only for the per-hour limit
);
CREATE INDEX IF NOT EXISTS comments_ip_time ON comments (ip_hash, created_at);
