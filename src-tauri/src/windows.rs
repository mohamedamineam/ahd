//! Extra windows: main widget, mini widget, taskbar pill (Windows) and adhan toast.
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
    /// main widget: "classic" | "panel" | "wide"
    #[serde(default = "default_style")]
    pub style: String,
    /// background opacity (the page draws it; kept here as part of the shared settings)
    pub opacity: f64,
    pub locked: bool,
}

fn default_size() -> String {
    "M".into()
}

fn default_style() -> String {
    "classic".into()
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
        let widget = WidgetConfig { enabled: false, layer: "desktop".into(), size: "M".into(), style: "classic".into(), opacity: 1.0, locked: false };
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
pub const PILL: &str = "pill";
pub const TOAST: &str = "toast";

/// Height of the adhan window: compact while the adhan plays, taller once the dua after the adhan is shown
/// (the page measures itself and calls `fit_toast`).
const TOAST_COMPACT: u32 = 168;
static TOAST_HEIGHT: AtomicU32 = AtomicU32::new(TOAST_COMPACT);

/// Logical sizes.
fn size_of(label: &str, cfg: &WindowsConfig) -> (f64, f64) {
    match label {
        WIDGET => match (cfg.main_widget.style.as_str(), cfg.main_widget.size.as_str()) {
            // dates, the state, up to eight times (with Imsak and Duha) and the buttons
            ("panel", _) => (300.0, 520.0),
            ("wide", _) => (540.0, 176.0),
            // room for the stop button that appears while the adhan plays
            (_, "L") => (300.0, 448.0),
            _ => (300.0, 372.0),
        },
        // snug: the longest prayer name and a timer with seconds, with a small space between them
        MINI => (226.0, 48.0),
        // Windows sizes it to the taskbar (pill::place)
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
    #[cfg(windows)]
    if label == PILL {
        pill::forget_position(app);
        return;
    }
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
    // Windows keeps desktop widgets at the bottom itself (layers), since tao's "always on bottom" also stops them
    // from ever being put back on top
    let on_bottom = !cfg!(windows)
        && match label {
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
        .focused(false)
        .focusable(label == TOAST)
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

    // position: saved (widgets) or default; the pill is placed on the taskbar by pill::place
    let saved = load_positions(app).get(label).copied();
    let scale = work_area(app).map(|a| a.4).unwrap_or(1.0);
    let size = physical_size(label, cfg, scale);
    match saved.and_then(|p| clamp_to_screen(app, p, size)) {
        Some((x, y)) if label == WIDGET || label == MINI => {
            let _ = win.set_position(PhysicalPosition::new(x, y));
        }
        _ => {
            let _ = place_default(&win, label, cfg);
        }
    }

    let app2 = app.clone();
    let lbl = label.to_string();
    // Only the widgets remember where they were dragged: the pill saves its place along the taskbar itself, and
    // saving its first (default) position here once kept it from ever being put on the taskbar.
    win.on_window_event(move |ev| {
        if let WindowEvent::Moved(pos) = ev {
            if lbl == WIDGET || lbl == MINI {
                save_position(&app2, &lbl, *pos);
                // a moved desktop widget stays below the apps
                #[cfg(windows)]
                layers::restack();
            }
        }
    });
    Ok(win)
}

/// Above all apps (`top`) or on the desktop. The flag being turned off goes first: on Windows, turning "always on
/// bottom" off also turns "always on top" off, which kept "above all apps" from working until a restart.
fn set_layer<R: Runtime>(w: &WebviewWindow<R>, top: bool) {
    if top {
        let _ = w.set_always_on_bottom(false);
        let _ = w.set_always_on_top(true);
    } else {
        let _ = w.set_always_on_top(false);
        #[cfg(not(windows))]
        let _ = w.set_always_on_bottom(true);
    }
}

/// After a change of size (another widget type), keep the whole widget on screen.
fn keep_on_screen<R: Runtime>(app: &AppHandle<R>, w: &WebviewWindow<R>, label: &str, cfg: &WindowsConfig) {
    let Ok(pos) = w.outer_position() else { return };
    let scale = w.scale_factor().unwrap_or(1.0);
    if let Some((x, y)) = clamp_to_screen(app, (pos.x, pos.y), physical_size(label, cfg, scale)) {
        if (x, y) != (pos.x, pos.y) {
            let _ = w.set_position(PhysicalPosition::new(x, y));
        }
    }
}

/// Create/show/hide windows so they match the configuration.
pub fn apply<R: Runtime>(app: &AppHandle<R>, cfg: &WindowsConfig) {
    for (label, wcfg) in [(WIDGET, &cfg.main_widget), (MINI, &cfg.mini_widget)] {
        if wcfg.enabled {
            match build(app, label, cfg) {
                Ok(w) => {
                    let top = wcfg.layer == "top";
                    set_layer(&w, top);
                    resize_fixed(&w, label, cfg);
                    keep_on_screen(app, &w, label, cfg);
                    let _ = w.show();
                    #[cfg(windows)]
                    layers::track(label, &w, if top { layers::Z::AboveApps } else { layers::Z::BelowApps });
                }
                Err(e) => log::error!("cannot create {label}: {e}"),
            }
        } else if let Some(w) = app.get_webview_window(label) {
            #[cfg(windows)]
            layers::untrack(label);
            let _ = w.close();
        }
    }
    // Windows: taskbar pill
    #[cfg(windows)]
    {
        if cfg.indicator.enabled && cfg.indicator.pill {
            if let Ok(w) = build(app, PILL, cfg) {
                pill::place(app, &w);
            }
        } else if let Some(w) = app.get_webview_window(PILL) {
            layers::untrack(PILL);
            pill::closed();
            let _ = w.close();
        }
    }
    let _ = app.emit("ahd://windows-config", cfg);
}

/// Windows z-order of the widgets and the pill. Windows has no "below all apps" layer (a window only put at the
/// bottom comes back up when shown or clicked), and the taskbar comes over "always on top" windows when clicked.
/// So desktop widgets are pushed back down, and the pill back above the taskbar, whenever another app's window comes
/// to the front, after they are moved, and every second. Widgets above all apps are simply "always on top": raising
/// them again each time would cover the Start menu and the notification flyouts.
#[cfg(windows)]
pub mod layers {
    use std::sync::Mutex;
    use tauri::{Runtime, WebviewWindow};

    #[derive(Clone, Copy, PartialEq)]
    pub enum Z {
        /// widget above all apps: always on top, set once
        AboveApps,
        /// desktop widget: kept below all apps
        BelowApps,
        /// the pill: kept above the taskbar
        AboveTaskbar,
    }

    static TRACKED: Mutex<Vec<(&'static str, isize, Z)>> = Mutex::new(Vec::new());

    fn tracked() -> std::sync::MutexGuard<'static, Vec<(&'static str, isize, Z)>> {
        TRACKED.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn track<R: Runtime>(label: &'static str, w: &WebviewWindow<R>, z: Z) {
        let Ok(h) = w.hwnd() else { return };
        let hwnd = h.0 as isize;
        let mut t = tracked();
        t.retain(|(l, _, _)| *l != label);
        t.push((label, hwnd, z));
        drop(t);
        crate::platform::windows::set_z(hwnd, z != Z::BelowApps);
    }

    pub fn untrack(label: &str) {
        tracked().retain(|(l, _, _)| *l != label);
    }

    /// Push desktop widgets back down and the pill back above the taskbar.
    pub fn restack() {
        let all = tracked().clone();
        for (_, hwnd, z) in all {
            match z {
                Z::BelowApps => crate::platform::windows::set_z(hwnd, false),
                Z::AboveTaskbar => crate::platform::windows::set_z(hwnd, true),
                Z::AboveApps => {}
            }
        }
    }

    /// Restack whenever another app comes to the front (installed once, on the main thread).
    pub fn install() {
        crate::platform::windows::on_foreground_change(restack);
    }
}

/// Taskbar pill (Windows). It sits on the taskbar, whichever edge the taskbar is on: next to the notification area
/// by default, or where it was dragged along the taskbar (it cannot leave it; "Lock pill position" keeps it still).
/// It hides with the taskbar (auto-hide, full-screen apps) and stays above it when the taskbar is clicked.
#[cfg(windows)]
mod pill {
    use super::{layers, load_positions, positions_file, save_position, PILL};
    use std::sync::Mutex;
    use std::time::{Duration, Instant};
    use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};

    /// Saved place along the taskbar (x on a horizontal taskbar, y on a vertical one), physical pixels.
    const KEY: &str = "pill-taskbar";

    type Bar = Option<(i32, i32, i32, i32)>;
    struct Placed {
        /// taskbar rectangle it was placed on (None: no taskbar then)
        bar: Bar,
        shown: bool,
    }
    static PLACED: Mutex<Option<Placed>> = Mutex::new(None);
    /// Window position when a drag started, and the last sign of that drag (a lost drag must not stop the pill
    /// from following the taskbar).
    static DRAG_FROM: Mutex<Option<(i32, i32, Instant)>> = Mutex::new(None);

    fn lock<T>(m: &'static Mutex<T>) -> std::sync::MutexGuard<'static, T> {
        m.lock().unwrap_or_else(|e| e.into_inner())
    }

    struct Geometry {
        x: i32,
        y: i32,
        w: i32,
        h: i32,
        bar: (i32, i32, i32, i32),
    }

    fn current_bar() -> Bar {
        crate::platform::windows::taskbar_rects().map(|(b, _)| (b.left, b.top, b.right, b.bottom))
    }

    /// Size and position on the taskbar for a wanted top-left corner (saved or dragged), or next to the clock.
    fn geometry<R: Runtime>(app: &AppHandle<R>, wanted: Option<(i32, i32)>) -> Option<Geometry> {
        let (bar, notify) = crate::platform::windows::taskbar_rects()?;
        let (bw, bh) = (bar.right - bar.left, bar.bottom - bar.top);
        if bw <= 0 || bh <= 0 {
            return None;
        }
        let scale = app
            .monitor_from_point(f64::from(bar.left + bw / 2), f64::from(bar.top + bh / 2))
            .ok()
            .flatten()
            .map(|m| m.scale_factor())
            .unwrap_or(1.0);
        let px = |v: f64| (v * scale).round() as i32;
        // never off the taskbar, even when it is too small for the wanted place
        let fit = |v: i32, lo: i32, hi: i32| v.min(hi).max(lo);
        let gap = px(8.0);
        let horizontal = bw >= bh;
        let (w, h) = if horizontal {
            // as tall as fits in the taskbar (34 px, less on a small taskbar)
            (px(164.0), px(34.0).min(bh - px(4.0)).max(px(20.0)))
        } else {
            (px(40.0).max(bw - px(6.0)), px(46.0))
        };
        let (x, y) = if horizontal {
            let default = notify.map(|n| n.left - w - gap).unwrap_or(bar.right - w - px(220.0));
            (fit(wanted.map_or(default, |p| p.0), bar.left + gap / 2, bar.right - w - gap / 2), bar.top + (bh - h) / 2)
        } else {
            let default = notify.map(|n| n.top - h - gap).unwrap_or(bar.bottom - h - px(220.0));
            (bar.left + (bw - w) / 2, fit(wanted.map_or(default, |p| p.1), bar.top + gap / 2, bar.bottom - h - gap / 2))
        };
        Some(Geometry { x, y, w, h, bar: (bar.left, bar.top, bar.right, bar.bottom) })
    }

    fn visible_now() -> bool {
        crate::platform::windows::taskbar_visible() && !crate::platform::fullscreen_app_active()
    }

    fn show<R: Runtime>(w: &WebviewWindow<R>, shown: bool) {
        if shown {
            let _ = w.show();
            layers::track(PILL, w, layers::Z::AboveTaskbar);
        } else {
            layers::untrack(PILL);
            let _ = w.hide();
        }
    }

    /// Size the pill to the taskbar, put it in its place and show it (unless the taskbar is hidden).
    pub fn place<R: Runtime>(app: &AppHandle<R>, w: &WebviewWindow<R>) {
        let saved = load_positions(app).get(KEY).copied();
        let Some(g) = geometry(app, saved) else {
            // no taskbar (Explorer restarting): the tick puts it back when the taskbar returns
            show(w, false);
            *lock(&PLACED) = Some(Placed { bar: current_bar(), shown: false });
            return;
        };
        let size = PhysicalSize::new(g.w as u32, g.h as u32);
        let _ = w.set_min_size(Some(size));
        let _ = w.set_max_size(Some(size));
        let _ = w.set_size(size);
        let _ = w.set_position(PhysicalPosition::new(g.x, g.y));
        let shown = visible_now();
        show(w, shown);
        *lock(&PLACED) = Some(Placed { bar: Some(g.bar), shown });
    }

    /// Every second: follow the taskbar (moved to another edge, resized, auto-hidden, covered by a full-screen app)
    /// and stay above it after it was clicked.
    pub fn tick<R: Runtime>(app: &AppHandle<R>) {
        let Some(w) = app.get_webview_window(PILL) else { return };
        {
            let mut drag = lock(&DRAG_FROM);
            match *drag {
                Some((_, _, at)) if at.elapsed() < Duration::from_secs(5) => return,
                Some(_) => *drag = None,
                None => {}
            }
        }
        let Some((last_bar, last_shown)) = lock(&PLACED).as_ref().map(|p| (p.bar, p.shown)) else { return };
        if current_bar() != last_bar {
            place(app, &w);
            return;
        }
        let shown = visible_now();
        if shown != last_shown {
            show(&w, shown);
            if let Some(p) = lock(&PLACED).as_mut() {
                p.shown = shown;
            }
        }
    }

    pub fn closed() {
        *lock(&PLACED) = None;
        *lock(&DRAG_FROM) = None;
    }

    pub fn drag_start<R: Runtime>(app: &AppHandle<R>) {
        if let Some(p) = app.get_webview_window(PILL).and_then(|w| w.outer_position().ok()) {
            *lock(&DRAG_FROM) = Some((p.x, p.y, Instant::now()));
        }
    }

    /// Follow the pointer (moved by dx, dy physical pixels since the drag started), along the taskbar only.
    pub fn drag<R: Runtime>(app: &AppHandle<R>, dx: i32, dy: i32) {
        let (x, y) = {
            let mut drag = lock(&DRAG_FROM);
            let Some((x, y, at)) = drag.as_mut() else { return };
            *at = Instant::now();
            (*x, *y)
        };
        let Some(w) = app.get_webview_window(PILL) else { return };
        if let Some(g) = geometry(app, Some((x + dx, y + dy))) {
            let _ = w.set_position(PhysicalPosition::new(g.x, g.y));
        }
    }

    pub fn drag_end<R: Runtime>(app: &AppHandle<R>) {
        if lock(&DRAG_FROM).take().is_none() {
            return;
        }
        if let Some(p) = app.get_webview_window(PILL).and_then(|w| w.outer_position().ok()) {
            save_position(app, KEY, p);
        }
    }

    /// "Reset position": back next to the clock.
    pub fn forget_position<R: Runtime>(app: &AppHandle<R>) {
        let mut all = load_positions(app);
        if all.remove(KEY).is_some() {
            if let Some(p) = positions_file(app) {
                let _ = std::fs::write(p, serde_json::to_string(&all).unwrap_or_default());
            }
        }
        if let Some(w) = app.get_webview_window(PILL) {
            place(app, &w);
        }
    }
}

/// Every second (scheduler), Windows: the pill follows the taskbar; widgets and pill stay in their layers.
pub fn tick<R: Runtime>(app: &AppHandle<R>) {
    #[cfg(windows)]
    {
        pill::tick(app);
        layers::restack();
    }
    #[cfg(not(windows))]
    let _ = app;
}

/// Dragging the pill along the taskbar (Windows): the page reports how far the pointer moved since it was pressed.
pub fn pill_drag<R: Runtime>(app: &AppHandle<R>, phase: &str, dx: i32, dy: i32) {
    #[cfg(windows)]
    {
        let locked = app.state::<crate::state::AppState>().config.read().map(|c| c.indicator.pill_locked).unwrap_or(true);
        match phase {
            "start" if !locked => pill::drag_start(app),
            "move" => pill::drag(app, dx, dy),
            "end" => pill::drag_end(app),
            _ => {}
        }
    }
    #[cfg(not(windows))]
    let _ = (app, phase, dx, dy);
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
