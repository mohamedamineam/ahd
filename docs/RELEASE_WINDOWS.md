# Releasing on Windows

## GitHub release (NSIS installer and MSI)

The release workflow builds both on `windows-latest` when a `v*` tag is pushed (see docs/RELEASE_LINUX.md for the
steps; the draft release holds all platforms). The NSIS installer installs per user, needs no administrator
rights, and downloads the WebView2 runtime only if Windows lacks it.

Unsigned installers trigger SmartScreen warnings. Code signing needs a certificate the maintainer controls;
SignPath (free for open-source projects) or Azure Trusted Signing are the usual options
(docs/OPEN_QUESTIONS.md).

## Microsoft Store

The Store accepts the installer as a "MSI or EXE app":

1. Build with the Store overlay, which bundles WebView2 so installation needs no download (a Store requirement):
   `npm run tauri build -- --bundles nsis --config src-tauri/tauri.microsoftstore.conf.json`
2. Upload the installer to a permanent HTTPS URL (the GitHub release asset works) — the Store downloads it
   from there, so its content must never change for that version.
3. In Partner Center: new product → "EXE or MSI app", installer URL, silent install switch `/S`, architecture x64,
   the privacy policy URL (docs/PRIVACY.md on GitHub), screenshots from docs/screenshots, and the store logos
   from packaging/msix/Assets.

Windows code (tray, taskbar pill, widgets on the desktop layer, toast placement) is type-checked on every CI run
(`cargo clippy` on windows-latest) but has not yet been run on a Windows machine; see docs/QA_CHECKLIST.md.
