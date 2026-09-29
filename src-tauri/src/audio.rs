//! Adhan playback (brief §10.2): rodio + Symphonia on a dedicated thread.
//! - Opens the current default output device for every sound, so device changes (headphones, HDMI) are
//!   followed and a missing device only affects that one sound.
//! - 2 s fade-in (optional), 300 ms fade-out on stop, optional stop point for the "short" mode.
//! - A synthesised two-note chime for notification tones (original sound, no licence needed).

use rodio::{source::Source, Decoder, DeviceSinkBuilder, MixerDeviceSink, Player};
use serde::Serialize;
use std::fs::File;
use std::num::NonZero;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioState {
    pub playing: bool,
    /// "adhan" | "preview" | "tone"
    pub kind: Option<String>,
    pub prayer: Option<String>,
    pub sound: Option<String>,
    pub started_at: Option<i64>,
    pub duration: Option<f64>,
    pub error: Option<String>,
}

pub struct PlayRequest {
    /// None → the synthesised chime.
    pub path: Option<PathBuf>,
    pub volume: f32,
    pub fade_in: bool,
    pub stop_at: Option<f64>,
    pub kind: &'static str,
    pub prayer: Option<String>,
    pub sound: Option<String>,
    pub duration: Option<f64>,
}

enum Cmd {
    Play(PlayRequest),
    Stop { fade_ms: u64 },
}

#[derive(Clone)]
pub struct AudioHandle {
    tx: Sender<Cmd>,
    state: Arc<Mutex<AudioState>>,
}

pub type StateCallback = Box<dyn Fn(AudioState) + Send + 'static>;

impl AudioHandle {
    pub fn spawn(on_state: StateCallback) -> Self {
        let (tx, rx) = mpsc::channel();
        let state = Arc::new(Mutex::new(AudioState::default()));
        let st = state.clone();
        std::thread::Builder::new()
            .name("ahd-audio".into())
            .spawn(move || run(rx, st, on_state))
            .expect("audio thread");
        Self { tx, state }
    }

    pub fn play(&self, req: PlayRequest) {
        let _ = self.tx.send(Cmd::Play(req));
    }

    pub fn stop(&self) {
        let _ = self.tx.send(Cmd::Stop { fade_ms: 300 });
    }

