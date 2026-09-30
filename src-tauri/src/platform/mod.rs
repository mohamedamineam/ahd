//! Platform facts and integrations (desktop environment, taskbar, full-screen/DND detection).

use serde::Serialize;

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(windows)]
pub mod windows;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: &'static str,
    pub desktop: Option<String>,
    pub session_type: Option<&'static str>,
    pub flatpak: bool,
    pub store: Option<&'static str>,
    pub tray_title: bool,
    pub status_notifier: Option<bool>,
    pub xwayland: bool,
    pub version: String,
}

pub fn info(version: &str) -> PlatformInfo {
    #[cfg(target_os = "linux")]
    {
        let flatpak = linux::is_flatpak();
        PlatformInfo {
            os: "linux",
            desktop: std::env::var("XDG_CURRENT_DESKTOP").ok(),
            session_type: Some(linux::session_type()),
            flatpak,
            store: if flatpak { Some("flatpak") } else { None },
            tray_title: true,
            status_notifier: linux::status_notifier_available(),
            xwayland: std::env::var("GDK_BACKEND").map(|v| v == "x11").unwrap_or(false) && std::env::var("WAYLAND_DISPLAY").is_ok(),
            version: version.to_string(),
        }
    }
    #[cfg(windows)]
    {
        PlatformInfo {
            os: "windows",
            desktop: None,
            session_type: None,
            flatpak: false,
            store: if windows::is_packaged() { Some("msix") } else { None },
            tray_title: false,
            status_notifier: None,
            xwayland: false,
            version: version.to_string(),
        }
    }
    #[cfg(not(any(target_os = "linux", windows)))]
    {
        PlatformInfo {
            os: "macos",
            desktop: None,
            session_type: None,
            flatpak: false,
            store: None,
            tray_title: true,
            status_notifier: None,
            xwayland: false,
            version: version.to_string(),
        }
    }
}

/// True when a full-screen app (game, presentation, film) is in front.
pub fn fullscreen_app_active() -> bool {
    #[cfg(windows)]
    {
        windows::fullscreen_app_active()
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// True when the system is in Do Not Disturb / Focus assist.
pub fn do_not_disturb_active() -> bool {
    #[cfg(windows)]
    {
        windows::quiet_hours()
    }
    #[cfg(target_os = "linux")]
    {
        linux::gnome_dnd()
    }
    #[cfg(not(any(windows, target_os = "linux")))]
    {
        false
    }
}

/// Started at Windows login by the Microsoft Store build's startup task? (It cannot pass `--minimized`.)
pub fn started_by_store_startup() -> bool {
    #[cfg(windows)]
    {
        windows::started_by_startup_task()
    }
    #[cfg(not(windows))]
    {
        false
    }
}

/// Microsoft Store build: start with Windows through the package's startup task. Blocks: call it off the main thread.
#[cfg(windows)]
pub fn set_store_startup(enable: bool) -> Result<(), String> {
    windows::set_startup_task(enable).map_err(|e| e.to_string())
}

/// Light taskbar? (None when unknown)
pub fn taskbar_is_light() -> Option<bool> {
    #[cfg(windows)]
    {
        windows::system_uses_light_theme()
    }
    #[cfg(not(windows))]
    {
        None
    }
}
