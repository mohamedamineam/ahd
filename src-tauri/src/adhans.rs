//! Adhan sounds: the five bundled recordings (resources/adhan/adhan.json) and the user's own imports
//! (copied into <app data>/adhan/, validated by magic bytes, never referenced from the original path).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub const MAX_IMPORT_BYTES: u64 = 30 * 1024 * 1024;

#[derive(Debug, Clone, Deserialize)]
struct BuiltinEntry {
    id: String,
    name_ar: String,
    name_en: String,
    muezzin: String,
    #[serde(default)]
    muezzin_ar: Option<String>,
    file: String,
    is_fajr: bool,
    duration_s: f64,
    short_end_s: Option<f64>,
    source_url: String,
    license: String,
}

#[derive(Debug, Deserialize)]
struct BuiltinFile {
    adhans: Vec<BuiltinEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomEntry {
    id: String,
    name: String,
    file: String,
    is_fajr: bool,
    duration_s: f64,
    short_end_s: Option<f64>,
    imported_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdhanSound {
    pub id: String,
    pub builtin: bool,
    pub name_ar: String,
    pub name_en: String,
    pub muezzin: String,
    pub muezzin_ar: Option<String>,
    pub is_fajr: bool,
    pub duration_s: f64,
    pub short_end_s: Option<f64>,
    pub url: String,
    pub license: String,
    pub source_url: String,
}

pub struct Adhans {
    builtin_dir: PathBuf,
    custom_dir: PathBuf,
}

impl Adhans {
    pub fn new(builtin_dir: PathBuf, data_dir: &Path) -> Self {
        let custom_dir = data_dir.join("adhan");
        let _ = fs::create_dir_all(&custom_dir);
        Self { builtin_dir, custom_dir }
    }

    fn builtins(&self) -> Vec<BuiltinEntry> {
        fs::read_to_string(self.builtin_dir.join("adhan.json"))
            .ok()
            .and_then(|s| serde_json::from_str::<BuiltinFile>(&s).ok())
            .map(|f| f.adhans)
            .unwrap_or_default()
    }

    fn customs(&self) -> Vec<CustomEntry> {
        fs::read_to_string(self.custom_dir.join("custom.json"))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    fn save_customs(&self, list: &[CustomEntry]) -> Result<(), String> {
        let json = serde_json::to_string_pretty(list).map_err(|e| e.to_string())?;
        fs::write(self.custom_dir.join("custom.json"), json).map_err(|e| e.to_string())
    }

    /// User-edited "short version ends at" values for built-in sounds.
    fn overrides(&self) -> HashMap<String, f64> {
        fs::read_to_string(self.custom_dir.join("overrides.json"))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn list(&self) -> Vec<AdhanSound> {
        let ov = self.overrides();
        let mut out: Vec<AdhanSound> = self
            .builtins()
            .into_iter()
            .map(|b| {
                let id = format!("builtin:{}", b.id);
                AdhanSound {
                    short_end_s: ov.get(&id).copied().or(b.short_end_s),
                    id,
                    builtin: true,
                    name_ar: b.name_ar,
                    name_en: b.name_en,
                    muezzin: b.muezzin,
                    muezzin_ar: b.muezzin_ar,
                    is_fajr: b.is_fajr,
                    duration_s: b.duration_s,
                    url: String::new(),
                    license: b.license,
                    source_url: b.source_url,
                }
            })
            .collect();
        out.extend(self.customs().into_iter().map(|c| AdhanSound {
            id: format!("custom:{}", c.id),
            builtin: false,
            name_ar: c.name.clone(),
            name_en: c.name,
            muezzin: String::new(),
            muezzin_ar: None,
            is_fajr: c.is_fajr,
            duration_s: c.duration_s,
            short_end_s: c.short_end_s,
            url: String::new(),
            license: "user file".into(),
            source_url: String::new(),
        }));
        out
    }

    /// File path for a sound id (falls back to the first built-in if the id is unknown).
    pub fn resolve(&self, id: &str) -> Option<(PathBuf, AdhanSound)> {
        let list = self.list();
        let sound = list.iter().find(|s| s.id == id).or_else(|| list.first())?.clone();
        let path = if let Some(bid) = sound.id.strip_prefix("builtin:") {
            let entry = self.builtins().into_iter().find(|b| b.id == bid)?;
            self.builtin_dir.join(entry.file)
        } else {
            let cid = sound.id.strip_prefix("custom:")?;
            let entry = self.customs().into_iter().find(|c| c.id == cid)?;
            self.custom_dir.join(entry.file)
        };
        Some((path, sound))
    }

    pub fn import(&self, src: &Path, name: &str, is_fajr: bool) -> Result<AdhanSound, String> {
        let meta = fs::metadata(src).map_err(|e| e.to_string())?;
        if meta.len() > MAX_IMPORT_BYTES {
            return Err("too_large".into());
        }
        let bytes = fs::read(src).map_err(|e| e.to_string())?;
        let ext = sniff_audio(&bytes).ok_or_else(|| "not_audio".to_string())?;
        let id = format!("{:x}", now_nanos());
        let file = format!("{id}.{ext}");
        let dest = self.custom_dir.join(&file);
        fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
        let analysis = match crate::audio::analyze(&dest) {
            Ok(a) => a,
            Err(e) => {
                let _ = fs::remove_file(&dest);
                return Err(e);
            }
        };
        let entry = CustomEntry {
            id: id.clone(),
            name: name.chars().take(80).collect(),
            file,
            is_fajr,
            duration_s: (analysis.duration * 100.0).round() / 100.0,
            short_end_s: analysis.short_end.map(|s| (s * 10.0).round() / 10.0),
            imported_at: (now_nanos() / 1_000_000) as i64,
        };
        let mut list = self.customs();
        list.push(entry);
        self.save_customs(&list)?;
        self.list().into_iter().find(|s| s.id == format!("custom:{id}")).ok_or_else(|| "import failed".into())
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let cid = id.strip_prefix("custom:").ok_or("built-in sounds cannot be deleted")?;
        let mut list = self.customs();
        if let Some(pos) = list.iter().position(|c| c.id == cid) {
            let e = list.remove(pos);
            let _ = fs::remove_file(self.custom_dir.join(e.file));
            self.save_customs(&list)?;
        }
        Ok(())
    }

    pub fn update(&self, id: &str, name: Option<String>, short_end: Option<f64>) -> Result<AdhanSound, String> {
        if id.starts_with("builtin:") {
            let mut ov = self.overrides();
            match short_end {
                Some(v) => ov.insert(id.to_string(), v),
                None => ov.remove(id),
            };
            fs::write(self.custom_dir.join("overrides.json"), serde_json::to_string(&ov).unwrap_or_default()).map_err(|e| e.to_string())?;
        } else {
            let cid = id.strip_prefix("custom:").ok_or("unknown sound")?;
            let mut list = self.customs();
            let e = list.iter_mut().find(|c| c.id == cid).ok_or("unknown sound")?;
            if let Some(n) = name {
                e.name = n.chars().take(80).collect();
            }
            e.short_end_s = short_end;
            self.save_customs(&list)?;
        }
        self.list().into_iter().find(|s| s.id == id).ok_or_else(|| "unknown sound".into())
    }
}

fn now_nanos() -> u128 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0)
}

/// Identify the audio container by its magic bytes (not the file extension).
pub fn sniff_audio(bytes: &[u8]) -> Option<&'static str> {
    let kind = infer::get(bytes)?;
    match kind.mime_type() {
        "audio/mpeg" => Some("mp3"),
        "audio/ogg" | "application/ogg" => Some("ogg"),
        "audio/x-flac" | "audio/flac" => Some("flac"),
        "audio/x-wav" | "audio/wav" => Some("wav"),
        "audio/m4a" | "audio/mp4" | "video/mp4" | "audio/x-m4a" => Some("m4a"),
        "audio/aac" => Some("aac"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sniffs_by_content_not_extension() {
        let mp3 = std::fs::read(Path::new(env!("CARGO_MANIFEST_DIR")).join("../assets/adhan/nasser-alqatami.mp3")).unwrap();
        assert_eq!(sniff_audio(&mp3), Some("mp3"));
        assert_eq!(sniff_audio(b"%PDF-1.7 not audio"), None);
    }

    #[test]
    fn bundled_catalogue_is_complete() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../assets/adhan");
        let tmp = std::env::temp_dir().join(format!("ahd-test-{}", now_nanos()));
        let a = Adhans::new(dir.clone(), &tmp);
        let list = a.list();
        assert_eq!(list.len(), 5);
        assert_eq!(list.iter().filter(|s| s.is_fajr).count(), 2);
        for s in &list {
            let (path, _) = a.resolve(&s.id).unwrap();
            assert!(path.exists(), "{}", path.display());
        }
        let _ = fs::remove_dir_all(tmp);
    }
}