    pub fn state(&self) -> AudioState {
        self.state.lock().map(|s| s.clone()).unwrap_or_default()
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

struct Current {
    _sink: MixerDeviceSink,
    player: Player,
    volume: f32,
}

fn run(rx: Receiver<Cmd>, state: Arc<Mutex<AudioState>>, on_state: StateCallback) {
    let mut current: Option<Current> = None;
    let set = |s: AudioState| {
        if let Ok(mut g) = state.lock() {
            if *g == s {
                return;
            }
            *g = s.clone();
        }
        on_state(s);
    };

    loop {
        match rx.recv_timeout(Duration::from_millis(120)) {
            Ok(Cmd::Play(req)) => {
                if let Some(c) = current.take() {
                    fade_out(&c, 150);
                }
                match start(&req) {
                    Ok(c) => {
                        current = Some(c);
                        set(AudioState {
                            playing: true,
                            kind: Some(req.kind.to_string()),
                            prayer: req.prayer.clone(),
                            sound: req.sound.clone(),
                            started_at: Some(now_ms()),
                            duration: req.duration,
                            error: None,
                        });
                    }
                    Err(e) => {
                        log::warn!("audio: cannot play ({e})");
                        set(AudioState { error: Some(e), ..AudioState::default() });
                    }
                }
            }
            Ok(Cmd::Stop { fade_ms }) => {
                if let Some(c) = current.take() {
                    fade_out(&c, fade_ms);
                }
                set(AudioState::default());
            }
            Err(RecvTimeoutError::Timeout) => {
                if current.as_ref().is_some_and(|c| c.player.empty()) {
                    current = None;
                    set(AudioState::default());
                }
            }
            Err(RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn start(req: &PlayRequest) -> Result<Current, String> {
    let mut sink = DeviceSinkBuilder::open_default_sink().map_err(|e| format!("no_output_device: {e}"))?;
    sink.log_on_drop(false);
    let player = Player::connect_new(sink.mixer());
    player.set_volume(req.volume.clamp(0.0, 1.0));
    match &req.path {
        None => player.append(Chime::new()),
        Some(path) => {
            let file = File::open(path).map_err(|e| format!("open {}: {e}", path.display()))?;
            let decoder = Decoder::try_from(file).map_err(|e| format!("decode: {e}"))?;
            let fade = if req.fade_in { Duration::from_secs(2) } else { Duration::from_millis(20) };
            match req.stop_at {
                Some(secs) if secs > 0.5 => {
                    let d = Duration::from_secs_f64(secs);
                    // a short fade at the cut so the short adhan ends softly
                    player.append(decoder.fade_in(fade).take_duration(d).fade_out(Duration::from_millis(900)));
                }
                _ => player.append(decoder.fade_in(fade)),
            }
        }
    }
    Ok(Current { _sink: sink, player, volume: req.volume.clamp(0.0, 1.0) })
}

fn fade_out(c: &Current, ms: u64) {
    let steps = 12u64;
    for i in (0..steps).rev() {
        c.player.set_volume(c.volume * i as f32 / steps as f32);
        std::thread::sleep(Duration::from_millis(ms / steps));
    }
    c.player.stop();
}

/// Soft two-note bell (E5 → A5) with harmonic partials and exponential decay, 44.1 kHz mono.
pub struct Chime {
    n: u64,
    total: u64,
}

impl Chime {
    const RATE: u32 = 44_100;
    pub fn new() -> Self {
        Self { n: 0, total: (Self::RATE as f64 * 1.9) as u64 }
    }
    fn note(t: f64, start: f64, f: f64) -> f64 {
        if t < start {
            return 0.0;
        }
        let x = t - start;
        let attack = (x / 0.006).min(1.0);
        let env = attack * (-x / 0.55).exp();
        let w = 2.0 * std::f64::consts::PI * f * x;
        env * (w.sin() + 0.28 * (2.0 * w).sin() + 0.09 * (3.0 * w).sin())
    }
}

impl Default for Chime {
    fn default() -> Self {
        Self::new()
    }
}

impl Iterator for Chime {
    type Item = rodio::Sample;
    fn next(&mut self) -> Option<Self::Item> {
        if self.n >= self.total {
            return None;
        }
        let t = self.n as f64 / Self::RATE as f64;
        self.n += 1;
        let v = 0.26 * (Self::note(t, 0.0, 659.25) + Self::note(t, 0.32, 880.0));
        Some(v as rodio::Sample)
    }
}

impl Source for Chime {
    fn current_span_len(&self) -> Option<usize> {
        Some((self.total - self.n) as usize)
    }
    fn channels(&self) -> rodio::ChannelCount {
        NonZero::new(1).unwrap()
    }
    fn sample_rate(&self) -> rodio::SampleRate {
        NonZero::new(Self::RATE).unwrap()
    }
    fn total_duration(&self) -> Option<Duration> {
        Some(Duration::from_secs_f64(self.total as f64 / Self::RATE as f64))
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Analysis {
    pub duration: f64,
    /// Suggested end of the first takbir (for the "short" adhan mode).
    pub short_end: Option<f64>,
}

/// Decode a file fully: duration, and the first long pause after the opening takbir.
pub fn analyze(path: &Path) -> Result<Analysis, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let decoder = Decoder::try_from(file).map_err(|e| format!("not_audio: {e}"))?;
    let channels = decoder.channels().get() as usize;
    let rate = decoder.sample_rate().get() as usize;
    let window = (rate / 20).max(1) * channels; // 50 ms
    let mut rms: Vec<f32> = Vec::new();
    let (mut acc, mut count, mut total) = (0.0f64, 0usize, 0usize);
    for s in decoder {
        let v = s as f64;
        acc += v * v;
        count += 1;
        total += 1;
        if count == window {
            rms.push((acc / count as f64).sqrt() as f32);
            acc = 0.0;
            count = 0;
        }
    }
    let duration = total as f64 / (rate * channels) as f64;
    Ok(Analysis { duration, short_end: first_pause(&rms, 0.05) })
}

/// `rms` in 50 ms windows → start time (s) of the first pause that follows ≥ 2 s of voice. Tries a strict
/// silence first (≥ 0.45 s under 9 % of peak), then relaxed passes for reverberant recordings.
fn first_pause(rms: &[f32], window_s: f64) -> Option<f64> {
    let max = rms.iter().cloned().fold(0.0f32, f32::max);
    if max <= 0.0 {
        return None;
    }
    let start = rms.iter().position(|&v| v >= max * 0.22)?;
    let min_voice = (2.0 / window_s) as usize;
    for (off_ratio, pause_s) in [(0.09f32, 0.45f64), (0.16, 0.35), (0.24, 0.30)] {
        let off = max * off_ratio;
        let min_pause = (pause_s / window_s) as usize;
        let mut quiet = 0usize;
        for (i, &v) in rms.iter().enumerate().skip(start + min_voice) {
            if (i as f64) * window_s > 40.0 {
                break;
            }
            if v < off {
                quiet += 1;
                if quiet >= min_pause {
                    let pause_start = (i + 1 - quiet) as f64 * window_s;
                    return Some((pause_start + 0.3).clamp(3.0, 45.0));
                }
            } else {
                quiet = 0;
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chime_has_expected_length_and_is_bounded() {
        let c = Chime::new();
        let samples: Vec<f32> = c.collect();
        assert_eq!(samples.len(), (44_100.0 * 1.9) as usize);
        assert!(samples.iter().all(|s| s.abs() <= 1.0));
    }

    #[test]
    fn detects_the_first_pause() {
        // 3 s of voice, 0.6 s silence, then voice again (50 ms windows)
        let mut rms = vec![0.5f32; 60];
        rms.extend(vec![0.01f32; 12]);
        rms.extend(vec![0.5f32; 40]);
        let p = first_pause(&rms, 0.05).unwrap();
        assert!((p - 3.3).abs() < 0.06, "{p}");
    }

    /// Run with: cargo test -- --ignored analyze_bundled --nocapture
    #[test]
    #[ignore]
    fn analyze_bundled() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../assets/adhan");
        for e in std::fs::read_dir(dir).unwrap().flatten() {
            if e.path().extension().is_some_and(|x| x == "mp3") {
                println!("{:?} {:?}", e.file_name(), analyze(&e.path()));
            }
        }
    }
}
