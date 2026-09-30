//! Windows integrations (compiled and checked on Windows CI; see docs/WINDOWS_TESTS.md).

use windows_sys::Win32::Foundation::{HWND, RECT};
use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
use windows_sys::Win32::UI::Shell::{SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE, QUNS_QUIET_TIME, QUNS_RUNNING_D3D_FULL_SCREEN};
use windows_sys::Win32::UI::WindowsAndMessaging::{FindWindowExW, FindWindowW, GetWindowRect};

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize\SystemUsesLightTheme
pub fn system_uses_light_theme() -> Option<bool> {
    let key = wide("Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize");
    let name = wide("SystemUsesLightTheme");
    let mut value: u32 = 0;
    let mut size = std::mem::size_of::<u32>() as u32;
    let rc = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            key.as_ptr(),
            name.as_ptr(),
            RRF_RT_REG_DWORD,
            std::ptr::null_mut(),
            &mut value as *mut u32 as *mut _,
            &mut size,
        )
    };
    if rc == 0 {
        Some(value != 0)
    } else {
        None
    }
}

fn notification_state() -> Option<i32> {
    let mut state = 0;
    let hr = unsafe { SHQueryUserNotificationState(&mut state) };
    if hr >= 0 {
        Some(state)
    } else {
        None
    }
}

pub fn fullscreen_app_active() -> bool {
    matches!(notification_state(), Some(s) if s == QUNS_BUSY || s == QUNS_RUNNING_D3D_FULL_SCREEN || s == QUNS_PRESENTATION_MODE)
}

pub fn quiet_hours() -> bool {
    matches!(notification_state(), Some(s) if s == QUNS_QUIET_TIME)
}

/// Screen rectangle of the taskbar and of its notification area (tray + clock), if found.
pub fn taskbar_rects() -> Option<(RECT, Option<RECT>)> {
    unsafe {
        let tray: HWND = FindWindowW(wide("Shell_TrayWnd").as_ptr(), std::ptr::null());
        if tray.is_null() {
            return None;
        }
        let mut bar = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        if GetWindowRect(tray, &mut bar) == 0 {
            return None;
        }
        let notify = FindWindowExW(tray, std::ptr::null_mut(), wide("TrayNotifyWnd").as_ptr(), std::ptr::null());
        let mut area = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        let notify_rect = if !notify.is_null() && GetWindowRect(notify, &mut area) != 0 { Some(area) } else { None };
        Some((bar, notify_rect))
    }
}

/// Running inside an MSIX package (Microsoft Store build)?
/// Startup task declared in packaging/msix/AppxManifest.xml (Microsoft Store build).
const STARTUP_TASK_ID: &str = "3ahdStartup";

/// Microsoft Store build: started at Windows login by its startup task? A startup task cannot pass `--minimized`,
/// so this is how the Store build knows to start in the tray.
pub fn started_by_startup_task() -> bool {
    use ::windows::ApplicationModel::Activation::ActivationKind;
    use ::windows::ApplicationModel::AppInstance;
    is_packaged() && AppInstance::GetActivatedEventArgs().and_then(|a| a.Kind()).is_ok_and(|k| k == ActivationKind::StartupTask)
}

/// Microsoft Store build: turn its startup task on or off (the other builds use the Run key through
/// tauri-plugin-autostart). Blocks until Windows answers: call it off the main thread.
pub fn set_startup_task(enable: bool) -> ::windows::core::Result<()> {
    use ::windows::ApplicationModel::{StartupTask, StartupTaskState};
    let task = StartupTask::GetAsync(&::windows::core::HSTRING::from(STARTUP_TASK_ID))?.join()?;
    let state = task.State()?;
    if enable && state == StartupTaskState::Disabled {
        // no effect when the user turned it off in Task Manager (DisabledByUser): Windows keeps that choice theirs
        task.RequestEnableAsync()?.join()?;
    } else if !enable && state == StartupTaskState::Enabled {
        task.Disable()?;
    }
    Ok(())
}

pub fn is_packaged() -> bool {
    std::env::current_exe()
        .map(|p| p.to_string_lossy().to_lowercase().contains("\\windowsapps\\"))
        .unwrap_or(false)
}
