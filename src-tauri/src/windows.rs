//! Extra windows: main widget, mini widget, tray panel, taskbar pill (Windows) and adhan toast.
//! All share the same frontend bundle, selected with `?w=<kind>`.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{AppHandle, Emitter, LogicalPosition, Manager, PhysicalPosition, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WidgetConfig {
    pub enabled: bool,
    /// "desktop" (below windows) | "top" (above all apps)
    pub layer: String,
    #[serde(default = "default_size")]
    pub size: String,
    pub opacity: f64,
    pub locked: bool,
    #[serde(default)]
    pub pin_desktop_layer: bool,
}

fn default_size() -> String {
    "M".into()
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IndicatorConfig {
    pub enabled: bool,
    pub dynamic_tray_icon: bool,
    pub pill: bool,
    pub pill_locked: bool,
    pub panel_label: bool,
    pub label_format: String,
    pub tray_icon_style: String,
    pub hide_tray_icon: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WindowsConfig {
    pub lang: String,
    pub theme: String,
    pub keep_in_tray: bool,
    pub start_with_system: bool,
    pub main_widget: WidgetConfig,
    pub mini_widget: WidgetConfig,
    pub indicator: IndicatorConfig,
    pub toast_position: String,
    pub mute_fullscreen: bool,
    pub respect_dnd: bool,
    pub stop_shortcut: Option<String>,
}

impl Default for WindowsConfig {
    fn default() -> Self {
        let widget = WidgetConfig { enabled: false, layer: "desktop".into(), size: "M".into(), opacity: 1.0, locked: false, pin_desktop_layer: false };
        Self {
            lang: "ar".into(),
            theme: "light".into(),
            keep_in_tray: true,
            start_with_system: true,
            main_widget: widget.clone(),
            mini_widget: WidgetConfig { layer: "top".into(), ..widget },
            indicator: IndicatorConfig {
                enabled: false,
                dynamic_tray_icon: true,
                pill: true,
                pill_locked: false,
                panel_label: true,
                label_format: "name-value".into(),
                tray_icon_style: "auto".into(),
                hide_tray_icon: false,
            },
            toast_position: "auto".into(),
            mute_fullscreen: false,
            respect_dnd: false,
            stop_shortcut: Some("CommandOrControl+Alt+S".into()),
        }
    }
}

pub const WIDGET: &str = "widget";
pub const MINI: &str = "mini";
pub const PANEL: &str = "panel";
pub const PILL: &str = "pill";
pub const TOAST: &str = "toast";

/// Height of the adhan window: compact while the adhan plays, taller once the dua after the adhan is shown
/// (the page measures itself and calls `fit_toast`).
const TOAST_COMPACT: u32 = 168;
static TOAST_HEIGHT: AtomicU32 = AtomicU32::new(TOAST_COMPACT);

/// Logical sizes.
fn size_of(label: &str, cfg: &WindowsConfig) -> (f64, f64) {
    match label {
        // room for the stop button that appears while the adhan plays
        WIDGET if cfg.main_widget.size == "L" => (300.0, 448.0),
        WIDGET => (300.0, 372.0),
        // snug: the longest prayer name and a timer with seconds, with a small space between them
        MINI => (226.0, 48.0),
        PANEL => (300.0, 440.0),
        PILL => (164.0, 34.0),
        TOAST => (400.0, f64::from(TOAST_HEIGHT.load(Ordering::Relaxed))),
        _ => (300.0, 300.0),
    }
}

// ------------------------------------------------------------------ saved positions

fn positions_file<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("window-positions.json"))
}

