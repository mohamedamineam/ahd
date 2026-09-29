# Open questions for the maintainer

Decisions only the project owner can make. Nothing here blocks local testing.

## Before the first public release

1. **Adhan recordings** — for each file in `assets/adhan/adhan.json`, the source URL and licence are
   `UNVERIFIED`. Please add where each recording comes from and confirm it may be redistributed. The release
   workflow stops until this is done (`npm run check:release`).
2. **GitHub account** — the app ID `io.github.ahdapp.Ahd`, the update/catalog URLs and the metainfo use the
   placeholder account `ahdapp`. Tell us the real GitHub user or organisation and everything will be renamed.
3. **Windows code signing** — choose SignPath (free for open source), Azure Trusted Signing, or ship unsigned
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
8. **Tafsir** — not included yet; needs a source with a clear licence for offline use.

## Platform

9. **Flatpak autostart** — needs the Background portal (org.freedesktop.portal.Background) to be wired up.
