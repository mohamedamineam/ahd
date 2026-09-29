# Releasing on Linux

## GitHub release (deb, rpm, AppImage)

1. Confirm every adhan recording's source and licence in `assets/adhan/adhan.json` (`npm run check:release`
   must pass — the release workflow runs it).
2. Update the version in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` and the
   `<releases>` entry of `packaging/linux/io.github.ahdapp.Ahd.metainfo.xml`.
3. Tag and push: `git tag v0.1.0 && git push origin v0.1.0`. The workflow builds on Ubuntu 22.04 (older glibc,
   wider compatibility) into a draft release and adds `SHA256SUMS`.
4. Install the .deb and the AppImage on a clean machine, go through docs/QA_CHECKLIST.md, then publish the draft.

## Flathub

1. Fork https://github.com/flathub/flathub, branch `new-pr`, and add:
   - `io.github.ahdapp.Ahd.yml` from `packaging/flatpak/`, with the .deb URL and its sha256 from `SHA256SUMS`;
   - the `icons/` folder and the metainfo file next to it (adjust the paths in the manifest);
   - `git submodule add https://github.com/flathub/shared-modules` (tray icon library).
2. Test locally:
   `flatpak run org.flatpak.Builder --user --install --force-clean build io.github.ahdapp.Ahd.yml`
   then `flatpak run io.github.ahdapp.Ahd`, and `flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest io.github.ahdapp.Ahd.yml`.
3. Open the pull request. The app ID `io.github.ahdapp.Ahd` requires owning github.com/ahdapp (verification).

The manifest has not been built yet (no flatpak-builder on the development machine).

## Validation used locally

- `appstreamcli validate packaging/linux/io.github.ahdapp.Ahd.metainfo.xml` — passes.
- `desktop-file-validate` on the generated desktop entry — passes.
