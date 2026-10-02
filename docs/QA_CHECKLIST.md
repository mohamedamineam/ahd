# QA checklist (before publishing a release)

Run on a clean machine for each package (.deb, AppImage, Windows installer, Microsoft Store), in Arabic and English.

## Prayer times
- [ ] Onboarding: search a city in Arabic and in Latin letters; times match the local mosque or ministry.
- [ ] Fine-tune a prayer by seconds; the change survives a restart and stays with that location only.
- [ ] Timer switches from "elapsed" to "countdown" at the configured threshold.
- [ ] Change the system clock / sleep and wake: the adhan fires once, missed adhans follow the setting.

## Adhan
- [ ] Test adhan from Settings; closing the notification window does not stop the sound; the shortcut stops it.
- [ ] Fajr uses the Fajr adhan; "short" mode stops after the first takbir.
- [ ] Notifications show in every build, the Microsoft Store one included: the test notification of the first-run
      setup, a reminder, the Friday reminders; clicking one opens the app. A reminder whose time is changed after it
      went off today goes off again at the new time.

## Desktop
- [ ] Main widget, types 1, 2 and 3: switch "On the desktop" ↔ "Above all apps" without restarting; above all
      apps it stays over other windows, on the desktop it stays under them (also after clicking or dragging it).
- [ ] Background opacity from 0 to 100 % with each text colour (auto, white, dark): the text stays readable.
- [ ] Mini widget: the same layer and opacity checks; size is compact, text fits; each "What it shows" type (one
      prayer, last and next, last and next with its time, next with its time and timer).
- [ ] Clicking the tray icon (static or dynamic) opens the app; the tray menu toggles widgets.
- [ ] Windows taskbar pill: on the taskbar next to the clock (bottom, top, left and right taskbars); unlocked it
      drags along the taskbar only, locked it stays; "Reset position" puts it back; it hides with an auto-hidden
      taskbar and during full-screen apps; clicking the taskbar or Start does not hide it for more than a moment;
      each label format shows; a click opens the app.
- [ ] Reminder before each prayer: arrives 10 minutes before by default with a short tone; minutes, tone and
      on/off in Settings → Reminders.
- [ ] Linux: tray label and menu (GNOME with the AppIndicator extension, Cinnamon, KDE).

## Arabic text (all must show every dot and haraka)
- [ ] Home: the hadith inscription, prayer names, the dial.
- [ ] Quran: pages of both riwayat, the basmala, search results, selecting an ayah, ten bookmarks; the English
      view keeps the page (from Hafs and from Warsh, and back), its search, and the arrow keys after a click on it.
- [ ] Adhkar: morning list, focus mode, chapter titles; the dua in the adhan window (no square brackets); in English,
      the translation under each dhikr and under the dua.
- [ ] Interface text in every settings section reads correctly.

## Other
- [ ] Qibla, Library download and reading, export/import/reset in Privacy.
- [ ] Light and dark themes, 100% and 150% scaling, window at its minimum size (900×620).
