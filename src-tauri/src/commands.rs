//! Commands exposed to the webviews. Access is limited per window by capabilities/*.json.

use crate::adhans::AdhanSound;
use crate::audio::{AudioState, PlayRequest};
use crate::places::Place;
use crate::schedule::{FireAudio, FireEvent, FireNotification, SchedulePayload};
use crate::scheduler;
use crate::state::AppState;
use crate::windows::{self, WindowsConfig};
use std::path::PathBuf;
use std::str::FromStr;
use tauri::{AppHandle, Manager, State, WebviewWindow, Wry};

type Res<T> = Result<T, String>;

#[tauri::command]
pub fn set_schedule(app: AppHandle<Wry>, payload: SchedulePayload) {
    scheduler::set_schedule(&app, payload);
}

#[tauri::command]
pub fn get_schedule(state: State<'_, AppState>) -> Option<SchedulePayload> {
    state.schedule.read().ok().and_then(|g| g.as_ref().map(|s| (**s).clone()))
}

#[tauri::command]
pub fn stop_adhan(state: State<'_, AppState>) {
    state.audio.stop();
}

#[tauri::command]
pub fn audio_state(state: State<'_, AppState>) -> AudioState {
    state.audio.state()
}

#[tauri::command]
pub fn play_preview(state: State<'_, AppState>, sound: String, volume: f32) -> Res<()> {
    let (path, s) = state.adhans.resolve(&sound).ok_or("unknown sound")?;
    state.audio.play(PlayRequest {
        path: Some(path),
        volume,
        fade_in: false,
        stop_at: None,
        kind: "preview",
        prayer: None,
        sound: Some(s.id),
        duration: Some(s.duration_s),
    });
    Ok(())
}

#[tauri::command]
pub fn play_tone(state: State<'_, AppState>, volume: f32) {
    state.audio.play(PlayRequest { path: None, volume, fade_in: false, stop_at: None, kind: "tone", prayer: None, sound: None, duration: Some(1.9) });
}

/// "Test adhan now": the next real event for this prayer (with the user's settings), fired immediately.
#[tauri::command]
pub fn test_adhan(app: AppHandle<Wry>, state: State<'_, AppState>, prayer: String) -> Res<()> {
    let s = state.schedule.read().ok().and_then(|g| g.clone()).ok_or("no schedule yet")?;
    let now = scheduler::now_ms();
    let template = s.fire.iter().find(|e| e.kind == "adhan" && e.prayer.as_deref() == Some(prayer.as_str()) && e.audio.is_some()).cloned();
    let first_sound = state.adhans.list().first().map(|x| x.id.clone()).unwrap_or_default();
    let mut ev = template.unwrap_or(FireEvent {
        key: String::new(),
        at: now,
        kind: "adhan".into(),
        prayer: Some(prayer.clone()),
        audio: Some(FireAudio { sound: first_sound, volume: 0.8, fade_in: true, stop_at: None, kind: "adhan".into() }),
        notification: Some(FireNotification { title: s.labels.get(&prayer).cloned().unwrap_or_default(), body: String::new() }),
        toast: true,
        route: None,
    });
    ev.key = format!("test:{now}");
    ev.at = now;
    ev.toast = true;
    if let Some(n) = ev.notification.as_mut() {
        n.title = format!("{} — {}", s.string("testTitle"), n.title);
    }
    scheduler::fire(&app, &state, &s, &ev, false);
    Ok(())
}

#[tauri::command]
pub fn list_adhans(state: State<'_, AppState>) -> Vec<AdhanSound> {
    state.adhans.list()
}

