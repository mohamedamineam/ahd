//! Library downloads (brief §17): on demand, HTTPS only, allow-listed hosts, size-limited, sha256 recorded,
//! stored in <app data>/library/. Books are never bundled.

use futures_util::StreamExt;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::io::AsyncWriteExt;

const ALLOWED_PREFIXES: &[&str] = &["https://d1.islamhouse.com/", "https://upload.wikimedia.org/", "https://archive.org/download/"];
/// Hosts a download may be redirected to (archive.org serves files from its ia*.us.archive.org storage nodes).
const REDIRECT_HOSTS: &[&str] = &["d1.islamhouse.com", "upload.wikimedia.org", "archive.org"];

fn redirect_allowed(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && url.host_str().is_some_and(|h| REDIRECT_HOSTS.iter().any(|a| h == *a || h.ends_with(&format!(".{a}"))))
}
const MAX_BYTES: u64 = 400 * 1024 * 1024;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    id: String,
    received: u64,
    total: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Downloaded {
    pub path: String,
    pub size: u64,
    pub sha256: String,
}

pub fn dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?.join("library");
    std::fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

fn safe_id(id: &str) -> Result<&str, String> {
    if !id.is_empty() && id.len() < 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        Ok(id)
    } else {
        Err("invalid id".into())
    }
}

pub async fn download<R: Runtime>(app: &AppHandle<R>, id: &str, url: &str, format: &str) -> Result<Downloaded, String> {
    let id = safe_id(id)?;
    if !ALLOWED_PREFIXES.iter().any(|p| url.starts_with(p)) {
        return Err("download source not allowed".into());
    }
    let ext = if format == "epub" { "epub" } else { "pdf" };
    let dest = dir(app)?.join(format!("{id}.{ext}"));
    let tmp = dest.with_extension(format!("{ext}.part"));
    let client = reqwest::Client::builder()
        .user_agent(format!("3ahd/{} (https://github.com/mohamedamineam/ahd)", app.package_info().version))
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() > 5 {
                attempt.error("too many redirects")
            } else if redirect_allowed(attempt.url()) {
                attempt.follow()
            } else {
                attempt.error("redirect to a host that is not allowed")
            }
        }))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let total = resp.content_length();
    if total.is_some_and(|t| t > MAX_BYTES) {
        return Err("file too large".into());
    }
    let mut file = tokio::fs::File::create(&tmp).await.map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut last_emit = 0u64;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        received += chunk.len() as u64;
        if received > MAX_BYTES {
            let _ = tokio::fs::remove_file(&tmp).await;
            return Err("file too large".into());
        }
        hasher.update(&chunk);
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        if received - last_emit > 256 * 1024 {
            last_emit = received;
            let _ = app.emit("ahd://library-progress", Progress { id: id.to_string(), received, total });
        }
    }
    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);
    if total.is_some_and(|t| t != received) {
        let _ = tokio::fs::remove_file(&tmp).await;
        return Err("incomplete download".into());
    }
    // magic bytes: %PDF or ZIP (EPUB)
    let head = std::fs::read(&tmp).map(|b| b.into_iter().take(4).collect::<Vec<u8>>()).unwrap_or_default();
    let ok = if ext == "pdf" { head.starts_with(b"%PDF") } else { head.starts_with(b"PK") };
    if !ok {
        let _ = tokio::fs::remove_file(&tmp).await;
        return Err("unexpected file type".into());
    }
    tokio::fs::rename(&tmp, &dest).await.map_err(|e| e.to_string())?;
    let _ = app.emit("ahd://library-progress", Progress { id: id.to_string(), received, total: Some(received) });
    Ok(Downloaded { path: dest.to_string_lossy().to_string(), size: received, sha256: hex::encode(hasher.finalize()) })
}

pub fn delete<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<(), String> {
    let id = safe_id(id)?;
    let d = dir(app)?;
    for ext in ["pdf", "epub", "pdf.part", "epub.part"] {
        let _ = std::fs::remove_file(d.join(format!("{id}.{ext}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::redirect_allowed;

    #[test]
    fn redirects_stay_on_trusted_hosts() {
        let ok = |u: &str| redirect_allowed(&reqwest::Url::parse(u).unwrap());
        assert!(ok("https://ia800302.us.archive.org/12/items/x/x.pdf"));
        assert!(ok("https://archive.org/download/x/x.pdf"));
        assert!(ok("https://d1.islamhouse.com/data/ar/x.pdf"));
        assert!(!ok("http://ia800302.us.archive.org/x.pdf"));
        assert!(!ok("https://evilarchive.org/x.pdf"));
        assert!(!ok("https://archive.org.evil.com/x.pdf"));
    }
}
