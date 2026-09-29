//! Port of src/features/prayer/displayState.ts (brief §9) so the tray/indicator works without a webview.
//! Both implementations are tested against src/features/prayer/__fixtures__/display-cases.json.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Elapsed,
    Countdown,
}

/// Minimal event view used by the algorithm.
pub trait Event {
    fn id(&self) -> &str;
    fn at(&self) -> i64;
}

impl Event for crate::schedule::TimelineEvent {
    fn id(&self) -> &str {
        &self.id
    }
    fn at(&self) -> i64 {
        self.at
    }
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct DisplayState<'a, E: Event> {
    pub mode: Mode,
    pub event: &'a E,
    pub prev: &'a E,
    pub next: &'a E,
    /// Whole seconds: elapsed (floor) or remaining (ceil). Never negative.
    pub seconds: i64,
    pub progress: f64,
}

pub fn display_state<'a, E: Event>(now: i64, events: &'a [E], threshold_minutes: f64, include_sunrise: bool) -> Option<DisplayState<'a, E>> {
    let list: Vec<&'a E> = events.iter().filter(|e| include_sunrise || e.id() != "sunrise").collect();
    // first event strictly after now (events are sorted ascending)
    let idx = list.partition_point(|e| e.at() <= now);
    if idx == 0 || idx >= list.len() {
        return None;
    }
    let prev = list[idx - 1];
    let next = list[idx];
    let threshold_ms = (threshold_minutes * 60_000.0) as i64;
    let remaining = next.at() - now;
    let span = next.at() - prev.at();
    let progress = if span > 0 { ((now - prev.at()) as f64 / span as f64).clamp(0.0, 1.0) } else { 0.0 };
    if remaining <= threshold_ms {
        // ceil(remaining / 1000) for positive values
        let seconds = (remaining + 999).div_euclid(1000);
        Some(DisplayState { mode: Mode::Countdown, event: next, prev, next, seconds, progress })
    } else {
        let seconds = (now - prev.at()).div_euclid(1000);
        Some(DisplayState { mode: Mode::Elapsed, event: prev, prev, next, seconds, progress })
    }
}

fn pad2(n: i64) -> String {
    format!("{n:02}")
}

/// Signed value with a true minus sign (U+2212), Western digits (localise with `to_digits`).
pub fn format_value(mode: Mode, seconds: i64, with_seconds: bool, pad_hours: bool, long_countdown: bool) -> String {
    let s = seconds.max(0);
    let h = s / 3600;
    let m = (s % 3600) / 60;
    let sec = s % 60;
    match mode {
        Mode::Countdown => {
            if long_countdown {
                format!("\u{2212}{h}:{}:{}", pad2(m), pad2(sec))
            } else {
                format!("\u{2212}{}:{}", pad2(s / 60), pad2(sec))
            }
        }
        Mode::Elapsed => {
            let hh = if pad_hours { pad2(h) } else { h.to_string() };
            if with_seconds {
                format!("+{hh}:{}:{}", pad2(m), pad2(sec))
            } else {
                format!("+{hh}:{}", pad2(m))
            }
        }
    }
}

/// Western → Arabic-Indic digits when requested.
pub fn to_digits(s: &str, digits: &str) -> String {
    if digits != "arab" {
        return s.to_string();
    }
    s.chars()
        .map(|c| match c {
            '0'..='9' => char::from_u32(0x0660 + (c as u32 - '0' as u32)).unwrap_or(c),
            _ => c,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct FixtureEvent {
        id: String,
        at: i64,
    }
    impl Event for FixtureEvent {
        fn id(&self) -> &str {
            &self.id
        }
        fn at(&self) -> i64 {
            self.at
        }
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Settings {
        threshold_minutes: f64,
        include_sunrise: bool,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Expected {
        mode: String,
        event: String,
        event_at: i64,
        seconds: i64,
        value: Option<String>,
        value_short: Option<String>,
        long_countdown: Option<bool>,
    }
    #[derive(Deserialize)]
    struct Case {
        name: String,
        now: i64,
        settings: Settings,
        expected: Option<Expected>,
    }
    #[derive(Deserialize)]
    struct Fixture {
        timeline: Vec<FixtureEvent>,
        cases: Vec<Case>,
    }

    #[test]
    fn shared_fixture_cases() {
        let fx: Fixture = serde_json::from_str(include_str!("../../src/features/prayer/__fixtures__/display-cases.json")).unwrap();
        for c in &fx.cases {
            let s = display_state(c.now, &fx.timeline, c.settings.threshold_minutes, c.settings.include_sunrise);
            match (&c.expected, s) {
                (None, None) => {}
                (Some(exp), Some(st)) => {
                    let mode = if st.mode == Mode::Countdown { "countdown" } else { "elapsed" };
                    assert_eq!(mode, exp.mode, "{}", c.name);
                    assert_eq!(st.event.id(), exp.event, "{}", c.name);
                    assert_eq!(st.event.at(), exp.event_at, "{}", c.name);
                    assert_eq!(st.seconds, exp.seconds, "{}", c.name);
                    if let Some(v) = &exp.value {
                        assert_eq!(&format_value(st.mode, st.seconds, true, true, exp.long_countdown.unwrap_or(false)), v, "{}", c.name);
                    }
                    if let Some(v) = &exp.value_short {
                        assert_eq!(&format_value(st.mode, st.seconds, false, false, false), v, "{}", c.name);
                    }
                }
                (e, s) => panic!("{}: expected {:?}, got {:?}", c.name, e.is_some(), s.map(|x| x.seconds)),
            }
        }
    }

    #[test]
    fn arabic_indic_digits() {
        assert_eq!(to_digits("+1:12", "arab"), "+١:١٢");
        assert_eq!(to_digits("+1:12", "latn"), "+1:12");
    }
}
