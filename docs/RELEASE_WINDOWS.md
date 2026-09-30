# Releasing on Windows

## GitHub release (NSIS installer and MSI)

The release workflow builds both on `windows-latest` when a `v*` tag is pushed (see docs/RELEASE_LINUX.md for the
steps; the draft release holds all platforms). The NSIS installer installs per user, needs no administrator
rights, and downloads the WebView2 runtime only if Windows lacks it.

Unsigned installers trigger SmartScreen warnings. Code signing needs a certificate the maintainer controls;
SignPath (free for open-source projects) or Azure Trusted Signing are the usual options
(docs/OPEN_QUESTIONS.md).

## Microsoft Store

Registration in Partner Center (storedeveloper.microsoft.com) is free for individual developers since September 2025
(ID and selfie check). Two ways to submit:

**MSIX (recommended — no certificate needed).** The Store re-signs MSIX packages with Microsoft's certificate and
delivers updates itself. Tauri does not build MSIX, so the workflow **Microsoft Store package**
(`.github/workflows/msix.yml`) builds it on Windows for every release tag, or by hand (Actions → Run workflow): the
`.msix` is the run's artifact, to upload in the submission. It is made from `packaging/msix/AppxManifest.xml` (product
identity from Partner Center → Product identity: `3ahd.3ahd`, publisher `CN=2B0846AE-…`; startup task; icons indexed
in `resources.pri`) by `packaging/msix/build-msix.ps1`, with version `x.y.z.0`. The app detects MSIX, hides its own
update check, turns the startup task on and off from "Start with Windows", and starts in the tray when the startup
task starts it (`src-tauri/src/platform/windows.rs`). Without GitHub, the free **MSIX Packaging Tool** can convert
`3ahd-windows-x64-setup.exe` (argument `/S`) instead; see docs/deploy-guide.html, step 8.

**EXE/MSI link.** The Store downloads your installer from a permanent HTTPS URL (a GitHub release asset works) and
installs it silently (`/S` for the NSIS installer, `/quiet` for the MSI). The installer must be Authenticode-signed with
a certificate from a CA in the Microsoft Trusted Root Program (self-signed is rejected) — e.g. SignPath (free for
open source) or Azure Trusted Signing. Build it with the WebView2 offline installer:
`npm run tauri build -- --bundles nsis --config src-tauri/tauri.microsoftstore.conf.json`. The Store does not update
EXE/MSI apps, so this build also needs the in-app updater (`--features updater`, with the maintainer's signing key).

For both: privacy policy URL (docs/PRIVACY.md on GitHub), age rating questionnaire, screenshots
(docs/screenshots), store art (branding/png/store-box-art-1080.png, store-poster-720x1080.png, app-icon-300.png).

Windows code (tray, taskbar pill, widgets on the desktop layer, toast placement) is type-checked on every CI run
(`cargo clippy` on windows-latest) but has not yet been run on a Windows machine; see docs/QA_CHECKLIST.md.
