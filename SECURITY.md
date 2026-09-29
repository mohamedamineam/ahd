# Security

Please report security problems privately through GitHub's "Report a vulnerability" (Security tab) rather than a
public issue. You will get an answer within a week.

How Ahd limits risk:

- Every window gets only the permissions it needs (src-tauri/capabilities); widgets and notifications cannot
  change settings or files.
- A strict Content Security Policy: no remote scripts; network access only to the optional services listed in
  docs/PRIVACY.md.
- Downloads (library books) are limited to an allow-list of HTTPS hosts, a size limit and file-type checks, and
  are stored in the app's own folder. Imported adhan files are checked by content and size.
- No telemetry, no accounts, no secrets in the repository.
