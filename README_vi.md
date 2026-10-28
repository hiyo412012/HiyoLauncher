# HiyoLauncher

<p align="center">
  <img src="README-banner.svg" alt="HiyoLauncher banner" width="100%" />
</p>

<p align="center">
  <img src="src/renderer/src/assets/logo.svg" alt="HiyoLauncher logo" width="96" />
</p>

<p align="center">
  <strong>Launcher Minecraft nhanh, đẹp, cá nhân hoá sâu và tích hợp sẵn Modrinth.</strong>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_vi.md">Tiếng Việt</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="Giấy phép: MIT" /></a>
  <a href="https://github.com/hiyo412012/HiyoLauncher/actions/workflows/ci.yml"><img src="https://github.com/hiyo412012/HiyoLauncher/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/hiyo412012/HiyoLauncher/releases"><img src="https://img.shields.io/github/v/release/hiyo412012/HiyoLauncher?label=release" alt="Bản phát hành" /></a>
</p>

> **HiyoLauncher không liên kết với Mojang Studios, Microsoft hay Modrinth.** Minecraft là thương hiệu của Mojang Studios. Modrinth là thương hiệu của chủ sở hữu tương ứng.

---

## Tính năng

| Nhóm | Những gì bạn có |
|---|---|
| Nhanh & ổn định | UI phản hồi tức thì, tải song song, kiểm tra SHA1, cài đặt atomic, retry có backoff, sửa chữa instance, chẩn đoán crash |
| Nội dung Modrinth | Tìm & cài mod, modpack, shader, resource pack trực tiếp từ Modrinth, tự resolve dependency và cập nhật một click |
| Mod loader | Fabric, Quilt, Forge và NeoForge, tự khớp với phiên bản Minecraft |
| Tài khoản | Đăng nhập Microsoft bằng device code, và tài khoản offline cho server offline/LAN (có disclaimer) |
| Cá nhân hoá | Theme mặc định Pastel Ocean, sáng/tối, accent tuỳ chỉnh, nền ảnh/video, mật độ, cỡ chữ, ngôn ngữ Việt/Anh, cover riêng từng instance |
| Chẩn đoán crash | Nhận diện OutOfMemoryError, sai phiên bản Java, thiếu/trùng mod, lỗi GLFW/OpenGL và đưa gợi ý xử lý |
| Discord Rich Presence | Tuỳ chọn hiển thị instance và phiên bản đang chơi |
| Tự động cập nhật | Cập nhật trong app qua GitHub Releases |

## Ảnh chụp màn hình

| Trang chủ | Duyệt nội dung |
|---|---|
| ![Trang chủ](docs/screenshots/home.png) | ![Duyệt nội dung](docs/screenshots/browse.png) |

| Bản cài | Modpack |
|---|---|
| ![Bản cài](docs/screenshots/instances.png) | ![Modpack](docs/screenshots/modpacks.png) |

| Cài đặt | Máy chủ |
|---|---|
| ![Cài đặt](docs/screenshots/settings.png) | ![Máy chủ](docs/screenshots/servers.png) |

> Ảnh chụp dùng theme mặc định **Pastel Ocean** và giao diện tiếng Anh. Theme, màu nhấn, mật độ và nền đều tuỳ chỉnh được.

## Tải & cài đặt

Tải bản mới nhất tại [trang Releases](https://github.com/hiyo412012/HiyoLauncher/releases).

| Nền tảng | Định dạng |
|---|---|
| Windows (x64) | Bộ cài NSIS (`.exe`) |
| macOS (x64 / arm64) | DMG (`.dmg`) — hiện chưa ký số |
| Linux (x64) | AppImage (`.AppImage`) và gói Debian (`.deb`) |

### Bắt đầu nhanh

1. Tải và cài bản phù hợp với hệ điều hành.
2. Mở HiyoLauncher, hoàn tất onboarding: chọn ngôn ngữ, thư mục game, theme và tạo bản cài đầu tiên.
3. Chọn tài khoản (Microsoft hoặc offline) và bấm **Play**.

### Cài đặt cho developer

```bash
git clone https://github.com/hiyo412012/HiyoLauncher.git
cd HiyoLauncher
npm install
npm run dev        # chạy dev
npm test           # chạy unit test
npm run typecheck  # kiểm tra type
npm run dist:win   # build bộ cài Windows
```

Các lệnh build khác: `npm run build`, `npm run dist`, `npm run dist:mac`, `npm run dist:linux`.

### Build matrix (CI)

| OS | Node | Các bước |
|---|---|---|
| ubuntu-latest | 24 | `npm ci` → `npm run typecheck` → `npm test` → `npm run build` |
| windows-latest | 24 | `npm ci` → `npm run typecheck` → `npm test` → `npm run build` |
| macos-latest | 24 | `npm ci` → `npm run typecheck` → `npm test` → `npm run build` |

Bản release chạy thêm `npx electron-builder --publish always` cho Windows (NSIS), macOS (DMG, x64+arm64) và Linux (AppImage + deb).

## Thiết lập đăng nhập Microsoft

HiyoLauncher dùng **Microsoft device code flow** với **public client** (không có secret). Bạn cần một Azure app registration client ID:

- Hướng dẫn từng bước: [`docs/microsoft-auth.md`](docs/microsoft-auth.md)
- Dán client ID trong **Settings → Advanced → Microsoft client ID**, hoặc đặt biến môi trường `MS_CLIENT_ID`.

Chế độ offline hoạt động mà không cần client ID.

## Disclaimer chế độ offline

Tài khoản offline chỉ dành cho **server offline và LAN**, và cho người đã sở hữu Minecraft. HiyoLauncher **không** phân phối tài nguyên game Minecraft và không vượt qua quyền sở hữu Minecraft cho server online. Xem [`docs/offline-mode.md`](docs/offline-mode.md).

## Cấu trúc dự án

```
src/
  shared/        # types, IPC contract, zod schemas, hằng số
  main/          # Electron main process (Node): services + IPC
  preload/       # contextBridge API có type
  renderer/      # React app
tests/           # unit/component test (Vitest)
docs/            # tài liệu
.github/         # CI workflows và templates
```

## Lộ trình

Các mục dưới đây đã hoàn thành trong v1.0.0:

- M1 Scaffold, IPC, settings, theme shell, onboarding
- M2 Instance CRUD, cài vanilla, Java, launch, log streaming
- M3 Auth: Microsoft + offline
- M4 Mod loader: Fabric, Quilt, Forge, NeoForge
- M5 Modrinth mods + quản lý nội dung
- M6 Modpacks (`.mrpack`)
- M7 Shader, resource pack, skin, server
- M8 Chẩn đoán crash, Discord RPC, auto-updater
- M9 Test, CI, docs, release (v1.0.0)

## Đóng góp

Xem [`CONTRIBUTING.md`](CONTRIBUTING.md). Vui lòng mở issue theo template và không commit secret.

## Giấy phép

[MIT](LICENSE) © 2026 HiyoLauncher contributors.

---

**[Read this in English →](README.md)**
