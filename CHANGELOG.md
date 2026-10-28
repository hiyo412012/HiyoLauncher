# Changelog

All notable changes to HiyoLauncher are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-10-28

### Added

- Electron 45 + React 19 + TypeScript 5.9 + Tailwind 4 cross-platform launcher
  (Windows, macOS, Linux).
- Instance management: create, clone, repair, delete; per-instance mods, config,
  saves, resource packs, shaders.
- Vanilla Minecraft installation with SHA1 verification, atomic writes, retry.
- Mod loaders: Fabric, Quilt, Forge and NeoForge, matched to the Minecraft
  version.
- Modrinth integration: search and install mods, modpacks, shaders and resource
  packs, with required-dependency resolution and update checks.
- `.mrpack` modpack import/install with overrides.
- Microsoft account login via public-client device code flow; refresh tokens
  stored with `safeStorage`.
- Offline accounts for offline/LAN servers, with disclaimer.
- Crash diagnostics with actionable tips (OutOfMemoryError, Java version
  mismatch, missing/duplicate mods, GLFW/OpenGL errors, etc.).
- Discord Rich Presence (optional).
- Auto-update via GitHub releases.
- Personalization: Pastel Ocean default theme, light/dark, custom accent,
  backgrounds, density, font scale, language (Vietnamese/English), per-instance
  covers.
- Skins management and server list with SLP ping.
- Onboarding flow (language, game folder, theme, first instance).
- CI (lint/typecheck/test/build matrix) and release workflows.

### Notes

- macOS builds are currently unsigned.
- No game assets are bundled; Minecraft is downloaded from Mojang on demand.