# HiyoLauncher — Design Spec (v1)

**Ngày:** 2026-10-28
**Trạng thái:** Approved (user delegated execution, theme: pastel ocean blue)
**License:** MIT

## 1. Mục tiêu

Một launcher Minecraft open-source, đa nền tảng, hướng tới trải nghiệm "mở là chơi":

- Nhanh: UI phản hồi tức thì, tải song song, cache metadata.
- Ổn định: cài đặt atomic, kiểm tra SHA1, retry, chống hỏng instance, chẩn đoán crash.
- Cá nhân hoá sâu: theme, màu, nền, mật độ, font, ngôn ngữ, cover từng instance.
- Cài mod/modpack/shader/resource pack trực tiếp từ Modrinth.
- Hỗ trợ tài khoản Microsoft (device code) và tài khoản offline (crack), có disclaimer.

Không nằm trong phạm vi v1: server hosting, chat nội bộ, marketplace trả phí, mod tự viết,
quản lý world chi tiết, CurseForge, third-party auth (authlib-injector), Linux sandbox
tinh chỉnh (dùng mặc định Electron).

## 2. Ràng buộc

- Tech stack: Electron 45 + electron-vite 6 + React 19 + TypeScript 5.9 + Tailwind 4.
- Nền tảng: Windows, macOS, Linux (build CI; phát triển/kiểm thử chính trên Windows).
- Không có backend riêng. Dữ liệu người dùng lưu local, token mã hoá bằng `safeStorage`.
- Repo công khai trên GitHub; không chứa secret. Microsoft OAuth dùng public client
  device-code flow, client ID cấu hình được (Azure app registration của chủ repo).
- Ngôn ngữ UI: Tiếng Việt (mặc định) + English.

## 3. Kiến trúc

```
src/
  shared/        # types, IPC contract, zod schemas, constants dùng chung
  main/          # Electron main process (Node)
    services/    # settings, instances, download, java, launch, auth, modrinth,
                 # content, modpack, loaders, skins, servers, logs, discord, updater
    ipc.ts       # đăng ký handler, validate input bằng zod
  preload/       # contextBridge API có type
  renderer/      # React app
```

### 3.1 Process model

- **Main** giữ toàn bộ quyền filesystem/network/process. Không expose `ipcRenderer` thô.
- **Preload** expose `window.hiyo` với các method typed, mỗi method map 1 kênh IPC.
- **Renderer** sandboxed, contextIsolation bật, nodeIntegration tắt, CSP chặt.
- Mọi payload IPC được validate bằng zod ở main; lỗi trả về `{ ok: false, error }` có mã.

### 3.2 Lưu trữ

```
<userData>/                          # %APPDATA%/HiyoLauncher
  settings.json
  accounts.json                      # refresh token mã hoá safeStorage
  instances/<id>/instance.json       # metadata instance
  instances/<id>/{mods,config,saves,resourcepacks,shaderpacks,logs}
  shared/{versions,libraries,assets,java}
  cache/{mojang,modrinth}
  logs/{main,game-*}.log
```

- `gameRoot` có thể đổi trong Settings (mặc định `<userData>/minecraft`).
- Ghi file: temp file cùng thư mục + rename; JSON store có backup `.bak`.
- Download: kiểm SHA1, retry 3 lần exponential, ghi qua `.part`.

### 3.3 Thành phần chính

| Service | Trách nhiệm | Phụ thuộc |
|---|---|---|
| `settings` | đọc/ghi/merge settings, migrate version | store, paths |
| `instances` | CRUD, clone, validate tên/path, repair | store, download |
| `versions` | Mojang version manifest + version JSON (cache) | download |
| `java` | detect Java, chọn major, tải Mojang JRE | versions, download |
| `game` | cài vanilla (assets/libraries/natives), launch | xmcl/core, installer, java |
| `loaders` | Fabric/Quilt/Forge/NeoForge | xmcl/installer |
| `auth` | Microsoft device code, offline UUID, refresh, skin | xmcl/user, safeStorage |
| `modrinth` | search/project/version/deps, cache | REST API v2 |
| `content` | cài mod/shader/resource pack, update, enable/disable | modrinth, download |
| `modpack` | parse `.mrpack`, cài files + overrides | fflate, download, instances |
| `servers` | đọc/ghi `servers.dat`, SLP ping | nbt, net |
| `logs` | tail log, parse crash, gợi ý | fs |
| `discord` | Rich Presence (optional) | discord-rpc |
| `updater` | electron-updater + GitHub | electron-updater |

### 3.4 Luồng launch

1. Renderer chọn instance + account → `launch.start`.
2. Main: resolve version chain (inheritsFrom), đảm bảo assets/libraries/natives,
   resolve Java (Mojang JRE nếu cần), build args (JVM + game), spawn process.
3. Stream `game:log` và `game:state` về renderer; lưu log file.
4. Khi exit: emit `game:exit` kèm code; nếu crash → phân tích log gợi ý.

### 3.5 Luồng cài mod

1. Search Modrinth theo query + loader + MC version (facet).
2. Chọn version phù hợp (ưu tiên release, đúng loader, đúng MC).
3. Resolve dependency bắt buộc (required), đệ quy có giới hạn, tránh trùng.
4. Tải file vào `mods/`, verify SHA1, ghi metadata `.hiyo-mod.json` để update.
5. Update: so sánh hash file hiện tại với version mới nhất; cho phép update từng mod.

