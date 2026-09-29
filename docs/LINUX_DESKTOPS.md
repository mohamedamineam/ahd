# Linux desktops

## Arabic text and WebKitGTK

On Linux the interface runs in WebKitGTK. Version 2.52 (tested: 2.52.6 on Linux Mint 22 / Ubuntu 24.04) drops the
vertical part of OpenType GPOS glyph offsets. Marks positioned by the font are drawn on the baseline, hidden
inside the letters: harakat and Quranic marks disappear, and fonts that place dots as marks (Reem Kufi, Aref
Ruqaa) lose their dots, so «الظهر» reads «الطهر». Chromium (Windows WebView2) is not affected. The same happens
with system-installed fonts, CPU rendering and canvas, so it is in WebKit's text pipeline.

What Ahd does about it:

- The Quran, adhkar, duas, chapter titles, the basmala and the covenant hadith are shaped with HarfBuzz
  (WebAssembly) and drawn as SVG glyphs — `src/features/shaping`. The result is identical on every platform, and
  a test shapes every word of both riwayat, all adhkar and the hadith and checks that no glyph is missing.
- Interface fonts were chosen so that dots are part of the letters (IBM Plex Sans Arabic, Changa), and interface
  strings carry no optional tashkeel. Surah names are shown without harakat (the ayat are always verbatim).

To reproduce: render `ٱلۡحَمۡدُ لِلَّهِ` with the KFGQPC Hafs font in any WebKitGTK 2.52 browser (GNOME Web).

## Tray icon and indicator

| Desktop | Tray icon | Text next to the icon | Notes |
| --- | --- | --- | --- |
| Cinnamon, MATE | yes | yes (XApp status icon, via libxapp) | tested on Cinnamon 6.6; AppIndicator labels are ignored there |
| Xfce, Budgie | yes | depends on the panel plugin | AppIndicator |
| KDE Plasma | yes | no (Plasma ignores labels) | tooltip shows the prayer and timer |
| GNOME | with the AppIndicator extension | yes | the app explains how to install the extension |

## Rendering glitches

On some drivers (seen with hybrid Intel/NVIDIA laptops) WebKitGTK's DMA-BUF renderer flickers or leaves areas that
show what is behind the window. Ahd starts WebKit with `WEBKIT_DISABLE_DMABUF_RENDERER=1` unless the variable is
already set (set it to `0` to try the GPU path).

## Widgets on Wayland

Wayland does not let applications place their own windows, so a widget may open in the middle of the screen and
"always on top" depends on the compositor. Settings → Widgets offers an XWayland compatibility mode (restart
required) that restores exact positions.

## Autostart

Deb, RPM and AppImage: "Start with the system" writes `~/.config/autostart/ahd.desktop`. In the Flatpak the
sandbox cannot write that file; the Background portal is not wired up yet (docs/OPEN_QUESTIONS.md).
