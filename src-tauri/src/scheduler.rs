//! Wall-clock scheduler (brief §10.1). One task for the whole app:
//! - wakes at every second boundary, or exactly at the next due event if that is sooner;
//! - compares the wall clock (not a monotonic sleep), so suspend/resume and manual clock changes are seen;
//! - a jump > 5 s triggers re-evaluation: events missed by ≤ the grace period still play, later ones get a
//!   single quiet "Asr time started 12 minutes ago" notification;
//! - emits one `ahd://tick` per second for every window (no per-window timers).

use crate::audio::PlayRequest;
use crate::schedule::{FireEvent, SchedulePayload};
use crate::state::AppState;
use serde::Serialize;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Wry};

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[derive(Serialize, Clone)]
struct Tick {
    now: i64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdhanFired {
    key: String,
    prayer: Option<String>,
    at: i64,
    mode: String,
    missed: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ToastPayload {
    pub prayer: String,
    pub prayer_label: String,
    pub at: i64,
    pub title: String,
    pub body: String,
    pub location: String,
    pub time_text: String,
    pub auto_hide_seconds: f64,
    pub audible: bool,
}

pub async fn run(app: AppHandle<Wry>) {
    let mut last = now_ms();
    loop {
        let now = now_ms();
        let to_second = 1000 - now.rem_euclid(1000) + 2;
        let to_event = next_due(&app, now).map(|at| (at - now).max(1));
        let delay = to_event.map_or(to_second, |e| e.min(to_second));
        tokio::time::sleep(Duration::from_millis(delay as u64)).await;

        let now = now_ms();
        let jumped = (now - last).abs() > 5_000;
        if jumped {
            log::info!("clock jump detected ({} ms)", now - last);
        }
        last = now;

        if now.rem_euclid(1000) < 60 || jumped {
            let _ = app.emit("ahd://tick", Tick { now });
        }
        let state = app.state::<AppState>();
        let schedule = state.schedule.read().ok().and_then(|g| g.clone());
        if let Some(s) = schedule {
            fire_due(&app, &state, &s, now, jumped);
            crate::tray::update(&app, &state, &s, now);
        }
    }
}

fn next_due(app: &AppHandle<Wry>, now: i64) -> Option<i64> {
    let state = app.state::<AppState>();
    let s = state.schedule.read().ok()?.clone()?;
    let fired = state.fired.lock().ok()?;
    s.fire.iter().filter(|e| e.at > now && !fired.contains(&e.key)).map(|e| e.at).min()
}

/// New schedule from the main window. Events already in the past are marked handled, except — on the very
/// first schedule after start-up — those still inside the grace period, which then play normally.
pub fn set_schedule(app: &AppHandle<Wry>, payload: SchedulePayload) {
    let state = app.state::<AppState>();
    let now = now_ms();
    let first = !state.initialized.swap(true, Ordering::SeqCst);
    let grace = (payload.missed_grace_minutes * 60_000.0) as i64;
    if let Ok(mut fired) = state.fired.lock() {
        for e in &payload.fire {
            let limit = if first { now - grace } else { now - 1_500 };
            if e.at < limit {
                fired.insert(e.key.clone());
            }
        }
        // forget keys that no longer exist (bounded memory)
        let keys: std::collections::HashSet<&String> = payload.fire.iter().map(|e| &e.key).collect();
        fired.retain(|k| keys.contains(k) || k.starts_with("test:"));
    }
    if let Ok(mut s) = state.schedule.write() {
        *s = Some(Arc::new(payload));
    }
    let snapshot = state.schedule.read().ok().and_then(|g| g.clone());
    if let Some(s) = snapshot {
        let _ = app.emit("ahd://schedule", &*s);
        crate::tray::update(app, &state, &s, now);
    }
}

fn fire_due(app: &AppHandle<Wry>, state: &AppState, s: &SchedulePayload, now: i64, jumped: bool) {
    let grace = ((s.missed_grace_minutes * 60_000.0) as i64).max(2_500);
    let mut due: Vec<&FireEvent> = Vec::new();
    if let Ok(fired) = state.fired.lock() {
        due = s.fire.iter().filter(|e| e.at <= now && !fired.contains(&e.key)).collect();
    }
    if due.is_empty() {
        return;
    }
    let mut missed_adhan: Option<&FireEvent> = None;
    for e in &due {
        let late = now - e.at;
        if late <= grace || !jumped && late <= 60_000 {
            fire(app, state, s, e, false);
        } else if e.kind == "adhan" && late < 6 * 3_600_000 && missed_adhan.is_none_or(|m| m.at < e.at) {
            missed_adhan = Some(e);
        }
    }
    if let Ok(mut fired) = state.fired.lock() {
        for e in &due {
            fired.insert(e.key.clone());
        }
    }
    if let Some(e) = missed_adhan {
        let label = e
            .prayer
            .as_ref()
            .and_then(|p| s.labels.get(p))
            .cloned()
            .unwrap_or_default();
        let ago = s.minutes_phrase((now - e.at) / 60_000);
        let title = s.string("missedTitle").replace("{prayer}", &label);
        let body = s.string("missedBody").replace("{prayer}", &label).replace("{ago}", &ago);
        crate::notify::show(app, &title, &body, None, state.notification_icon.as_deref());
        let _ = app.emit_to(
            "main",
            "ahd://adhan",
            AdhanFired { key: e.key.clone(), prayer: e.prayer.clone(), at: e.at, mode: "missed".into(), missed: true },
        );
    }
}

/// Fire one event now: sound (unless muted by full-screen / DND settings), notification, toast.
pub fn fire(app: &AppHandle<Wry>, state: &AppState, s: &SchedulePayload, e: &FireEvent, missed: bool) {
    let cfg = state.config.read().map(|c| c.clone()).unwrap_or_default();
    let muted = (cfg.mute_fullscreen && crate::platform::fullscreen_app_active()) || (cfg.respect_dnd && crate::platform::do_not_disturb_active());
    let mut audible = false;
    if let Some(a) = &e.audio {
        if !muted {
            if a.kind == "tone" || a.sound == "tone" {
                state.audio.play(PlayRequest {
                    path: None,
                    volume: a.volume,
                    fade_in: false,
                    stop_at: None,
                    kind: "tone",
                    prayer: e.prayer.clone(),
                    sound: None,
                    duration: Some(1.9),
                });
            } else if let Some((path, sound)) = state.adhans.resolve(&a.sound) {
                audible = true;
                state.audio.play(PlayRequest {
                    path: Some(path),
                    volume: a.volume,
                    fade_in: a.fade_in,
                    stop_at: a.stop_at,
                    kind: "adhan",
                    prayer: e.prayer.clone(),
                    sound: Some(sound.id.clone()),
                    duration: Some(a.stop_at.unwrap_or(sound.duration_s)),
                });
            }
        }
    }
    if let Some(n) = &e.notification {
        crate::notify::show(app, &n.title, &n.body, e.route.clone(), state.notification_icon.as_deref());
    }
    if e.toast {
        let label = e.prayer.as_ref().and_then(|p| s.labels.get(p)).cloned().unwrap_or_default();
        let time_text = s.timeline.iter().find(|t| t.at == e.at).map(|t| t.time_text.clone()).unwrap_or_default();
        let payload = ToastPayload {
            prayer: e.prayer.clone().unwrap_or_default(),
            prayer_label: label,
            at: e.at,
            title: e.notification.as_ref().map(|n| n.title.clone()).unwrap_or_default(),
            body: e.notification.as_ref().map(|n| n.body.clone()).unwrap_or_default(),
            location: s.location.clone(),
            time_text,
            auto_hide_seconds: s.toast_auto_hide_seconds,
            audible,
        };
        crate::windows::show_toast(app, &cfg, &payload);
    }
    if e.kind == "adhan" {
        let _ = app.emit(
            "ahd://adhan",
            AdhanFired { key: e.key.clone(), prayer: e.prayer.clone(), at: e.at, mode: e.audio.as_ref().map(|a| a.kind.clone()).unwrap_or_else(|| "silent".into()), missed },
        );
    }
}
