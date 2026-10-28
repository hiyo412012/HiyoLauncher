# HiyoLauncher

<p align="center">
  <img src="README-banner.svg" alt="HiyoLauncher banner" width="100%" />
</p>

<p align="center">
  <img src="src/renderer/src/assets/logo.svg" alt="HiyoLauncher logo" width="96" />
</p>

<p align="center">
  <strong>Launcher Minecraft nhanh, Ä‘áº¹p, cÃ¡ nhÃ¢n hoÃ¡ sÃ¢u vÃ  tÃ­ch há»£p sáºµn Modrinth.</strong>
</p>

<p align="center">
  <a href="README.md">English</a> Â· <a href="README_vi.md">Tiáº¿ng Viá»‡t</a> · <a href="https://hiyo412012.github.io/HiyoLauncher/">Website</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Giáº¥y phÃ©p: MIT" /></a>
  <a href="https://github.com/hiyo412012/HiyoLauncher/actions/workflows/ci.yml"><img src="https://github.com/hiyo412012/HiyoLauncher/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/hiyo412012/HiyoLauncher/releases"><img src="https://img.shields.io/github/v/release/hiyo412012/HiyoLauncher?label=release" alt="Báº£n phÃ¡t hÃ nh" /></a>
</p>

> **HiyoLauncher khÃ´ng liÃªn káº¿t vá»›i Mojang Studios, Microsoft hay Modrinth.** Minecraft lÃ  thÆ°Æ¡ng hiá»‡u cá»§a Mojang Studios. Modrinth lÃ  thÆ°Æ¡ng hiá»‡u cá»§a chá»§ sá»Ÿ há»¯u tÆ°Æ¡ng á»©ng.

---

## TÃ­nh nÄƒng

| NhÃ³m | Nhá»¯ng gÃ¬ báº¡n cÃ³ |
|---|---|
| Nhanh & á»•n Ä‘á»‹nh | UI pháº£n há»“i tá»©c thÃ¬, táº£i song song, kiá»ƒm tra SHA1, cÃ i Ä‘áº·t atomic, retry cÃ³ backoff, sá»­a chá»¯a instance, cháº©n Ä‘oÃ¡n crash |
| Ná»™i dung Modrinth | TÃ¬m & cÃ i mod, modpack, shader, resource pack trá»±c tiáº¿p tá»« Modrinth, tá»± resolve dependency vÃ  cáº­p nháº­t má»™t click |
| Mod loader | Fabric, Quilt, Forge vÃ  NeoForge, tá»± khá»›p vá»›i phiÃªn báº£n Minecraft |
| TÃ i khoáº£n | ÄÄƒng nháº­p Microsoft báº±ng device code, vÃ  tÃ i khoáº£n offline cho server offline/LAN (cÃ³ disclaimer) |
| CÃ¡ nhÃ¢n hoÃ¡ | Theme máº·c Ä‘á»‹nh Pastel Ocean, sÃ¡ng/tá»‘i, accent tuá»³ chá»‰nh, ná»n áº£nh/video, máº­t Ä‘á»™, cá»¡ chá»¯, ngÃ´n ngá»¯ Viá»‡t/Anh, cover riÃªng tá»«ng instance |
| Cháº©n Ä‘oÃ¡n crash | Nháº­n diá»‡n OutOfMemoryError, sai phiÃªn báº£n Java, thiáº¿u/trÃ¹ng mod, lá»—i GLFW/OpenGL vÃ  Ä‘Æ°a gá»£i Ã½ xá»­ lÃ½ |
| Discord Rich Presence | Tuá»³ chá»n hiá»ƒn thá»‹ instance vÃ  phiÃªn báº£n Ä‘ang chÆ¡i |
| Tá»± Ä‘á»™ng cáº­p nháº­t | Cáº­p nháº­t trong app qua GitHub Releases |

## áº¢nh chá»¥p mÃ n hÃ¬nh

| Trang chá»§ | Duyá»‡t ná»™i dung |
|---|---|
| ![Trang chá»§](docs/screenshots/home.png) | ![Duyá»‡t ná»™i dung](docs/screenshots/browse.png) |

| Báº£n cÃ i | Modpack |
|---|---|
| ![Báº£n cÃ i](docs/screenshots/instances.png) | ![Modpack](docs/screenshots/modpacks.png) |

| CÃ i Ä‘áº·t | MÃ¡y chá»§ |
|---|---|
| ![CÃ i Ä‘áº·t](docs/screenshots/settings.png) | ![MÃ¡y chá»§](docs/screenshots/servers.png) |

> áº¢nh chá»¥p dÃ¹ng theme máº·c Ä‘á»‹nh **Pastel Ocean** vÃ  giao diá»‡n tiáº¿ng Anh. Theme, mÃ u nháº¥n, máº­t Ä‘á»™ vÃ  ná»n Ä‘á»u tuá»³ chá»‰nh Ä‘Æ°á»£c.

## Táº£i & cÃ i Ä‘áº·t

