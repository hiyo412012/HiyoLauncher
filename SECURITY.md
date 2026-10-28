# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities. Report privately
via GitHub's "Report a vulnerability" (Security tab) on this repository, or by
email to the maintainers. Include reproduction steps and impact. We aim to
acknowledge within 7 days and fix critical issues promptly.

## Scope

In scope: the HiyoLauncher application, its IPC boundary, account/token handling,
content installation (path traversal, zip-slip), and update mechanism.

Out of scope: third-party services (Mojang, Microsoft, Modrinth, Discord), and
issues requiring physical access to an unlocked machine.

## Token handling

- Microsoft refresh/access tokens are stored only in the main process and
  encrypted with `safeStorage` (OS keychain/DPAPI/Keychain/libsecret).
- Tokens are never sent to the renderer, logs, Discord Rich Presence, or error
  details.
- If the OS does not support `safeStorage`, HiyoLauncher refuses to persist
  refresh tokens and warns the user.
- Logs redact keys matching `token|secret|authorization`.
- No secrets or client secrets are shipped in the repository; Microsoft OAuth
  uses a public client (device code flow).

## Safe usage

- Offline mode is for offline/LAN servers and users who own the game; do not use
  it to bypass ownership on online servers.
- Only install mods/modpacks from sources you trust; content runs with your
  game's privileges.
- Keep your OS and Java runtimes updated.