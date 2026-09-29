# Attributions and licences

Ahd is free software under the GNU General Public License v3.0 or later. It includes or uses the following
work by others. Religious texts are loaded verbatim from the sources listed here by the scripts in data-pipeline/,
which record every download's checksum in data-pipeline/checksums.json.

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

## Quran text and fonts

- **KFGQPC Uthmanic Hafs v18 and Warsh v10** — King Fahd Glorious Qur'an Printing Complex — text and fonts
  (qurancomplex.gov.sa/techquran/dev). Font licence (embedded in the font files): free to use, copy and distribute;
  not to be sold, modified or reverse engineered. The TrueType files are shipped exactly as published
  (sha256 in data-pipeline/checksums.json), downloaded from the developer mirror
  github.com/thetruetruth/quran-data-kfgqpc because the official site was unreachable at build time.
- **Tanzil** Quran metadata (tanzil.net) — CC BY 3.0 — Meccan/Medinan classification only.

## Fonts (SIL Open Font License 1.1)

- IBM Plex Sans, IBM Plex Sans Arabic — © IBM Corp. — interface text.
- Changa — © The Changa Project Authors (Eduardo Tunni) — Arabic headings.
- Reem Kufi — © The Reem Kufi Project Authors (Khaled Hosny) — Latin headings.
- Amiri — © The Amiri Project Authors (Khaled Hosny) — adhkar, duas, basmala.
- Aref Ruqaa — © The Aref Ruqaa Project Authors (Abdullah Aref) — the hadith inscription.

Interface fonts come from the @fontsource packages. Amiri and Aref Ruqaa are also bundled as complete TrueType
files from the Google Fonts repository (pinned commits, sha256 in data-pipeline/checksums.json) for text shaping.

## Adhan recordings

Five recordings supplied by the project owner (see assets/adhan/adhan.json). Source and licence of each are
still to be confirmed by the owner before release.

## Software

- **harfbuzzjs** 1.6.2 — © The harfbuzzjs project authors — MIT — HarfBuzz compiled to WebAssembly; shapes the
  Quran, adhkar, duas and the hadith (src/features/shaping).
- **pdf.js** — Mozilla — Apache-2.0 — library book reader.
- **Leaflet** — BSD-2-Clause — map for placing a pin (online, on request).
- **magvar** — magnetic declination (World Magnetic Model 2025, public domain) for the compass qibla.

Tauri, React, Vite, Tailwind CSS, Zustand, TanStack Query, i18next and Luxon, each under its own open-source
licence; the full dependency list with licences is generated with each release.
