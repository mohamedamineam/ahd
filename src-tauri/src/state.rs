use crate::adhans::Adhans;
use crate::audio::AudioHandle;
use crate::places::Places;
use crate::schedule::SchedulePayload;
use crate::windows::WindowsConfig;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, RwLock};

pub struct AppState {
    pub schedule: RwLock<Option<Arc<SchedulePayload>>>,
    /// keys of events already handled (fired, skipped or superseded)
    pub fired: Mutex<HashSet<String>>,
    pub initialized: AtomicBool,
    pub audio: AudioHandle,
    pub adhans: Adhans,
    pub places: Places,
    pub config: RwLock<WindowsConfig>,
    pub tray: Mutex<Option<crate::tray::TrayHandles>>,
    pub started_minimized: bool,
    pub shortcut: Mutex<Option<String>>,
    pub notification_icon: Option<PathBuf>,
    pub app_ready: AtomicBool,
    /// the last adhan-window payload (see windows::show_toast)
    pub toast: Mutex<Option<serde_json::Value>>,
}
