//! Tray icon, menu and indicator label (brief §11).
//! Linux: the menu itself shows the day (dates + six prayers) and the label next to the icon shows "العصر +1:12".
//!        Cinnamon/MATE show that label only for XApp status icons, so there the tray is one (src/xapp.rs);
//!        elsewhere it is an AppIndicator (GNOME with the AppIndicator extension shows the label; KDE does not).
//! Windows: tooltips and a dynamic icon; left-click opens the prayer panel, right-click the menu.

use crate::display::{display_state, format_value, to_digits, Mode};
use crate::schedule::SchedulePayload;
use crate::state::AppState;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuBuilder, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime, Wry};

const ICON_LIGHT: &[u8] = include_bytes!("../icons/tray/tray-light-32.png");
const ICON_DARK: &[u8] = include_bytes!("../icons/tray/tray-dark-32.png");

/// The Tauri (AppIndicator / Windows notification area) tray and its menu items.
struct TauriTray {
    tray: TrayIcon<Wry>,
    info: Vec<MenuItem<Wry>>, // weekday + hijri, gregorian, place, 6 prayer rows (Linux)
    stop: MenuItem<Wry>,
    panel: MenuItem<Wry>,
    open: MenuItem<Wry>,
    settings: MenuItem<Wry>,
    widget: CheckMenuItem<Wry>,
    mini: CheckMenuItem<Wry>,
    quit: MenuItem<Wry>,
}

pub struct TrayHandles {
    /// None when the XApp tray is used instead (Cinnamon, MATE)
    tauri: Option<TauriTray>,
    last_label: String,
    last_minute: i64,
    last_icon_key: String,
    last_stop: Option<bool>,
}

fn png(bytes: &[u8]) -> Option<Image<'static>> {
    Image::from_bytes(bytes).ok().map(|i| i.to_owned())
}

pub fn create(app: &AppHandle<Wry>) -> tauri::Result<TrayHandles> {
    #[cfg(target_os = "linux")]
    if crate::xapp::wanted() {
        if let Some(icon) = crate::xapp::icon_file(app, "tray-xapp-light.png", ICON_LIGHT) {
            if crate::xapp::create(app, &icon) {
                log::info!("tray: XApp status icon");
                return Ok(TrayHandles { tauri: None, last_label: String::new(), last_minute: -1, last_icon_key: String::new(), last_stop: None });
            }
        }
        log::warn!("tray: XApp status icon unavailable, using AppIndicator");
    }
    let info: Vec<MenuItem<Wry>> = if cfg!(target_os = "linux") {
        (0..9).map(|i| MenuItem::with_id(app, format!("info-{i}"), " ", false, None::<&str>)).collect::<Result<_, _>>()?
    } else {
        Vec::new()
    };
    let panel = MenuItem::with_id(app, "panel", "Show prayer panel", true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Stop adhan", false, None::<&str>)?;
    let widget = CheckMenuItem::with_id(app, "toggle-widget", "Main widget", true, false, None::<&str>)?;
    let mini = CheckMenuItem::with_id(app, "toggle-mini", "Mini widget", true, false, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open Ahd", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let mut mb = MenuBuilder::new(app);
    if !info.is_empty() {
        mb = mb.item(&info[0]).item(&info[1]).item(&info[2]).item(&PredefinedMenuItem::separator(app)?);
        for row in &info[3..] {
            mb = mb.item(row);
        }
        mb = mb.item(&PredefinedMenuItem::separator(app)?);
    }
    let menu: Menu<Wry> = mb
        .item(&panel)
        .item(&stop)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&widget)
        .item(&mini)
        .item(&settings)
        .item(&PredefinedMenuItem::separator(app)?)
        .item(&open)
        .item(&quit)
        .build()?;

    #[cfg_attr(not(target_os = "linux"), allow(unused_mut))]
    let mut builder = TrayIconBuilder::with_id("main")
        .icon(png(ICON_LIGHT).expect("tray icon"))
        .tooltip("Ahd")
        .menu(&menu)
        .show_menu_on_left_click(cfg!(target_os = "linux"))
        .on_menu_event(|app, ev| on_menu(app, ev.id().as_ref()))
        .on_tray_icon_event(|tray, ev| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                let app = tray.app_handle();
                let cfg = app.state::<AppState>().config.read().map(|c| c.clone()).unwrap_or_default();
                crate::windows::toggle_panel(app, &cfg);
            }
        });
    #[cfg(target_os = "linux")]
    {
        // Flatpak-friendly: write the icon image into our cache dir (brief §11.2)
        if let Ok(dir) = app.path().app_cache_dir() {
            let _ = std::fs::create_dir_all(&dir);
            builder = builder.temp_dir_path(dir);
        }
    }
    let tray = builder.build(app)?;
    Ok(TrayHandles {
        tauri: Some(TauriTray { tray, info, stop, panel, open, settings, widget, mini, quit }),
        last_label: String::new(),
        last_minute: -1,
        last_icon_key: String::new(),
        last_stop: None,
    })
}

