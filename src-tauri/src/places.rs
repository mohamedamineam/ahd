//! Places: offline search in the bundled GeoNames database (data/cities.sqlite, FTS5) and the optional
//! OpenStreetMap Nominatim search (explicit submit only, ≤ 1 request/s, identifying User-Agent, cached).

use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use sqlx::Row;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::sync::OnceCell;
use unicode_normalization::UnicodeNormalization;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Place {
    pub id: String,
    pub name: String,
    pub name_ar: Option<String>,
    pub admin1: Option<String>,
    pub admin1_ar: Option<String>,
    pub country: String,
    pub lat: f64,
    pub lon: f64,
    pub elevation: Option<f64>,
    pub tz: String,
    pub source: String,
}

pub struct Places {
    db_path: PathBuf,
    pool: OnceCell<Option<SqlitePool>>,
    last_online: Mutex<Option<Instant>>,
    cache: Mutex<HashMap<String, serde_json::Value>>,
    user_agent: String,
}

/// Same rules as data-pipeline/normalize.ts: lower-case, strip Latin accents and Arabic tashkeel/tatweel,
/// unify alef/ya/ta-marbuta/hamza carriers.
pub fn normalize(s: &str) -> String {
    s.nfd()
        .filter(|c| {
            let u = *c as u32;
            !((0x0300..=0x036F).contains(&u) || (0x064B..=0x065F).contains(&u) || u == 0x0670 || u == 0x0640)
        })
        .map(|c| match c {
            'أ' | 'إ' | 'آ' | 'ٱ' => 'ا',
            'ة' => 'ه',
            'ى' => 'ي',
            'ؤ' => 'و',
            'ئ' => 'ي',
            _ => c,
        })
        .collect::<String>()
        .to_lowercase()
}

fn fts_query(q: &str) -> Option<String> {
    let tokens: Vec<String> = normalize(q)
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.is_empty())
        .map(|t| format!("\"{}\"*", t.replace('"', "")))
        .collect();
    if tokens.is_empty() {
        None
    } else {
        Some(tokens.join(" "))
    }
}

impl Places {
    pub fn new(db_path: PathBuf, version: &str) -> Self {
        Self {
            db_path,
            pool: OnceCell::new(),
            last_online: Mutex::new(None),
            cache: Mutex::new(HashMap::new()),
            user_agent: format!("Ahd/{version} (https://github.com/ahdapp/ahd)"),
        }
    }

    async fn pool(&self) -> Option<&SqlitePool> {
        self.pool
            .get_or_init(|| async {
                if !self.db_path.exists() {
                    log::warn!("places database missing: {}", self.db_path.display());
                    return None;
                }
                let opts = SqliteConnectOptions::new().filename(&self.db_path).read_only(true).immutable(true);
                SqlitePoolOptions::new().max_connections(2).connect_with(opts).await.map_err(|e| log::error!("places db: {e}")).ok()
            })
            .await
            .as_ref()
    }

    fn row_to_place(r: &sqlx::sqlite::SqliteRow) -> Place {
        Place {
            id: format!("geonames:{}", r.get::<i64, _>("id")),
            name: r.get("name"),
            name_ar: r.get::<Option<String>, _>("name_ar"),
            admin1: r.get::<Option<String>, _>("admin1"),
            admin1_ar: r.get::<Option<String>, _>("admin1_ar"),
            country: r.get("country"),
            lat: r.get("lat"),
            lon: r.get("lon"),
            elevation: r.get::<Option<i64>, _>("elevation").map(|e| e as f64),
            tz: r.get("tz"),
            source: "geonames".into(),
        }
    }

    pub async fn search(&self, query: &str, limit: u32) -> Result<Vec<Place>, String> {
        let Some(pool) = self.pool().await else { return Ok(Vec::new()) };
        let Some(q) = fts_query(query) else { return Ok(Vec::new()) };
        let rows = sqlx::query(
            "SELECT p.* FROM places_fts f JOIN places p ON p.id = f.rowid WHERE places_fts MATCH ?1 ORDER BY p.population DESC LIMIT ?2",
        )
        .bind(q)
        .bind(limit.min(50) as i64)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(rows.iter().map(Self::row_to_place).collect())
    }

    pub async fn nearest(&self, lat: f64, lon: f64) -> Result<Option<Place>, String> {
        let Some(pool) = self.pool().await else { return Ok(None) };
        for span in [0.3, 1.0, 3.0] {
            let row = sqlx::query(
                "SELECT * FROM places WHERE lat BETWEEN ?1 AND ?2 AND lon BETWEEN ?3 AND ?4 \
                 ORDER BY (lat - ?5) * (lat - ?5) + (lon - ?6) * (lon - ?6) LIMIT 1",
            )
            .bind(lat - span)
            .bind(lat + span)
            .bind(lon - span)
            .bind(lon + span)
            .bind(lat)
            .bind(lon)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;
            if let Some(r) = row {
                return Ok(Some(Self::row_to_place(&r)));
            }
        }
        Ok(None)
    }

    pub async fn nominatim(&self, query: &str, lang: &str) -> Result<serde_json::Value, String> {
        let key = format!("{lang}:{}", query.trim().to_lowercase());
        if let Some(v) = self.cache.lock().ok().and_then(|c| c.get(&key).cloned()) {
            return Ok(v);
        }
        // at most one request per second (usage policy)
        let wait = self.last_online.lock().ok().and_then(|l| l.map(|t| Duration::from_millis(1100).saturating_sub(t.elapsed())));
        if let Some(w) = wait {
            tokio::time::sleep(w).await;
        }
        if let Ok(mut l) = self.last_online.lock() {
            *l = Some(Instant::now());
        }
        let client = reqwest::Client::builder().user_agent(&self.user_agent).timeout(Duration::from_secs(15)).build().map_err(|e| e.to_string())?;
        let resp = client
            .get("https://nominatim.openstreetmap.org/search")
            .query(&[("format", "jsonv2"), ("addressdetails", "1"), ("limit", "8"), ("accept-language", &format!("{lang},en")), ("q", query)])
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("nominatim {}", resp.status()));
        }
        let v: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        if let Ok(mut c) = self.cache.lock() {
            c.insert(key, v.clone());
        }
        Ok(v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_arabic_and_latin() {
        assert_eq!(normalize("Sétif"), "setif");
        assert_eq!(normalize("سَطِيف"), "سطيف");
        assert_eq!(normalize("إسطنبول"), "اسطنبول");
        assert_eq!(normalize("المدينة المنوّرة"), "المدينه المنوره");
    }

    #[test]
    fn builds_prefix_queries() {
        assert_eq!(fts_query("sid bel").as_deref(), Some("\"sid\"* \"bel\"*"));
        assert_eq!(fts_query("  "), None);
    }
}