Táº£i báº£n má»›i nháº¥t táº¡i [trang Releases](https://github.com/hiyo412012/HiyoLauncher/releases).

| Ná»n táº£ng | Äá»‹nh dáº¡ng |
|---|---|
| Windows (x64) | Bá»™ cÃ i NSIS (`.exe`) |
| macOS (x64 / arm64) | DMG (`.dmg`) â€” hiá»‡n chÆ°a kÃ½ sá»‘ |
| Linux (x64) | AppImage (`.AppImage`) vÃ  gÃ³i Debian (`.deb`) |

### Báº¯t Ä‘áº§u nhanh

1. Táº£i vÃ  cÃ i báº£n phÃ¹ há»£p vá»›i há»‡ Ä‘iá»u hÃ nh.
2. Má»Ÿ HiyoLauncher, hoÃ n táº¥t onboarding: chá»n ngÃ´n ngá»¯, thÆ° má»¥c game, theme vÃ  táº¡o báº£n cÃ i Ä‘áº§u tiÃªn.
3. Chá»n tÃ i khoáº£n (Microsoft hoáº·c offline) vÃ  báº¥m **Play**.

### CÃ i Ä‘áº·t cho developer

```bash
git clone https://github.com/hiyo412012/HiyoLauncher.git
cd HiyoLauncher
npm install
npm run dev        # cháº¡y dev
npm test           # cháº¡y unit test
npm run typecheck  # kiá»ƒm tra type
npm run dist:win   # build bá»™ cÃ i Windows
```

CÃ¡c lá»‡nh build khÃ¡c: `npm run build`, `npm run dist`, `npm run dist:mac`, `npm run dist:linux`.

### Build matrix (CI)

| OS | Node | CÃ¡c bÆ°á»›c |
|---|---|---|
| ubuntu-latest | 24 | `npm ci` â†’ `npm run typecheck` â†’ `npm test` â†’ `npm run build` |
| windows-latest | 24 | `npm ci` â†’ `npm run typecheck` â†’ `npm test` â†’ `npm run build` |
| macos-latest | 24 | `npm ci` â†’ `npm run typecheck` â†’ `npm test` â†’ `npm run build` |

Báº£n release cháº¡y thÃªm `npx electron-builder --publish always` cho Windows (NSIS), macOS (DMG, x64+arm64) vÃ  Linux (AppImage + deb).

## Thiáº¿t láº­p Ä‘Äƒng nháº­p Microsoft

HiyoLauncher dÃ¹ng **Microsoft device code flow** vá»›i **public client** (khÃ´ng cÃ³ secret). Báº¡n cáº§n má»™t Azure app registration client ID:

- HÆ°á»›ng dáº«n tá»«ng bÆ°á»›c: [`docs/microsoft-auth.md`](docs/microsoft-auth.md)
- DÃ¡n client ID trong **Settings â†’ Advanced â†’ Microsoft client ID**, hoáº·c Ä‘áº·t biáº¿n mÃ´i trÆ°á»ng `MS_CLIENT_ID`.

Cháº¿ Ä‘á»™ offline hoáº¡t Ä‘á»™ng mÃ  khÃ´ng cáº§n client ID.

## Disclaimer cháº¿ Ä‘á»™ offline

TÃ i khoáº£n offline chá»‰ dÃ nh cho **server offline vÃ  LAN**, vÃ  cho ngÆ°á»i Ä‘Ã£ sá»Ÿ há»¯u Minecraft. HiyoLauncher **khÃ´ng** phÃ¢n phá»‘i tÃ i nguyÃªn game Minecraft vÃ  khÃ´ng vÆ°á»£t qua quyá»n sá»Ÿ há»¯u Minecraft cho server online. Xem [`docs/offline-mode.md`](docs/offline-mode.md).

## Cáº¥u trÃºc dá»± Ã¡n

```
src/
  shared/        # types, IPC contract, zod schemas, háº±ng sá»‘
  main/          # Electron main process (Node): services + IPC
  preload/       # contextBridge API cÃ³ type
  renderer/      # React app
tests/           # unit/component test (Vitest)
docs/            # tÃ i liá»‡u
.github/         # CI workflows vÃ  templates
```

## Lá»™ trÃ¬nh

CÃ¡c má»¥c dÆ°á»›i Ä‘Ã¢y Ä‘Ã£ hoÃ n thÃ nh trong v1.0.0:

- M1 Scaffold, IPC, settings, theme shell, onboarding
- M2 Instance CRUD, cÃ i vanilla, Java, launch, log streaming
- M3 Auth: Microsoft + offline
- M4 Mod loader: Fabric, Quilt, Forge, NeoForge
- M5 Modrinth mods + quáº£n lÃ½ ná»™i dung
- M6 Modpacks (`.mrpack`)
- M7 Shader, resource pack, skin, server
- M8 Cháº©n Ä‘oÃ¡n crash, Discord RPC, auto-updater
- M9 Test, CI, docs, release (v1.0.0)

## ÄÃ³ng gÃ³p

Xem [`CONTRIBUTING.md`](CONTRIBUTING.md). Vui lÃ²ng má»Ÿ issue theo template vÃ  khÃ´ng commit secret.

## Giáº¥y phÃ©p

[MIT](LICENSE) Â© 2026 HiyoLauncher contributors.

---

**[Read this in English â†’](README.md)**

