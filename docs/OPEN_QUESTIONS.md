# Open questions for the maintainer

Decisions only the project owner can make. Nothing here blocks local testing.

## Before the first public release

1. **Adhan recordings** — supplied by the owner from public YouTube uploads; the owner states adhan recordings
   are shared freely (recorded in `assets/adhan/adhan.json`). If a muezzin or channel asks, replace that recording.
2. **GitHub account** — `mohamedamineam`; the app ID is `io.github.mohamedamineam.Ahd` (data under the old
   placeholder ID is moved automatically on first start).
3. **Windows code signing** (Microsoft Store postponed by the owner) — choose SignPath (free for open source), Azure Trusted Signing, or ship unsigned
   (SmartScreen warnings).
4. **Updater** — the GitHub build can check for updates (feature `updater`, off by default). It needs a signing
   key pair generated and kept by the maintainer (`npm run tauri signer generate`).

## Content

5. **KFGQPC files** — the official download page was unreachable; the text and fonts come from a developer
   mirror with checksums recorded. When possible, compare the checksums with the official download.
6. **Adhkar review** — docs/ADHKAR_REVIEW.md lists wording differences between the Hisn al-Muslim dataset used
   and hisnmuslim.com. A qualified reviewer should confirm the dataset before release.
7. **Library** — «الرحيق المختوم» has no downloadable Arabic PDF on IslamHouse, and five requested titles are not
   available there (see data-pipeline/build-library-catalog.ts). Add other free sources only with a clear licence.
8. **Internet Archive books** — Sahih al-Bukhari (archive.org item Bukhari_201707) and «الرحيق المختوم» (Qatar Awqaf
   edition, item 20200223_20200223_1246) were added at the owner's request. Their pages state no licence; the app
   only downloads them from archive.org when a user asks. Confirm or replace with editions whose rights are clear.
9. **Tafsir** — not included yet; needs a source with a clear licence for offline use.

## Platform

10. **Flatpak autostart** — needs the Background portal (org.freedesktop.portal.Background) to be wired up.