fn load_positions<R: Runtime>(app: &AppHandle<R>) -> HashMap<String, (i32, i32)> {
    positions_file(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_position<R: Runtime>(app: &AppHandle<R>, label: &str, pos: PhysicalPosition<i32>) {
    let mut all = load_positions(app);
    all.insert(label.to_string(), (pos.x, pos.y));
    if let Some(p) = positions_file(app) {
        let _ = fs::create_dir_all(p.parent().unwrap());
        let _ = fs::write(p, serde_json::to_string(&all).unwrap_or_default());
    }
}

pub fn forget_position<R: Runtime>(app: &AppHandle<R>, label: &str) {
    let mut all = load_positions(app);
    all.remove(label);
    if let Some(p) = positions_file(app) {
        let _ = fs::write(p, serde_json::to_string(&all).unwrap_or_default());
    }
    if let Some(w) = app.get_webview_window(label) {
        let cfg = app.state::<crate::state::AppState>().config.read().map(|c| c.clone()).unwrap_or_default();
        let _ = place_default(&w, label, &cfg);
    }
}

/// Work area of the primary (or first) monitor, in physical pixels: (x, y, w, h, scale).
fn work_area<R: Runtime>(app: &AppHandle<R>) -> Option<(i32, i32, u32, u32, f64, bool)> {
    let m = app.primary_monitor().ok().flatten().or_else(|| app.available_monitors().ok()?.into_iter().next())?;
    let wa = m.work_area();
    // panel at the top when the work area starts below the monitor's top edge
    let panel_top = wa.position.y > m.position().y;
    Some((wa.position.x, wa.position.y, wa.size.width, wa.size.height, m.scale_factor(), panel_top))
}

/// Size of a window in physical pixels. Computed from its fixed logical size: right after creation the real
/// size is not known yet on X11 (it reads as 1×1), which put new widgets almost entirely off screen.
fn physical_size(label: &str, cfg: &WindowsConfig, scale: f64) -> (i32, i32) {
    let (w, h) = size_of(label, cfg);
    ((w * scale).round() as i32, (h * scale).round() as i32)
}

fn place_default<R: Runtime>(w: &WebviewWindow<R>, label: &str, cfg: &WindowsConfig) -> tauri::Result<()> {
    let app = w.app_handle();
    let Some((x, y, ww, wh, scale, panel_top)) = work_area(app) else { return Ok(()) };
    let (sw, sh) = physical_size(label, cfg, scale);
    let margin = (20.0 * scale) as i32;
    let right = x + ww as i32 - sw - margin;
    let bottom = y + wh as i32 - sh - margin;
    let pos = match label {
        WIDGET => PhysicalPosition::new(right, y + margin),
        MINI => PhysicalPosition::new(right, y + margin + (400.0 * scale) as i32),
        PANEL => PhysicalPosition::new(right, if panel_top { y + margin / 2 } else { y + wh as i32 - sh - margin / 2 }),
        TOAST => {
            // Arabic: bottom-left corner (brief §10.3); "auto" follows the panel (top panel → top)
            let left = x + margin;
            let top = match cfg.toast_position.as_str() {
                "top-end" => true,
                "bottom-end" => false,
                _ => panel_top,
            };
            PhysicalPosition::new(if cfg.lang == "ar" { left } else { right }, if top { y + margin } else { bottom })
        }
        _ => PhysicalPosition::new(right, y + margin),
    };
    w.set_position(pos)
}

/// Keep a saved position inside the visible work area (monitors may have changed).
fn clamp_to_screen<R: Runtime>(app: &AppHandle<R>, pos: (i32, i32), size: (i32, i32)) -> Option<(i32, i32)> {
    let monitors = app.available_monitors().ok()?;
    for m in &monitors {
        let wa = m.work_area();
        let (x0, y0) = (wa.position.x, wa.position.y);
        let (x1, y1) = (x0 + wa.size.width as i32, y0 + wa.size.height as i32);
        if pos.0 + size.0 / 2 >= x0 && pos.0 + size.0 / 2 <= x1 && pos.1 + size.1 / 2 >= y0 && pos.1 + size.1 / 2 <= y1 {
            return Some((pos.0.clamp(x0, x1 - size.0), pos.1.clamp(y0, y1 - size.1)));
        }
    }
    None
}

// ------------------------------------------------------------------ creation

/// Runs work that may create a window where that cannot deadlock.
///
/// On Windows, WebView2 creates a window asynchronously on the main thread. Building one *from* the main thread —
/// synchronous commands and tray/menu handlers all run there — waits for a step that can never run, and the whole
/// app freezes (nothing responds, not even Quit). There the work goes to a worker thread, which waits while the
/// main thread builds the window; a lock keeps two calls from creating the same window at once. GTK must be used
/// from the main thread, so elsewhere the work runs in place.
pub fn with_windows<R: Runtime>(app: &AppHandle<R>, work: impl FnOnce(&AppHandle<R>) + Send + 'static) {
    #[cfg(windows)]
    {
        static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let app = app.clone();
        std::thread::spawn(move || {
            let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
            work(&app);
        });
    }
    #[cfg(not(windows))]
    work(app);
}

fn build<R: Runtime>(app: &AppHandle<R>, label: &str, cfg: &WindowsConfig) -> tauri::Result<WebviewWindow<R>> {
    if let Some(w) = app.get_webview_window(label) {
        return Ok(w);
    }
    let (w, h) = size_of(label, cfg);
    let url = WebviewUrl::App(format!("index.html?w={label}").into());
    let on_top = match label {
        WIDGET => cfg.main_widget.layer == "top",
        MINI => cfg.mini_widget.layer == "top",
        _ => true,
    };
    let on_bottom = match label {
        WIDGET => cfg.main_widget.layer != "top",
        MINI => cfg.mini_widget.layer != "top",
        _ => false,
    };
    let builder = WebviewWindowBuilder::new(app, label, url)
        .title("3ahd")
        .inner_size(w, h)
        // fixed-size windows: pin min/max so GTK does not impose its default minimum height (~200 px)
        .min_inner_size(w, h)
        .max_inner_size(w, h)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .skip_taskbar(true)
        .always_on_top(on_top)
        .always_on_bottom(on_bottom)
        .visible_on_all_workspaces(label == WIDGET || label == MINI || label == PILL)
        .focused(label == PANEL)
        .focusable(label == PANEL || label == TOAST)
        .visible(false);
    let win = builder.build()?;

    #[cfg(target_os = "linux")]
    {
        use gtk::prelude::{BinExt, Cast, ContainerExt, GtkWindowExt, WidgetExt};
        if let Ok(gw) = win.gtk_window() {
            gw.set_skip_pager_hint(true);
            gw.set_skip_taskbar_hint(true);
            // WebKitGTK asks for a 200 px minimum height; small windows (mini widget, pill) must go below it.
            fn shrink(widget: &gtk::Widget, w: i32, h: i32) {
                widget.set_size_request(w, h);
                if let Some(c) = widget.downcast_ref::<gtk::Container>() {
                    for child in c.children() {
                        shrink(&child, w, h);
                    }
                }
            }
            if let Some(child) = gw.child() {
                shrink(&child, w as i32, h as i32);
            }
            gw.resize(w as i32, h as i32);
        }
    }

    // position: saved (widgets/pill) or default
    let saved = load_positions(app).get(label).copied();
    let scale = work_area(app).map(|a| a.4).unwrap_or(1.0);
    let size = physical_size(label, cfg, scale);
    match saved.and_then(|p| clamp_to_screen(app, p, size)) {
        Some((x, y)) if label == WIDGET || label == MINI || label == PILL => {
            let _ = win.set_position(PhysicalPosition::new(x, y));
        }
        _ => {
            let _ = place_default(&win, label, cfg);
        }
    }

    let app2 = app.clone();
    let lbl = label.to_string();
    win.on_window_event(move |ev| match ev {
        WindowEvent::Moved(pos) if lbl == WIDGET || lbl == MINI || lbl == PILL => save_position(&app2, &lbl, *pos),
        WindowEvent::Focused(false) if lbl == PANEL => {
            if let Some(w) = app2.get_webview_window(PANEL) {
                let _ = w.hide();
            }
        }
        _ => {}
    });
    Ok(win)
}

/// Create/show/hide windows so they match the configuration.
pub fn apply<R: Runtime>(app: &AppHandle<R>, cfg: &WindowsConfig) {
    for (label, wcfg) in [(WIDGET, &cfg.main_widget), (MINI, &cfg.mini_widget)] {
        if wcfg.enabled {
            match build(app, label, cfg) {
                Ok(w) => {
                    let top = wcfg.layer == "top";
                    let _ = w.set_always_on_top(top);
                    let _ = w.set_always_on_bottom(!top);
                    let (sw, sh) = size_of(label, cfg);
                    let _ = w.set_min_size(Some(tauri::LogicalSize::new(sw, sh)));
                    let _ = w.set_max_size(Some(tauri::LogicalSize::new(sw, sh)));
                    let _ = w.set_size(tauri::LogicalSize::new(sw, sh));
                    let _ = w.show();
                }
                Err(e) => log::error!("cannot create {label}: {e}"),
            }
        } else if let Some(w) = app.get_webview_window(label) {
            let _ = w.close();
        }
    }
    // Windows: taskbar pill
    #[cfg(windows)]
    {
        if cfg.indicator.enabled && cfg.indicator.pill {
            if let Ok(w) = build(app, PILL, cfg) {
                if !load_positions(app).contains_key(PILL) {
                    place_pill(app, &w);
                }
                let _ = w.show();
            }
        } else if let Some(w) = app.get_webview_window(PILL) {
            let _ = w.close();
        }
    }
    let _ = app.emit("ahd://windows-config", cfg);
}

#[cfg(windows)]
fn place_pill<R: Runtime>(app: &AppHandle<R>, w: &WebviewWindow<R>) {
    let size = w.outer_size().map(|s| (s.width as i32, s.height as i32)).unwrap_or((164, 34));
    if let Some((bar, notify)) = crate::platform::windows::taskbar_rects() {
        let horizontal = (bar.right - bar.left) > (bar.bottom - bar.top);
        let (x, y) = if horizontal {
            let right = notify.map(|n| n.left).unwrap_or(bar.right - 320);
            (right - size.0 - 8, bar.top + ((bar.bottom - bar.top) - size.1) / 2)
        } else {
            (bar.left + ((bar.right - bar.left) - size.0) / 2, notify.map(|n| n.top).unwrap_or(bar.bottom - 320) - size.1 - 8)
        };
        let _ = w.set_position(PhysicalPosition::new(x, y));
    } else {
        let cfg = app.state::<crate::state::AppState>().config.read().map(|c| c.clone()).unwrap_or_default();
        let _ = place_default(w, PILL, &cfg);
    }
}

/// Pre-create the tray panel hidden so it opens instantly (brief §11.4).
pub fn precreate_panel<R: Runtime>(app: &AppHandle<R>, cfg: &WindowsConfig) {
    let _ = build(app, PANEL, cfg);
}

pub fn toggle_panel<R: Runtime>(app: &AppHandle<R>, cfg: &WindowsConfig) {
    let cfg = cfg.clone();
    with_windows(app, move |app| {
        if let Ok(w) = build(app, PANEL, &cfg) {
            if w.is_visible().unwrap_or(false) {
                let _ = w.hide();
            } else {
                let _ = place_default(&w, PANEL, &cfg);
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
    });
}

pub fn show_toast<R: Runtime>(app: &AppHandle<R>, cfg: &WindowsConfig, payload: &impl Serialize) {
    // Kept for the toast window to fetch on load: when it is created for this adhan, its page is not listening
    // yet and would miss the event (the toast then showed no prayer, time or dua).
    let value = serde_json::to_value(payload).unwrap_or_default();
    if let Ok(mut t) = app.state::<crate::state::AppState>().toast.lock() {
        *t = Some(value.clone());
    }
    TOAST_HEIGHT.store(TOAST_COMPACT, Ordering::Relaxed);
    let cfg = cfg.clone();
    with_windows(app, move |app| match build(app, TOAST, &cfg) {
        Ok(w) => {
            resize_fixed(&w, TOAST, &cfg);
            let _ = place_default(&w, TOAST, &cfg);
            let _ = app.emit_to(TOAST, "ahd://toast", value);
            let _ = w.show();
        }
        Err(e) => log::error!("toast: {e}"),
    });
}

fn resize_fixed<R: Runtime>(w: &WebviewWindow<R>, label: &str, cfg: &WindowsConfig) {
    let (sw, sh) = size_of(label, cfg);
    let _ = w.set_min_size(Some(tauri::LogicalSize::new(sw, sh)));
    let _ = w.set_max_size(Some(tauri::LogicalSize::new(sw, sh)));
    let _ = w.set_size(tauri::LogicalSize::new(sw, sh));
}

/// The adhan window grows to fit the dua after the adhan, keeping its corner of the screen.
pub fn fit_toast<R: Runtime>(app: &AppHandle<R>, cfg: &WindowsConfig, height: f64) {
    let h = height.clamp(120.0, 460.0).round() as u32;
    if TOAST_HEIGHT.swap(h, Ordering::Relaxed) == h {
        return;
    }
    if let Some(w) = app.get_webview_window(TOAST) {
        resize_fixed(&w, TOAST, cfg);
        let _ = place_default(&w, TOAST, cfg);
    }
}

pub fn hide<R: Runtime>(app: &AppHandle<R>, label: &str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.hide();
    }
}

/// The main window is designed at 1120×740 logical px. Larger windows (e.g. maximized on a big screen) zoom the
/// page — like the browser's own zoom, so layout, maps and the PDF reader stay correct — up to 1.4×, in 5 % steps.
pub fn fit_main_zoom<R: Runtime>(app: &AppHandle<R>) {
    use std::sync::atomic::{AtomicU32, Ordering};
    static CURRENT: AtomicU32 = AtomicU32::new(100);
    let Some(w) = app.get_webview_window("main") else { return };
    let (Ok(size), Ok(scale)) = (w.inner_size(), w.scale_factor()) else { return };
    let size = size.to_logical::<f64>(scale);
    let fit = (size.width / 1120.0).min(size.height / 740.0).clamp(1.0, 1.4);
    let pct = ((fit * 20.0).floor() * 5.0) as u32; // 100, 105, … 140
    if CURRENT.swap(pct, Ordering::Relaxed) != pct {
        let _ = w.set_zoom(f64::from(pct) / 100.0);
    }
}

pub fn show_main<R: Runtime>(app: &AppHandle<R>, route: Option<String>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        fit_main_zoom(app);
        if let Some(r) = route {
            let _ = app.emit_to("main", "ahd://navigate", serde_json::json!({ "route": r }));
        }
    }
}

#[allow(dead_code)]
pub fn logical(x: f64, y: f64) -> LogicalPosition<f64> {
    LogicalPosition::new(x, y)
}
