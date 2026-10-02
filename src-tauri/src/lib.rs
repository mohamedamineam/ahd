//! 3ahd (عهد) — desktop prayer times companion. Rust side: scheduler, adhan audio, tray/indicator,
//! notifications, extra windows, bundled datasets.

mod adhans;
mod audio;
mod commands;
mod db_migrations;
mod display;
mod library;
mod notify;
mod places;
mod platform;
mod schedule;
mod scheduler;
mod state;
mod tray;
mod trayicon;
mod windows;
#[cfg(target_os = "linux")]
mod xapp;

use state::AppState;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, RwLock};
use tauri::{Emitter, Manager, WindowEvent};

/// Flag file for "Compatibility mode (XWayland)", read before the toolkit starts (see main.rs).
pub fn x11_compat_flag() -> Option<PathBuf> {
    let base = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))?;
    Some(base.join("io.github.mohamedamineam.Ahd").join("x11-compat"))
}

/// The app ID was a placeholder (io.github.ahdapp.Ahd) before the project had its GitHub account. Move data kept
/// under the old ID (settings, database, adhan imports, library, WebView storage) so nothing is lost. Runs first in
/// main, before any window or plugin opens those folders.
pub fn migrate_app_id() {
    const OLD: &str = "io.github.ahdapp.Ahd";
    const NEW: &str = "io.github.mohamedamineam.Ahd";
    for base in app_base_dirs() {
        let (old, new) = (base.join(OLD), base.join(NEW));
        if old.is_dir() && !new.exists() {
            if let Err(e) = std::fs::rename(&old, &new) {
                eprintln!("ahd: could not move {} to {}: {e}", old.display(), new.display());
            }
        }
    }
}

fn app_base_dirs() -> Vec<PathBuf> {
    let env = |k: &str| std::env::var_os(k).filter(|v| !v.is_empty()).map(PathBuf::from);
    #[cfg(target_os = "linux")]
    {
        let home = env("HOME");
        let or_home = |k: &str, rel: &str| env(k).or_else(|| home.as_ref().map(|h| h.join(rel)));
        [or_home("XDG_CONFIG_HOME", ".config"), or_home("XDG_DATA_HOME", ".local/share"), or_home("XDG_CACHE_HOME", ".cache")].into_iter().flatten().collect()
    }
    #[cfg(windows)]
    {
        [env("APPDATA"), env("LOCALAPPDATA")].into_iter().flatten().collect()
    }
    #[cfg(not(any(target_os = "linux", windows)))]
    {
        let _ = env;
        Vec::new()
    }
}

/// Linux environment, set at the very start of main (before GTK and WebKit start):
/// - Wayland + flag set: run through XWayland so widgets can be positioned (brief §12);
/// - WebKitGTK's DMA-BUF renderer flickers and leaves see-through areas on some drivers (notably hybrid
///   Intel/NVIDIA laptops); the shared-memory renderer is used instead unless the user set the variable.
pub fn apply_x11_compat() {
    #[cfg(target_os = "linux")]
    {
        let wayland = std::env::var("XDG_SESSION_TYPE").map(|v| v == "wayland").unwrap_or(false) || std::env::var_os("WAYLAND_DISPLAY").is_some();
        if wayland && std::env::var_os("GDK_BACKEND").is_none() && x11_compat_flag().is_some_and(|f| f.exists()) {
            // SAFETY: called at the very start of main, before any other thread exists.
            unsafe { std::env::set_var("GDK_BACKEND", "x11") };
        }
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            // SAFETY: as above.
            unsafe { std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1") };
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let started_minimized = std::env::args().any(|a| a == "--minimized") || platform::started_by_store_startup();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            windows::show_main(app, None);
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: None }),
                ])
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(5))
                .max_file_size(1_000_000)
                .level(log::LevelFilter::Info)
                .level_for("zbus", log::LevelFilter::Warn)
                .level_for("tracing", log::LevelFilter::Warn)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::new().add_migrations(db_migrations::DB_URL, db_migrations::migrations()).build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_positioner::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&[windows::WIDGET, windows::MINI, windows::PILL, windows::TOAST])
                .with_state_flags(tauri_plugin_window_state::StateFlags::all() & !tauri_plugin_window_state::StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(feature = "updater")]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(move |app| {
            let version = app.package_info().version.to_string();
            let resource = app.path().resource_dir()?;
            let data = app.path().app_data_dir()?;
            let _ = std::fs::create_dir_all(&data);

            let handle = app.handle().clone();
            let audio = audio::AudioHandle::spawn(Box::new(move |s| {
                let _ = handle.emit("ahd://audio", &s);
            }));

            // notification icon (Linux notifications take a file path)
            let notification_icon = app.path().app_cache_dir().ok().and_then(|dir| {
                let _ = std::fs::create_dir_all(&dir);
                let p = dir.join("ahd-notification.png");
                std::fs::write(&p, include_bytes!("../icons/128x128.png")).ok().map(|_| p)
            });

            app.manage(AppState {
                schedule: RwLock::new(None),
                fired: Mutex::new(HashSet::new()),
                initialized: AtomicBool::new(false),
                audio,
                adhans: adhans::Adhans::new(resource.join("adhan"), &data),
                places: places::Places::new(resource.join("data").join("cities.sqlite"), &version),
                config: RwLock::new(windows::WindowsConfig::default()),
                tray: Mutex::new(None),
                started_minimized,
                shortcut: Mutex::new(None),
                notification_icon,
                app_ready: AtomicBool::new(false),
                toast: Mutex::new(None),
            });

            match tray::create(app.handle()) {
                Ok(t) => {
                    if let Ok(mut g) = app.state::<AppState>().tray.lock() {
                        *g = Some(t);
                    }
                }
                Err(e) => log::error!("tray: {e}"),
            }
            // widgets and the pill keep their layer when other apps come to the front (setup runs on the main thread)
            #[cfg(windows)]
            windows::layers::install();
            tauri::async_runtime::spawn(scheduler::run(app.handle().clone()));

            // Safety net: show the main window even if the frontend never reports ready.
            if !started_minimized {
                let h = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(6)).await;
                    let st = h.state::<AppState>();
                    if !st.app_ready.swap(true, Ordering::SeqCst) {
                        windows::show_main(&h, None);
                    }
                });
            }
            log::info!("3ahd {version} started (minimized: {started_minimized})");
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. } = event {
                    windows::fit_main_zoom(window.app_handle());
                }
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let keep = window.app_handle().state::<AppState>().config.read().map(|c| c.keep_in_tray).unwrap_or(true);
                    if keep {
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        window.app_handle().exit(0);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_schedule,
            commands::toast_payload,
            commands::fit_toast,
            commands::get_schedule,
            commands::stop_adhan,
            commands::audio_state,
            commands::play_preview,
            commands::play_tone,
            commands::test_adhan,
            commands::test_notification,
            commands::list_adhans,
            commands::import_adhan,
            commands::delete_adhan,
            commands::update_adhan,
            commands::search_places,
            commands::nearest_place,
            commands::nominatim_search,
            commands::show_main,
            commands::pill_drag,
            commands::hide_self,
            commands::toast_action,
            commands::apply_windows,
            commands::set_stop_shortcut,
            commands::reset_widget_position,
            commands::platform_info,
            commands::taskbar_is_light,
            commands::set_wayland_compat,
            commands::export_file,
            commands::read_import_file,
            commands::open_logs_folder,
            commands::app_ready,
            commands::library_download,
            commands::library_delete,
            commands::open_library_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running 3ahd");
}
