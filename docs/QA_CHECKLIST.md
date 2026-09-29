# QA checklist (before publishing a release)

Run on a clean machine for each package (.deb, AppImage, Windows installer), in Arabic and English.

## Prayer times
- [ ] Onboarding: search a city in Arabic and in Latin letters; times match the local mosque or ministry.
- [ ] Fine-tune a prayer by seconds; the change survives a restart and stays with that location only.
- [ ] Timer switches from "elapsed" to "countdown" at the configured threshold.
- [ ] Change the system clock / sleep and wake: the adhan fires once, missed adhans follow the setting.

## Adhan
- [ ] Test adhan from Settings; closing the notification window does not stop the sound; the shortcut stops it.
- [ ] Fajr uses the Fajr adhan; "short" mode stops after the first takbir.

## Desktop
- [ ] Main widget: desktop layer and always-on-top; position is remembered; lock works.
- [ ] Mini widget: size is compact, text fits, on top of other windows.
- [ ] Tray icon and label (Linux) / taskbar pill (Windows); tray menu toggles widgets.

## Arabic text (all must show every dot and haraka)
- [ ] Home: the hadith inscription, prayer names, the dial.
- [ ] Quran: pages of both riwayat, the basmala, search results, selecting an ayah, bookmarks.
- [ ] Adhkar: morning list, focus mode, chapter titles; the dua in the adhan window.
- [ ] Interface text in every settings section reads correctly.

## Other
- [ ] Qibla, Library download and reading, export/import/reset in Privacy.
- [ ] Light and dark themes, 100% and 150% scaling, window at its minimum size (900×620).
