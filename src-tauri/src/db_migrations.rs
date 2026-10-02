//! User data schema (brief §19) for tauri-plugin-sql. Bundled datasets live in separate read-only files.

use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_URL: &str = "sqlite:ahd.db";

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
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
        },
        // ten Quran bookmarks instead of five: SQLite cannot change a CHECK constraint, so the table is rebuilt
        // with its rows (never edit an applied migration: the plugin checks them by checksum)
        Migration {
            version: 2,
            description: "ten quran bookmarks",
            kind: MigrationKind::Up,
            sql: r#"
CREATE TABLE quran_bookmarks_v2 (
  slot INTEGER PRIMARY KEY CHECK (slot BETWEEN 1 AND 10),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  riwaya TEXT NOT NULL,
  page INTEGER NOT NULL,
  surah INTEGER NOT NULL,
  ayah INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
INSERT INTO quran_bookmarks_v2 (slot, name, color, riwaya, page, surah, ayah, created_at)
  SELECT slot, name, color, riwaya, page, surah, ayah, created_at FROM quran_bookmarks;
DROP TABLE quran_bookmarks;
ALTER TABLE quran_bookmarks_v2 RENAME TO quran_bookmarks;
"#,
        },
    ]
}

#[cfg(test)]
mod tests {
    use sqlx::migrate::{Migration as SqlxMigration, MigrationType, Migrator};
    use sqlx::{Connection, Row, SqliteConnection};
    use std::borrow::Cow;

    /// The migrations up to `version`, handed to sqlx as tauri-plugin-sql does.
    fn migrator(version: i64) -> Migrator {
        let migrations = super::migrations()
            .into_iter()
            .filter(|m| m.version <= version)
            .map(|m| SqlxMigration::new(m.version, m.description.into(), MigrationType::ReversibleUp, m.sql.into(), false))
            .collect::<Vec<_>>();
        Migrator { migrations: Cow::Owned(migrations), ignore_missing: false, locking: true, no_tx: false }
    }

    async fn bookmark(db: &mut SqliteConnection, slot: i64) -> Result<(), sqlx::Error> {
        sqlx::query("INSERT INTO quran_bookmarks VALUES ($1, 'name', '#6F8A74', 'hafs', 42, 2, 255, 0)").bind(slot).execute(db).await.map(|_| ())
    }

    #[tokio::test]
    async fn ten_bookmarks_keep_the_ones_already_saved() {
        let mut db = SqliteConnection::connect("sqlite::memory:").await.unwrap();
        // the database of an earlier version, with three bookmarks
        migrator(1).run(&mut db).await.unwrap();
        for slot in [1, 3, 5] {
            bookmark(&mut db, slot).await.unwrap();
        }
        assert!(bookmark(&mut db, 6).await.is_err());
        // this version starts: only the new migration runs
        migrator(2).run(&mut db).await.unwrap();
        let slots: Vec<i64> = sqlx::query("SELECT slot FROM quran_bookmarks ORDER BY slot").fetch_all(&mut db).await.unwrap().iter().map(|r| r.get(0)).collect();
        assert_eq!(slots, [1, 3, 5]);
        for slot in 6..=10 {
            bookmark(&mut db, slot).await.unwrap();
        }
        assert!(bookmark(&mut db, 11).await.is_err());
        assert!(bookmark(&mut db, 0).await.is_err());
        // and the next start changes nothing
        migrator(2).run(&mut db).await.unwrap();
        let count: i64 = sqlx::query("SELECT COUNT(*) FROM quran_bookmarks").fetch_one(&mut db).await.unwrap().get(0);
        assert_eq!(count, 8);
    }
}
