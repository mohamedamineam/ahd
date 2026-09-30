//! Windows integrations (compiled and checked on Windows CI; see docs/WINDOWS_TESTS.md).

use std::sync::OnceLock;
use windows_sys::Win32::Foundation::{HWND, RECT};
use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
use windows_sys::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
use windows_sys::Win32::UI::Shell::{SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE, QUNS_QUIET_TIME, QUNS_RUNNING_D3D_FULL_SCREEN};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    FindWindowExW, FindWindowW, GetWindowRect, IsWindowVisible, SetWindowPos, EVENT_SYSTEM_FOREGROUND, HWND_BOTTOM, HWND_TOPMOST, SWP_ASYNCWINDOWPOS,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOOWNERZORDER, SWP_NOSIZE, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
};

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

/// Is the taskbar on screen? False while an auto-hidden taskbar is tucked away (only a sliver shows) or when
/// there is none (Explorer restarting).
pub fn taskbar_visible() -> bool {
    unsafe {
        let tray: HWND = FindWindowW(wide("Shell_TrayWnd").as_ptr(), std::ptr::null());
        if tray.is_null() || IsWindowVisible(tray) == 0 {
            return false;
        }
        let mut bar = RECT { left: 0, top: 0, right: 0, bottom: 0 };
        if GetWindowRect(tray, &mut bar) == 0 {
            return false;
        }
        let mut info: MONITORINFO = std::mem::zeroed();
        info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(MonitorFromWindow(tray, MONITOR_DEFAULTTONEAREST), &mut info) == 0 {
            return true;
        }
        let m = info.rcMonitor;
        let (w, h) = (bar.right - bar.left, bar.bottom - bar.top);
        // thickness of the taskbar that is on its monitor
        let shown = if w >= h { bar.bottom.min(m.bottom) - bar.top.max(m.top) } else { bar.right.min(m.right) - bar.left.max(m.left) };
        shown >= w.min(h) - 2
    }
}

/// Put one of our windows above all others (`topmost`) or below all others, without activating it.
pub fn set_z(hwnd: isize, topmost: bool) {
    unsafe {
        SetWindowPos(
            hwnd as HWND,
            if topmost { HWND_TOPMOST } else { HWND_BOTTOM },
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_ASYNCWINDOWPOS,
        );
    }
}

static ON_FOREGROUND: OnceLock<fn()> = OnceLock::new();

/// Calls `f` whenever another app's window comes to the front (a window clicked, the taskbar or Start opened).
/// Call it once, on the main thread: Windows delivers the event to the thread that asked, through its message loop.
pub fn on_foreground_change(f: fn()) {
    if ON_FOREGROUND.set(f).is_err() {
        return;
    }
    unsafe extern "system" fn changed(_: HWINEVENTHOOK, _: u32, _: HWND, _: i32, _: i32, _: u32, _: u32) {
        if let Some(f) = ON_FOREGROUND.get() {
            f();
        }
    }
    unsafe {
        SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, std::ptr::null_mut(), Some(changed), 0, 0, WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS);
    }
}

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

/// Running inside an MSIX package (Microsoft Store build)?
pub fn is_packaged() -> bool {
    std::env::current_exe()
        .map(|p| p.to_string_lossy().to_lowercase().contains("\\windowsapps\\"))
        .unwrap_or(false)
}
