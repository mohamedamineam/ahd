//! User data schema (brief §19) for tauri-plugin-sql. Bundled datasets live in separate read-only files.

use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_URL: &str = "sqlite:ahd.db";

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial user data",
        kind: MigrationKind::Up,
        sql: r#"
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS prayer_offsets (
  location_id TEXT NOT NULL,
  prayer TEXT NOT NULL,
  seconds INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (location_id, prayer)
);
CREATE TABLE IF NOT EXISTS official_timetable (
  location_id TEXT NOT NULL,
  date TEXT NOT NULL,
  fajr TEXT, sunrise TEXT, dhuhr TEXT, asr TEXT, maghrib TEXT, isha TEXT,
  PRIMARY KEY (location_id, date)
);
CREATE TABLE IF NOT EXISTS quran_last_read (
  riwaya TEXT PRIMARY KEY,
  page INTEGER NOT NULL,
  surah INTEGER NOT NULL,
  ayah INTEGER NOT NULL,
  scroll REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quran_bookmarks (
  slot INTEGER PRIMARY KEY CHECK (slot BETWEEN 1 AND 5),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  riwaya TEXT NOT NULL,
  page INTEGER NOT NULL,
  surah INTEGER NOT NULL,
  ayah INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS adhkar_progress (
  date TEXT NOT NULL,
  dhikr_id TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (date, dhikr_id)
);
CREATE TABLE IF NOT EXISTS library_books (
  id TEXT PRIMARY KEY,
  catalog_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  format TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  last_page INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS library_bookmarks (
  book_id TEXT NOT NULL,
  page INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (book_id, page)
);
"#,
    }]
}