#[tauri::command]
pub async fn import_adhan(app: AppHandle<Wry>, path: String, name: String, is_fajr: bool) -> Res<AdhanSound> {
    tauri::async_runtime::spawn_blocking(move || app.state::<AppState>().adhans.import(&PathBuf::from(path), &name, is_fajr))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn delete_adhan(state: State<'_, AppState>, id: String) -> Res<()> {
    state.adhans.delete(&id)
}

#[tauri::command]
pub fn update_adhan(state: State<'_, AppState>, id: String, name: Option<String>, short_end_s: Option<f64>) -> Res<AdhanSound> {
    state.adhans.update(&id, name, short_end_s)
}

#[tauri::command]
pub async fn search_places(state: State<'_, AppState>, query: String, limit: Option<u32>) -> Res<Vec<Place>> {
    state.places.search(&query, limit.unwrap_or(12)).await
}

#[tauri::command]
pub async fn nearest_place(state: State<'_, AppState>, lat: f64, lon: f64) -> Res<Option<Place>> {
    state.places.nearest(lat, lon).await
}

#[tauri::command]
pub async fn nominatim_search(state: State<'_, AppState>, query: String, lang: String) -> Res<serde_json::Value> {
    state.places.nominatim(&query, &lang).await
}

#[tauri::command]
pub fn show_main(app: AppHandle<Wry>, route: Option<String>) {
    windows::show_main(&app, route);
}

#[tauri::command]
pub fn open_panel(app: AppHandle<Wry>, state: State<'_, AppState>) {
    let cfg = state.config.read().map(|c| c.clone()).unwrap_or_default();
    windows::toggle_panel(&app, &cfg);
}

#[tauri::command]
pub fn hide_self(window: WebviewWindow<Wry>) {
    let _ = window.hide();
}

/// The adhan window asks for the height its content needs (it grows when the dua after the adhan appears).
#[tauri::command]
pub fn fit_toast(app: AppHandle<Wry>, state: State<'_, AppState>, height: f64) {
    let cfg = state.config.read().map(|c| c.clone()).unwrap_or_default();
    windows::fit_toast(&app, &cfg, height);
}

/// The adhan window's content, for when the window was created after the event was sent.
#[tauri::command]
pub fn toast_payload(state: State<'_, AppState>) -> Option<serde_json::Value> {
    state.toast.lock().ok().and_then(|t| t.clone())
}

#[tauri::command]
pub fn toast_action(app: AppHandle<Wry>, state: State<'_, AppState>, action: String) {
    match action.as_str() {
        "stop" => state.audio.stop(),
        "open" => {
            windows::hide(&app, windows::TOAST);
            windows::show_main(&app, None);
        }
        _ => windows::hide(&app, windows::TOAST),
    }
}

#[tauri::command]
pub fn apply_windows(app: AppHandle<Wry>, state: State<'_, AppState>, config: WindowsConfig) {
    let changed_shortcut = state.config.read().map(|c| c.stop_shortcut != config.stop_shortcut).unwrap_or(true);
    if let Ok(mut c) = state.config.write() {
        *c = config.clone();
    }
    windows::apply(&app, &config);
    crate::tray::set_visible(&state, !(cfg!(windows) && config.indicator.enabled && config.indicator.hide_tray_icon));
    apply_autostart(&app, config.start_with_system);
    if changed_shortcut || state.shortcut.lock().map(|s| s.is_none()).unwrap_or(true) {
        let _ = register_shortcut(&app, &state, config.stop_shortcut.clone());
    }
    // refresh the tray labels right away
    if let Some(s) = state.schedule.read().ok().and_then(|g| g.clone()) {
        crate::tray::update(&app, &state, &s, scheduler::now_ms());
    }
}

fn apply_autostart(app: &AppHandle<Wry>, enable: bool) {
    use tauri_plugin_autostart::ManagerExt;
    let info = crate::platform::info("");
    if info.store.is_some() {
        // MSIX uses the manifest's startupTask; Flatpak uses the Background portal (see docs/RELEASE_*.md)
        return;
    }
    let al = app.autolaunch();
    let on = al.is_enabled().unwrap_or(false);
    let r = if enable && !on {
        al.enable()
    } else if !enable && on {
        al.disable()
    } else {
        Ok(())
    };
    if let Err(e) = r {
        log::warn!("autostart: {e}");
    }
}

fn register_shortcut(app: &AppHandle<Wry>, state: &AppState, shortcut: Option<String>) -> Res<Option<String>> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
    let gs = app.global_shortcut();
    if let Ok(mut cur) = state.shortcut.lock() {
        if let Some(old) = cur.take() {
            if let Ok(sc) = Shortcut::from_str(&old) {
                let _ = gs.unregister(sc);
            }
        }
    }
    let Some(s) = shortcut else { return Ok(None) };
    let sc = Shortcut::from_str(&s).map_err(|e| e.to_string())?;
    gs.on_shortcut(sc, |app, _sc, ev| {
        if ev.state == ShortcutState::Pressed {
            app.state::<AppState>().audio.stop();
        }
    })
    .map_err(|e| e.to_string())?;
    if let Ok(mut cur) = state.shortcut.lock() {
        *cur = Some(s.clone());
    }
    Ok(Some(s))
}

