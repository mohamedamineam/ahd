//! Native notifications. Silent (Ahd plays its own adhan). On Linux the notification carries a default
//! action so clicking it opens the right screen; elsewhere the plugin's notification is used.

use tauri::{AppHandle, Runtime};

pub fn show<R: Runtime>(app: &AppHandle<R>, title: &str, body: &str, route: Option<String>, icon: Option<&std::path::Path>) {
    #[cfg(target_os = "linux")]
    {
        let app = app.clone();
        let (title, body) = (title.to_string(), body.to_string());
        let icon = icon.map(|p| p.to_string_lossy().to_string());
        std::thread::spawn(move || {
            let mut n = notify_rust::Notification::new();
            n.appname("Ahd").summary(&title).body(&body).action("default", "Open").hint(notify_rust::Hint::SuppressSound(true));
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
    #[cfg(not(target_os = "linux"))]
    {
        use tauri_plugin_notification::NotificationExt;
        let _ = (route, icon);
        if let Err(e) = app.notification().builder().title(title).body(body).silent().show() {
            log::warn!("notification failed: {e}");
        }
    }
}