pub(crate) fn on_menu<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        "open" => crate::windows::show_main(app, None),
        "settings" => crate::windows::show_main(app, Some("/settings/general".into())),
        "panel" => {
            let cfg = app.state::<AppState>().config.read().map(|c| c.clone()).unwrap_or_default();
            crate::windows::toggle_panel(app, &cfg);
        }
        "stop" => app.state::<AppState>().audio.stop(),
        "toggle-widget" => {
            let _ = app.emit_to("main", "ahd://tray-action", serde_json::json!({ "action": "toggle-widget" }));
        }
        "toggle-mini" => {
            let _ = app.emit_to("main", "ahd://tray-action", serde_json::json!({ "action": "toggle-mini" }));
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

/// LRI … PDI so "+1:12" keeps its sign on the left inside Arabic labels.
fn ltr(s: &str) -> String {
    format!("\u{2066}{s}\u{2069}")
}

/// Called every tick by the scheduler.
pub fn update(app: &AppHandle<Wry>, state: &AppState, s: &SchedulePayload, now: i64) {
    let Ok(mut guard) = state.tray.lock() else { return };
    let Some(h) = guard.as_mut() else { return };
    let cfg = state.config.read().map(|c| c.clone()).unwrap_or_default();
    let st = display_state(now, &s.timeline, s.display.threshold_minutes, s.display.include_sunrise);
    #[cfg(target_os = "linux")]
    let mut xu = crate::xapp::Update::default();
    #[cfg(not(target_os = "linux"))]
    let _ = app;

    // ---- label + tooltip (every second in countdown or with seconds on, otherwise once a minute)
    if let Some(st) = &st {
        let name = s.label_for(st.event);
        let value = to_digits(&format_value(st.mode, st.seconds, s.display.taskbar_seconds, false, s.display.threshold_minutes > 60.0), &s.digits);
        let next_name = s.label_for(st.next);
        let label = match s.display.label_format.as_str() {
            "value" => ltr(&value),
            "name-time" => format!("{next_name} {}", ltr(&st.next.time_text)),
            _ => format!("{name} {}", ltr(&value)),
        };
        let tooltip = format!("{name} {}{}{next_name} {}", ltr(&value), s.string("tooltipSep"), ltr(&st.next.time_text));
        let show_title = cfg.indicator.enabled && cfg.indicator.panel_label;
        let shown = if show_title { label } else { String::new() };
        if shown != h.last_label {
            h.last_label = shown.clone();
            if let Some(t) = &h.tauri {
                let _ = t.tray.set_title(if show_title { Some(shown) } else { None::<String> });
                let _ = t.tray.set_tooltip(Some(tooltip));
            } else {
                #[cfg(target_os = "linux")]
                {
                    xu.label = Some(shown);
                    xu.tooltip = Some(tooltip);
                }
            }
        }
    }

    // ---- icon (style, and the dynamic ring on Windows)
    let light_taskbar = match cfg.indicator.tray_icon_style.as_str() {
        "light" => false, // "light icon" = drawn light, for dark taskbars
        "dark" => true,
        _ => crate::platform::taskbar_is_light().unwrap_or(false),
    };
    let dynamic = cfg!(windows) && cfg.indicator.enabled && cfg.indicator.dynamic_tray_icon;
    let (icon_key, progress, countdown, minutes) = match (&st, dynamic) {
        (Some(st), true) => {
            let mins = ((st.next.at - now) as f64 / 60_000.0).ceil() as u32;
            (format!("dyn-{light_taskbar}-{}-{}-{}", st.mode == Mode::Countdown, mins, (st.progress * 40.0) as i32), st.progress as f32, st.mode == Mode::Countdown, Some(mins))
        }
        _ => (format!("static-{light_taskbar}"), 0.0, false, None),
    };
    if icon_key != h.last_icon_key {
        h.last_icon_key = icon_key;
        if let Some(t) = &h.tauri {
            let image = if dynamic {
                crate::trayicon::render(&crate::trayicon::IconSpec { size: 32, progress, countdown, minutes_left: minutes, light_taskbar })
                    .map(|rgba| Image::new_owned(rgba, 32, 32))
            } else {
                png(if light_taskbar { ICON_DARK } else { ICON_LIGHT })
            };
            if let Some(img) = image {
                let _ = t.tray.set_icon(Some(img));
            }
        } else {
            #[cfg(target_os = "linux")]
            {
                let (name, bytes) = if light_taskbar { ("tray-xapp-dark.png", ICON_DARK) } else { ("tray-xapp-light.png", ICON_LIGHT) };
                xu.icon = crate::xapp::icon_file(app, name, bytes);
            }
        }
    }

    // ---- menu texts (once a minute)
    let minute = now / 60_000;
    if minute != h.last_minute {
        h.last_minute = minute;
        let texts = [
            s.string("showPanel"),
            s.string("stopAdhan"),
            s.string("widget"),
            s.string("miniWidget"),
            s.string("settings"),
            s.string("open"),
            s.string("quit"),
        ];
        let mut info: Vec<String> = Vec::new();
        if let Some(day) = s.day_at(now) {
            info.push(format!("{} {}", day.weekday, day.hijri));
            info.push(day.gregorian.clone());
            info.push(s.location.clone());
            let next_at = st.as_ref().map(|x| x.next.at);
            for e in s.timeline.iter().filter(|e| e.date == day.date) {
                let mark = if Some(e.at) == next_at {
                    format!("  {} {}", s.string("nextMark"), s.string("next"))
                } else if e.at <= now {
                    format!("  {}", s.string("passed"))
                } else {
                    String::new()
                };
                info.push(format!("{}   {}{}", s.label_for(e), ltr(&e.time_text), mark));
            }
        }
        if let Some(t) = &h.tauri {
            let [panel, stop, widget, mini, settings, open, quit] = &texts;
            let _ = t.panel.set_text(panel);
            let _ = t.stop.set_text(stop);
            let _ = t.widget.set_text(widget);
            let _ = t.mini.set_text(mini);
            let _ = t.settings.set_text(settings);
            let _ = t.open.set_text(open);
            let _ = t.quit.set_text(quit);
            let _ = t.widget.set_checked(cfg.main_widget.enabled);
            let _ = t.mini.set_checked(cfg.mini_widget.enabled);
            for (item, text) in t.info.iter().zip(&info) {
                let _ = item.set_text(text);
            }
        } else {
            #[cfg(target_os = "linux")]
            {
                xu.texts = Some(texts);
                xu.info = Some(info);
                xu.checked = Some((cfg.main_widget.enabled, cfg.mini_widget.enabled));
            }
        }
    }
    let playing = state.audio.state().playing;
    if h.last_stop != Some(playing) {
        h.last_stop = Some(playing);
        if let Some(t) = &h.tauri {
            let _ = t.stop.set_enabled(playing);
        } else {
            #[cfg(target_os = "linux")]
            {
                xu.stop_enabled = Some(playing);
            }
        }
    }
    #[cfg(target_os = "linux")]
    if h.tauri.is_none() {
        crate::xapp::apply(app, xu);
    }
}

/// Show or hide the tray icon (Windows: "hide the tray icon" while the taskbar pill is shown).
pub fn set_visible(state: &AppState, visible: bool) {
    if let Ok(g) = state.tray.lock() {
        if let Some(t) = g.as_ref().and_then(|h| h.tauri.as_ref()) {
            let _ = t.tray.set_visible(visible);
        }
    }
}