#[tauri::command]
pub fn set_stop_shortcut(app: AppHandle<Wry>, state: State<'_, AppState>, shortcut: Option<String>) -> Res<Option<String>> {
    let r = register_shortcut(&app, &state, shortcut.clone());
    if let Ok(mut c) = state.config.write() {
        c.stop_shortcut = r.clone().ok().flatten();
    }
    r
}

#[tauri::command]
pub fn reset_widget_position(app: AppHandle<Wry>, which: String) {
    let label = if which == "mini" { windows::MINI } else { windows::WIDGET };
    windows::forget_position(&app, label);
}

#[tauri::command]
pub fn platform_info(app: AppHandle<Wry>) -> crate::platform::PlatformInfo {
    crate::platform::info(&app.package_info().version.to_string())
}

#[tauri::command]
pub fn set_wayland_compat(app: AppHandle<Wry>, enable: bool) -> Res<()> {
    let flag = crate::x11_compat_flag().ok_or("no config dir")?;
    if enable {
        std::fs::create_dir_all(flag.parent().unwrap()).map_err(|e| e.to_string())?;
        std::fs::write(&flag, b"1").map_err(|e| e.to_string())?;
    } else {
        let _ = std::fs::remove_file(&flag);
    }
    app.restart();
}

fn check_ext(path: &str, allowed: &[&str]) -> Res<()> {
    let ext = std::path::Path::new(path).extension().and_then(|e| e.to_str()).map(|e| e.to_lowercase()).unwrap_or_default();
    if allowed.contains(&ext.as_str()) {
        Ok(())
    } else {
        Err(format!("unsupported file type .{ext}"))
    }
}

/// Write a file chosen in the native "Save as" dialog (JSON/CSV only).
#[tauri::command]
pub fn export_file(path: String, contents: String) -> Res<()> {
    check_ext(&path, &["json", "csv"])?;
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

/// Read a file chosen in the native "Open" dialog (CSV/JSON/TXT, ≤ 5 MB).
#[tauri::command]
pub fn read_import_file(path: String) -> Res<String> {
    check_ext(&path, &["json", "csv", "txt"])?;
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 5 * 1024 * 1024 {
        return Err("file too large".into());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_logs_folder(app: AppHandle<Wry>) -> Res<()> {
    use tauri_plugin_opener::OpenerExt;
    let dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    let _ = std::fs::create_dir_all(&dir);
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

/// The main window finished its first render: show it (unless started minimised by autostart).
#[tauri::command]
pub fn app_ready(app: AppHandle<Wry>, state: State<'_, AppState>) {
    use std::sync::atomic::Ordering;
    if state.app_ready.swap(true, Ordering::SeqCst) {
        return;
    }
    if !state.started_minimized {
        windows::show_main(&app, None);
    }
}

#[tauri::command]
pub async fn library_download(app: AppHandle<Wry>, id: String, url: String, format: String) -> Res<crate::library::Downloaded> {
    crate::library::download(&app, &id, &url, &format).await
}

#[tauri::command]
pub fn library_delete(app: AppHandle<Wry>, id: String) -> Res<()> {
    crate::library::delete(&app, &id)
}

#[tauri::command]
pub fn open_library_folder(app: AppHandle<Wry>) -> Res<()> {
    use tauri_plugin_opener::OpenerExt;
    let dir = crate::library::dir(&app)?;
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}
