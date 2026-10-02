//! The schedule the main window computes (src/features/prayer/schedule.ts) and hands to Rust.
//! Rust owns firing (adhan, reminders) and the tray/indicator text, so it works with every window closed.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineEvent {
    pub id: String,
    pub at: i64,
    pub friday: bool,
    pub date: String,
    pub label: String,
    pub time_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDay {
    pub date: String,
    pub start: i64,
    pub end: i64,
    pub hijri: String,
    pub gregorian: String,
    pub weekday: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FireAudio {
    pub sound: String,
    pub volume: f32,
    pub fade_in: bool,
    pub stop_at: Option<f64>,
    /// "adhan" | "tone"
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FireNotification {
    pub title: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FireEvent {
    pub key: String,
    pub at: i64,
    /// "adhan" | "reminder" | "adhkar" | "friday"
    pub kind: String,
    pub prayer: Option<String>,
    pub audio: Option<FireAudio>,
    pub notification: Option<FireNotification>,
    pub toast: bool,
    pub route: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayConfig {
    /// "halfway" | "threshold" (older cached schedules have no value: the new default)
    #[serde(default = "default_countdown_start")]
    pub countdown_start: String,
    pub threshold_minutes: f64,
    pub include_sunrise: bool,
    pub taskbar_seconds: bool,
    pub jumuah: bool,
    /// "name-value" | "value" | "name-time" | "two-value" | "two-time" | "next-time-value" (see LabelFormat in
    /// src/features/settings/schema.ts)
    pub label_format: String,
}

fn default_countdown_start() -> String {
    "halfway".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchedulePayload {
    pub version: u32,
    pub generated_at: i64,
    pub lang: String,
    pub digits: String,
    pub location: String,
    pub zone: String,
    pub labels: HashMap<String, String>,
    pub strings: HashMap<String, String>,
    pub display: DisplayConfig,
    pub missed_grace_minutes: f64,
    pub toast_auto_hide_seconds: f64,
    #[serde(default)]
    pub minutes_text: Vec<String>,
    pub timeline: Vec<TimelineEvent>,
    pub days: Vec<ScheduleDay>,
    pub fire: Vec<FireEvent>,
}

impl SchedulePayload {
    pub fn string(&self, key: &str) -> String {
        self.strings.get(key).cloned().unwrap_or_default()
    }

    pub fn label_for(&self, ev: &TimelineEvent) -> String {
        if self.display.jumuah && ev.id == "dhuhr" && ev.friday {
            if let Some(l) = self.labels.get("jumuah") {
                return l.clone();
            }
        }
        ev.label.clone()
    }

    pub fn day_at(&self, now: i64) -> Option<&ScheduleDay> {
        self.days.iter().find(|d| now >= d.start && now < d.end)
    }

    pub fn minutes_phrase(&self, minutes: i64) -> String {
        let m = minutes.max(0) as usize;
        self.minutes_text.get(m).cloned().unwrap_or_else(|| m.to_string())
    }
}
