//! Native notifications. Silent (3ahd plays its own adhan); clicking one opens the right screen.

use tauri::{AppHandle, Runtime};

pub fn show<R: Runtime>(app: &AppHandle<R>, title: &str, body: &str, route: Option<String>, icon: Option<&std::path::Path>) {
    #[cfg(target_os = "linux")]
    {
        let app = app.clone();
        let (title, body) = (title.to_string(), body.to_string());
        let icon = icon.map(|p| p.to_string_lossy().to_string());
        std::thread::spawn(move || {
            let mut n = notify_rust::Notification::new();
            n.appname("3ahd").summary(&title).body(&body).action("default", "Open").hint(notify_rust::Hint::SuppressSound(true));
            if let Some(i) = &icon {
                n.icon(i);
            }
            match n.show() {
                Ok(handle) => handle.wait_for_action(|action| {
                    if action == "default" {
                        crate::windows::show_main(&app, route.clone());
                    }
                }),
                Err(e) => log::warn!("notification failed: {e}"),
            }
        });
    }
    #[cfg(windows)]
    {
        let _ = icon; // a toast carries the app's own icon
        let app = app.clone();
        let (title, body, id) = (title.to_string(), body.to_string(), toast_app_id(&app));
        std::thread::spawn(move || {
            let toast = tauri_winrt_notification::Toast::new(&id).title(&title).text1(&body).sound(None).on_activated(move |_| {
                crate::windows::show_main(&app, route.clone());
                Ok(())
            });
            if let Err(e) = toast.show() {
                log::warn!("notification failed ({id}): {e}");
            }
        });
    }
    #[cfg(not(any(target_os = "linux", windows)))]
    {
        use tauri_plugin_notification::NotificationExt;
        let _ = (route, icon);
        if let Err(e) = app.notification().builder().title(title).body(body).silent().show() {
            log::warn!("notification failed: {e}");
        }
    }
}

/// The AppUserModelID a toast is sent under: Windows shows it only when the ID belongs to the app.
#[cfg(windows)]
fn toast_app_id<R: Runtime>(app: &AppHandle<R>) -> String {
    // Microsoft Store build: the package's own ID (Windows dropped every toast sent under the identifier
    // below, which tauri-plugin-notification uses whatever the build)
    if let Some(id) = crate::platform::windows::package_app_id() {
        return id.to_string();
    }
    // a development build has no Start-menu shortcut: PowerShell's ID, as tauri-plugin-notification does
    let dev = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.ends_with("target\\debug") || dir.ends_with("target\\release")))
        .unwrap_or(false);
    if dev {
        return tauri_winrt_notification::Toast::POWERSHELL_APP_ID.to_string();
    }
    // installed with the .exe or .msi: their Start-menu shortcut carries the identifier as its ID
    app.config().identifier.clone()
}
