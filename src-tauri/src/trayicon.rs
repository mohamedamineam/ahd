//! Dynamic tray icon (Windows, brief §11.3): a progress ring between the previous and next prayer —
//! sage while time is elapsing, ochre during the countdown — with the minutes left as a number.
//! Pure Rust rasterising (tiny-skia) so it can be tested on any OS.

use tiny_skia::{FillRule, LineCap, Paint, PathBuilder, Pixmap, Stroke, Transform};

pub struct IconSpec {
    pub size: u32,
    pub progress: f32,
    pub countdown: bool,
    pub minutes_left: Option<u32>,
    /// true when the taskbar is light (draw dark ink)
    pub light_taskbar: bool,
}

// 3×5 grid digits, drawn as filled cells (legible at 16–32 px)
const DIGITS: [[u8; 5]; 10] = [
    [0b111, 0b101, 0b101, 0b101, 0b111],
    [0b010, 0b110, 0b010, 0b010, 0b111],
    [0b111, 0b001, 0b111, 0b100, 0b111],
    [0b111, 0b001, 0b111, 0b001, 0b111],
    [0b101, 0b101, 0b111, 0b001, 0b001],
    [0b111, 0b100, 0b111, 0b001, 0b111],
    [0b111, 0b100, 0b111, 0b101, 0b111],
    [0b111, 0b001, 0b010, 0b010, 0b010],
    [0b111, 0b101, 0b111, 0b101, 0b111],
    [0b111, 0b101, 0b111, 0b001, 0b111],
];

fn paint(r: u8, g: u8, b: u8, a: u8) -> Paint<'static> {
    let mut p = Paint::default();
    p.set_color_rgba8(r, g, b, a);
    p.anti_alias = true;
    p
}

pub fn render(spec: &IconSpec) -> Option<Vec<u8>> {
    let s = spec.size as f32;
    let mut pm = Pixmap::new(spec.size, spec.size)?;
    let ink = if spec.light_taskbar { (30, 38, 33) } else { (244, 241, 234) };
    let accent = if spec.countdown { (199, 165, 106) } else { (142, 169, 147) };
    let c = s / 2.0;
    let r = s * 0.40;
    let w = (s * 0.11).max(1.6);

    // track
    let mut pb = PathBuilder::new();
    pb.push_circle(c, c, r);
    let track = pb.finish()?;
    let stroke = Stroke { width: w, line_cap: LineCap::Round, ..Stroke::default() };
    pm.stroke_path(&track, &paint(ink.0, ink.1, ink.2, 70), &stroke, Transform::identity(), None);

    // progress arc (clockwise from 12 o'clock)
    let p = spec.progress.clamp(0.0, 1.0);
    if p > 0.01 {
        let steps = (p * 64.0).ceil() as usize;
        let mut pb = PathBuilder::new();
        for i in 0..=steps {
            let a = -std::f32::consts::FRAC_PI_2 + p * std::f32::consts::TAU * (i as f32 / steps as f32);
            let (x, y) = (c + r * a.cos(), c + r * a.sin());
            if i == 0 {
                pb.move_to(x, y);
            } else {
                pb.line_to(x, y);
            }
        }
        if let Some(arc) = pb.finish() {
            pm.stroke_path(&arc, &paint(accent.0, accent.1, accent.2, 255), &stroke, Transform::identity(), None);
        }
    }

    // centre: minutes left during the countdown (up to 99; the halfway countdown can be longer), a small dot otherwise
    match (spec.countdown, spec.minutes_left) {
        (true, Some(m)) if m <= 99 => {
            let text = m.to_string();
            let cell = (s * 0.085).max(1.0);
            let glyph_w = cell * 3.0;
            let gap = cell;
            let total = text.len() as f32 * glyph_w + (text.len() as f32 - 1.0) * gap;
            let x0 = c - total / 2.0;
            let y0 = c - cell * 2.5;
            let mut pb = PathBuilder::new();
            for (k, ch) in text.chars().enumerate() {
                let d = DIGITS[ch.to_digit(10)? as usize];
                for (row, bits) in d.iter().enumerate() {
                    for col in 0..3 {
                        if bits & (0b100 >> col) != 0 {
                            let x = x0 + k as f32 * (glyph_w + gap) + col as f32 * cell;
                            let y = y0 + row as f32 * cell;
                            pb.push_rect(tiny_skia::Rect::from_xywh(x, y, cell, cell)?);
                        }
                    }
                }
            }
            if let Some(path) = pb.finish() {
                pm.fill_path(&path, &paint(ink.0, ink.1, ink.2, 255), FillRule::Winding, Transform::identity(), None);
            }
        }
        _ => {
            let mut pb = PathBuilder::new();
            pb.push_circle(c, c, s * 0.12);
            if let Some(dot) = pb.finish() {
                pm.fill_path(&dot, &paint(accent.0, accent.1, accent.2, 255), FillRule::Winding, Transform::identity(), None);
            }
        }
    }
    // tiny-skia stores premultiplied RGBA; Tauri expects straight RGBA
    let mut data = pm.take();
    for px in data.chunks_exact_mut(4) {
        let a = px[3] as u32;
        if a > 0 && a < 255 {
            for ch in px.iter_mut().take(3) {
                *ch = ((*ch as u32 * 255 + a / 2) / a).min(255) as u8;
            }
        }
    }
    Some(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_all_states() {
        for (countdown, minutes) in [(false, None), (true, Some(7)), (true, Some(29))] {
            let data = render(&IconSpec { size: 32, progress: 0.6, countdown, minutes_left: minutes, light_taskbar: false }).unwrap();
            assert_eq!(data.len(), 32 * 32 * 4);
            assert!(data.chunks(4).any(|p| p[3] > 0));
        }
    }
}
