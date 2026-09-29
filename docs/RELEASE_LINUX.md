# Releasing on Linux

## GitHub release (deb, rpm, AppImage)

1. Confirm every adhan recording's source and licence in `assets/adhan/adhan.json` (`npm run check:release`
   must pass — the release workflow runs it).
2. Update the version in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` and the
   `<releases>` entry of `packaging/linux/io.github.mohamedamineam.Ahd.metainfo.xml`.
3. Tag and push: `git tag v0.1.0 && git push origin v0.1.0`. The workflow builds on Ubuntu 22.04 (older glibc,
   wider compatibility) into a draft release and adds `SHA256SUMS`.
4. Install the .deb and the AppImage on a clean machine, go through docs/QA_CHECKLIST.md, then publish the draft.

## Flathub

Flathub builds open-source apps from source, offline, so the manifest (`packaging/flatpak/io.github.mohamedamineam.Ahd.yml`)
builds from the release tag with vendored dependencies.

1. Generate the dependency lists (once per release, from the tagged commit):
   ```sh
   git clone https://github.com/flatpak/flatpak-builder-tools
   pipx install ./flatpak-builder-tools/node          # provides flatpak-node-generator
   flatpak-node-generator npm package-lock.json -o node-sources.json
   python3 flatpak-builder-tools/cargo/flatpak-cargo-generator.py src-tauri/Cargo.lock -o cargo-sources.json
   ```
2. Fork https://github.com/flathub/flathub, create the branch `new-pr`, and add the manifest, the two JSON files,
   and the shared modules: `git submodule add https://github.com/flathub/shared-modules`.
3. Test locally:
   ```sh
   flatpak install flathub org.flatpak.Builder
   flatpak run org.flatpak.Builder --user --install --force-clean --install-deps-from=flathub build io.github.mohamedamineam.Ahd.yml
   flatpak run io.github.mohamedamineam.Ahd
   flatpak run --command=flatpak-builder-lint org.flatpak.Builder manifest io.github.mohamedamineam.Ahd.yml
   ```
4. Open the pull request. Flathub checks that `https://github.com/mohamedamineam/ahd` exists (the app ID is
   `io.github.<user>.<App>`), that the metainfo validates, and that the app builds.

The manifest has not been test-built yet (no flatpak-builder on the development machine). In a Flatpak the tray uses
AppIndicator (libxapp is not in the GNOME runtime), so Cinnamon shows the icon without the timer label there; the
.deb and AppImage show the label.

## Validation used locally

- `appstreamcli validate packaging/linux/io.github.mohamedamineam.Ahd.metainfo.xml` — passes.
- `desktop-file-validate` on the generated desktop entry — passes.
