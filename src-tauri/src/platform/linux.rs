use std::process::Command;

pub fn is_flatpak() -> bool {
    std::env::var("FLATPAK_ID").is_ok() || std::path::Path::new("/.flatpak-info").exists()
}

pub fn session_type() -> &'static str {
    match std::env::var("XDG_SESSION_TYPE").as_deref() {
        Ok("wayland") => "wayland",
        Ok("x11") => "x11",
        _ if std::env::var("WAYLAND_DISPLAY").is_ok() => "wayland",
        _ if std::env::var("DISPLAY").is_ok() => "x11",
        _ => "unknown",
    }
}

/// Is a StatusNotifierItem host (tray) running on the session bus? None if we cannot tell.
pub fn status_notifier_available() -> Option<bool> {
    let out = Command::new("dbus-send")
        .args([
            "--session",
            "--print-reply",
            "--dest=org.freedesktop.DBus",
            "/org/freedesktop/DBus",
            "org.freedesktop.DBus.NameHasOwner",
            "string:org.kde.StatusNotifierWatcher",
        ])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    Some(text.contains("boolean true"))
}

/// GNOME "Do Not Disturb" (show-banners = false). Other desktops: false.
pub fn gnome_dnd() -> bool {
    Command::new("gsettings")
        .args(["get", "org.gnome.desktop.notifications", "show-banners"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "false")
        .unwrap_or(false)
}