### 3.6 Modpack

- `.mrpack` = zip: `modrinth.index.json` + `overrides/` + `client-overrides/`.
- Tạo instance mới, cài Minecraft + loader theo `dependencies`, tải `files[]`
  (bỏ file có `env.client === "unsupported"`), giải nén overrides.
- Lưu `modpack.json` (projectId, versionId, name, version) để check update.

## 4. UI/UX

- Theme mặc định **Pastel Ocean** (xanh biển pastel), có light/dark, accent tuỳ chỉnh.
- Layout: sidebar dọc bên trái (Home, Instances, Browse, Modpacks, Skins, Servers,
  Logs, Settings), topbar có account switcher + window controls (Windows/Linux).
- Trang Home: hero instance đang chọn, nút Play lớn, thông tin loader/version,
  hoạt động gần đây, quick actions (New instance, Browse mods).
- Instance detail: tabs Overview / Mods / Resource packs / Shaders / Worlds / Settings.
- Browse: search + filter (loader, MC version, category, sort), card có icon, downloads,
  nút Install mở dialog chọn version + dependencies.
- Modpacks: featured/search, cài 1 click, hiển thị tiến trình theo bước.
- Onboarding lần đầu: chọn ngôn ngữ, thư mục game, theme, tạo instance đầu tiên.
- Micro-interaction: Motion cho page transition, hover card, progress mượt; tôn trọng
  `prefers-reduced-motion`.
- Accessibility: focus ring, keyboard nav, contrast AA, aria labels.

## 5. Hiệu năng

- Splash window hiển thị ngay, main window show khi renderer ready.
- Lazy-load route nặng (Browse, Settings), virtualize danh sách > 100 item.
- React Query cache 5 phút cho Modrinth; disk cache version manifest 1 giờ.
- Progress event throttle 100ms; log stream batch 200ms.
- Tránh copy file lớn trong main thread: dùng stream.

## 6. Ổn định & lỗi

- Error taxonomy: `AUTH`, `NETWORK`, `FS`, `JAVA`, `VERSION`, `MODRINTH`, `LAUNCH`, `UNKNOWN`.
- Retry: network 3 lần (1s/2s/4s), không retry lỗi 4xx (trừ 429 honor Retry-After).
- Repair instance: verify libraries/assets, xoá file hỏng, cài lại.
- Crash analysis: nhận diện OutOfMemoryError, UnsupportedClassVersionError,
  mod thiếu dependency, duplicate mod, GLFW/OpenGL, access violation; trả về tip.
- Global handlers cho `unhandledRejection`/`uncaughtException`, ghi log và hiện dialog.

## 7. Bảo mật & pháp lý

- Token chỉ nằm trong main; renderer chỉ nhận profile (name, uuid, skin URL).
- `safeStorage.encryptString`; nếu OS không hỗ trợ, cảnh báo và không lưu refresh token.
- CSP: `default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.modrinth.com https://*.mojang.com ...`
- Chặn `will-navigate`/`setWindowOpenHandler` ra ngoài, mở bằng shell external.
- Disclaimer offline mode trong onboarding + README; không phân phối game/assets.
- Không log token/authorization header.

## 8. Kiểm thử

- Unit (Vitest): path safety, settings migration, mrpack parser, dependency resolver,
  version/loader matching, java selection, crash parser.
- Component (Vitest + Testing Library): theme switcher, instance card, install dialog.
- E2E (Playwright Electron, mock IPC): onboarding, tạo instance, đổi theme, mở Browse.
- CI GitHub Actions: lint → typecheck → unit → build (win/mac/linux) → release tag.

## 9. Phát hành

- `electron-builder`: NSIS (win), dmg (mac), AppImage + deb (linux).
- `electron-updater` generic/GitHub provider; channel stable.
- Version theo semver; CHANGELOG thủ công cho v1.

## 10. Lộ trình

| Mốc | Nội dung |
|---|---|
| M1 | Scaffold, IPC, settings, theme shell, onboarding |
| M2 | Instance CRUD, vanilla install, Java, launch, log streaming |
| M3 | Auth Microsoft + offline |
| M4 | Loader Fabric/Quilt/Forge/NeoForge |
| M5 | Modrinth mods + content management |
| M6 | Modpacks |
| M7 | Shader/resource pack, skins, servers |
| M8 | Crash diagnostics, Discord RPC, updater |
| M9 | Tests, CI, docs, release |

## 11. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Microsoft client ID chưa có | Offline mode full; settings cho nhập client ID; docs hướng dẫn Azure |
| Forge installer lỗi version cũ | Dùng @xmcl/installer, fallback chạy installer jar; hiển thị log rõ |
| Modrinth API đổi schema | Lọc/validate response, hiển thị lỗi thân thiện |
| Tải lớn làm treo UI | Worker? Không: stream + progress throttle, không block renderer |
| SmartScreen cảnh báo | Ghi rõ trong README; ký số nếu có cert |
| Xung đột mod | Cảnh báo theo project id/loader/MC version; không tự xoá |

## 12. Tiêu chí thành công

- Cài vanilla + Fabric + mod từ Modrinth và vào game thành công trên Windows.
- Offline account chơi được server offline/LAN.
- UI mượt, theme đổi ngay, không giật khi tải.
- Crash có gợi ý nguyên nhân thay vì chỉ log thô.
- Build CI ra artifact cho 3 nền tảng.
