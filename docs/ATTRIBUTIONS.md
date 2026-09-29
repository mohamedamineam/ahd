# Attributions and licences

Ahd is free software under the GNU General Public License v3.0 or later. It includes or uses the following
work by others. Religious texts are loaded verbatim from the sources listed here; see docs/CONTENT_SOURCES.md.

## Prayer times and astronomy

- **adhan-js** 4.4.6 — Batoul Apps — MIT — prayer time calculation (github.com/batoulapps/adhan-js).
- **Aladhan** calculation-method parameters and offsets — api.aladhan.com/v1/methods and /v1/timings,
  fetched 2026-09-28, used as a reference for regional methods and for test fixtures.
- **astronomy-engine** 2.1.19 — Don Cross — MIT — sun position (qibla sun method, Rasd al-Qibla).
- **@tabby_ai/hijri-converter** 1.0.5 — MIT — Umm al-Qura fallback when the system calendar is missing.
  Agrees day-for-day with ICU's islamic-umalqura calendar from 2000-01-01 to 2029-08-10; later months are
  projections and may differ by a day (adjustable with the Hijri day offset).
- **@photostructure/tz-lookup** 11.7.0 — CC0-1.0 — time zone from coordinates.

## Places

- **GeoNames** (download.geonames.org) — CC BY 4.0 — offline place names and time zones.
- **OpenStreetMap Nominatim** — © OpenStreetMap contributors, ODbL — online place search (on request only).
- **OpenStreetMap tiles** — © OpenStreetMap contributors — maps (on request only).

## Fonts (all bundled, SIL Open Font License 1.1)

- IBM Plex Sans, IBM Plex Sans Arabic — IBM.
- Reem Kufi — Khaled Hosny, Santiago Orozco.
- Amiri — Khaled Hosny.
- Aref Ruqaa — Abdullah Aref, Khaled Hosny, Hermann Zapf (used for the hadith inscription).

## Adhan recordings

Five recordings supplied by the project owner (see assets/adhan/adhan.json). Source and licence of each are
still to be confirmed by the owner before release.

## Software

Tauri, React, Vite, Tailwind CSS, Zustand, TanStack Query, i18next, Luxon, Leaflet and pdf.js (each under its
own open-source licence; the full list is generated with the release).
