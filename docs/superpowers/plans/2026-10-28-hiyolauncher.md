# HiyoLauncher Implementation Plan (v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a fast, stable, personalizable Minecraft launcher (Electron) with Modrinth content, Microsoft/offline accounts, and cross-platform release builds.

**Architecture:** Electron main owns all filesystem/network/process work behind a typed, zod-validated IPC boundary; a React renderer provides the UI. Minecraft installation uses `@xmcl/core` + `@xmcl/installer` primitives for vanilla/Fabric/Quilt; Forge/NeoForge use their official installer jars; Modrinth uses REST v2 directly.

**Tech Stack:** Electron 45, electron-vite 6, React 19, TypeScript 5.9, Tailwind 4, Zustand, TanStack Query, Motion, Radix UI, `@xmcl/core`, `@xmcl/installer`, `@xmcl/user`, `fflate`, electron-updater.

**Spec:** `docs/superpowers/specs/2026-10-28-hiyolauncher-design.md`

## Global Constraints

- Renderer must never import Node APIs; all privileged work goes through `window.hiyo`.
- Every IPC input is validated with zod in `src/main/ipc.ts`; errors use `{ code, message, detail? }`.
- No secret/token is ever written to logs, renderer state, or the repo.
- All filesystem writes that replace game files are temp-file + rename (atomic).
- User-facing strings go through i18n (`vi` default, `en`).
- Theme default is Pastel Ocean; every theme must pass AA contrast for body text.
- Supported platforms: Windows x64, macOS x64/arm64, Linux x64.
- Do not touch repositories other than `HiyoLauncher`.

## Review Focus

- **Path traversal via instance name / icon / modpack entries**: a name like `../../evil` or a zip entry `../x` must never write outside the instance or game root.
- **Partial installs**: a cancelled/failed download must leave the instance launchable or clearly marked broken, never half-written JSON.
- **Auth token leakage**: refresh/access tokens must not appear in renderer payloads, logs, Discord RPC, or error details.
- **Mod mismatch**: installing a Fabric mod into a Forge instance (or wrong MC version) must be blocked with an actionable message.
- **Java mismatch**: launching MC 1.20+ with Java 8 must fail before spawn with a clear message, not after a cryptic game crash.

---

## File Structure (created by this plan)

```
electron.vite.config.ts, electron-builder.yml, package.json, tsconfig*.json
src/shared/{types,schemas,ipc,constants,util}.ts
src/main/index.ts, window.ts, ipc.ts
src/main/services/{paths,store,logger,settings,instances,versions,download,java,game,loaders,auth,modrinth,content,modpack,skins,servers,crash,discord,updater}.ts
src/main/util/{mime,path-safety,retry,semver}.ts
src/preload/index.ts
src/renderer/index.html
src/renderer/src/{main.tsx,App.tsx,styles.css}
src/renderer/src/lib/{ipc,utils,format,query}.ts
src/renderer/src/stores/{app,ui}.ts
src/renderer/src/components/{ui,layout,...}
src/renderer/src/pages/{Onboarding,Home,Instances,InstanceDetail,Browse,Modpacks,Skins,Servers,Logs,Settings}.tsx
src/renderer/src/i18n/{index,vi,en}.ts
tests/unit/*.test.ts
.github/workflows/{ci,release}.yml
README.md, LICENSE, CHANGELOG.md
```

---

## Milestone 1 — Foundation

### Task 1: Scaffold + build pipeline

**Files:** `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `.gitignore`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`, `src/renderer/src/styles.css`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm run typecheck`, `npm test`; window opens at 1280×832, `window.hiyo` exists.

- [ ] Create configs with Electron 45, electron-vite 6 (ESM main), React 19, Tailwind 4 via `@tailwindcss/vite`.
- [ ] Main creates BrowserWindow (contextIsolation, sandbox false for preload, nodeIntegration false), loads dev URL or file, hides menu bar.
- [ ] Preload exposes `hiyo.ping()` via contextBridge.
- [ ] Renderer renders a themed placeholder using CSS variables.
- [ ] Verify: `npm run typecheck` passes; `npm run dev` opens window (manual).
- [ ] Commit.

### Task 2: Shared contract + settings store

**Files:** `src/shared/types.ts`, `src/shared/schemas.ts`, `src/shared/ipc.ts`, `src/shared/constants.ts`, `src/main/services/{paths,store,settings,logger}.ts`, `src/main/ipc.ts`, `tests/unit/store.test.ts`

**Interfaces:**
- Produces: `Settings` (theme, mode, accent, background, density, fontScale, language, sidebarSide, animations, discordRpc, gameRoot, defaultMemoryMb, msClientId, closeToTray, onboardingDone), `DEFAULT_SETTINGS`, `getSettings()`, `updateSettings(patch)`, `JsonStore<T>` with atomic write + `.bak`.
- IPC: `settings:get`, `settings:update`, `settings:reset`, `app:info`.

- [ ] Test: default settings written once, patch merges nested objects, corrupt JSON falls back to `.bak` then defaults.
- [ ] Implement `JsonStore` (temp+rename, 0o600), settings service with `mergeDeep`.
- [ ] Implement logger writing `<userData>/logs/main.log` with rotation at 2MB, redact keys matching `/token|secret|authorization/i`.
- [ ] Register IPC with zod validation and `{ok,data}|{ok,error}` envelope; preload unwraps and throws `HiyoError`.
- [ ] Verify `npm test -- store`.
- [ ] Commit.

## Milestone 2 — Instances, versions, Java, launch

### Task 3: Version manifest + download engine

**Files:** `src/main/services/versions.ts`, `src/main/services/download.ts`, `src/main/util/{retry,path-safety}.ts`, `tests/unit/download.test.ts`

**Interfaces:**
- Produces: `listMinecraftVersions(): Promise<MinecraftVersionSummary[]>` (cached 1h, includes `type`, `releaseTime`), `getVersionJson(id)`; `downloadFile({urls, dest, sha1, size, signal, onProgress})`, `downloadFiles(files, {concurrency, onProgress})`, `sha1File(path)`.
- `MAX_CONCURRENCY = 8`, retries 3 with 1s/2s/4s, honors HTTP 429 `Retry-After`.

- [ ] Test: retry succeeds on 2nd attempt; checksum mismatch deletes `.part`; path traversal in `dest` throws `PATH_UNSAFE`.
- [ ] Implement using `fetch` + `Readable.fromWeb` + `pipeline`, `.part` files, `rename`.
- [ ] Verify.
- [ ] Commit.

### Task 4: Instance CRUD

**Files:** `src/main/services/instances.ts`, `src/main/util/path-safety.ts`, `tests/unit/instances.test.ts`

**Interfaces:**
- Produces: `InstanceStore` with `list()`, `create({name, mcVersion, loader, loaderVersion, icon?})`, `update(id, patch)`, `remove(id, deleteFiles)`, `clone(id, newName)`, `repair(id)`, `dirOf(id)`; instance ids are `nanoid`-like 12-char lowercase.
- Validates names: 1–48 chars, no `<>:"/\\|?*`, no leading dot, unique case-insensitive.

- [ ] Test: rejects `../evil`, duplicate name, creates folder tree (`mods/config/saves/...`), clone copies `instance.json` with new id, remove without deleteFiles keeps folder.
- [ ] Implement atomic `instance.json` writes; folder structure per spec.
- [ ] Verify.
- [ ] Commit.

### Task 5: Vanilla install

**Files:** `src/main/services/game.ts`, `src/main/services/versions.ts`, `tests/unit/minecraft-install.test.ts`

**Interfaces:**
- Produces: `installVanilla(mcVersion, {signal, onProgress})` → writes version JSON/jar, libraries, assets, logs; `verifyVersion(mcVersion)` returns missing files.
- Uses `@xmcl/core` `MinecraftFolder`, `Version.parse`; `@xmcl/installer` resolvers (`resolveMinecraftVersionJsonInstallFile`, `resolveLibraryInstallFiles`, `resolveAssetMetadataInstallManifest`, `resolveAssetObjectInstallFiles`) executed through `createDefaultNodeInstallRuntime` + `executeInstallManifest`, with a custom download function that reports progress.

- [ ] Test (fixture): rules filtering keeps Windows-only lib on win32 and drops macOS lib; `isAllowed` handles `allow`/`disallow`.
- [ ] Implement staged install: version json → parse → jar+libraries → assets → verify.
- [ ] Verify `Version.parse` succeeds on installed fixture version.
- [ ] Commit.

### Task 6: Java detection + runtime download

**Files:** `src/main/services/java.ts`, `tests/unit/java.test.ts`

**Interfaces:**
- Produces: `detectJava(): Promise<JavaInfo[]>` (JAVA_HOME, PATH, common dirs), `pickJava(requiredMajor, preferredPath?)`, `installRuntime(major, {onProgress})` → path, cached under `<gameRoot>/runtime/<target>`.
- Required major from version JSON `javaVersion.majorVersion`.
- Reject if selected major < required (Review Focus: Java mismatch).

- [ ] Test: parsing `java -version` output variants (8, 17, 21, `1.8.0_402`), selection prefers exact/max, rejects too-old with `JAVA_TOO_OLD`.
- [ ] Implement detection (use `resolveJava` from `@xmcl/installer`), runtime install via `fetchJavaRuntimeManifest` + file downloads (raw, chmod +x on unix).
- [ ] Verify.
- [ ] Commit.

### Task 7: Launch + log streaming

**Files:** `src/main/services/game.ts`, `src/main/services/logger.ts`, `src/shared/ipc.ts`, `src/main/ipc.ts`, `tests/unit/launch-args.test.ts`

**Interfaces:**
- Produces: `launchInstance({instanceId, accountId, server?, quickPlay?})` → `{ pid }`; events `game:state` (`preparing|downloading|launching|running|exited|crashed`), `game:log` (batch), `game:exit`; `stopInstance(id)`.
- Builds options for `@xmcl/core` `launch`: gamePath = instance dir, resourcePath = gameRoot, version = instance version id, maxMemory = instance/global, resolution, extra JVM args, `quickPlayMultiplayer`.

- [ ] Test: arg builder includes `-Xmx`, resolution flags only when set, offline user type `legacy`/`mojang` mapping.
- [ ] Implement single running game per instance, kill tree on stop, capture stdout/stderr to instance log.
- [ ] Verify with a real vanilla 1.20.1 launch (manual, offline account).
- [ ] Commit.

## Milestone 3 — Accounts

### Task 8: Auth service

**Files:** `src/main/services/auth.ts`, `src/main/ipc.ts`, `tests/unit/auth.test.ts`

**Interfaces:**
- Produces: `accounts:list`, `accounts:add-offline {name}`, `accounts:remove`, `accounts:ms-login` (device code), event `auth:device-code {userCode, verificationUri, expiresIn}`, `accounts:refresh`, `getLaunchAuth(accountId)` → `{accessToken, uuid, name, userType, properties}`.
- Storage: `accounts.json` contains profile + encrypted refresh token (`safeStorage`); access token memory-only.

- [ ] Test: offline UUID is deterministic and matches `OfflinePlayer:<name>` MD5 v3 format; token encryption round-trip with mocked safeStorage; never returns `refreshToken` to renderer.
- [ ] Implement device code flow (`https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode` and `/token`, scope `XboxLive.signin offline_access`), poll → Xbox → XSTS → Minecraft login → profile; refresh on expiry; `msClientId` from settings with `MS_CLIENT_ID` env fallback.
- [ ] Verify with offline account; mock tests for MS.
- [ ] Commit.

## Milestone 4 — Loaders

### Task 9: Loader installers

**Files:** `src/main/services/loaders.ts`, `tests/unit/loaders.test.ts`

**Interfaces:**
- Produces: `getLoaderVersions(type, mcVersion)`, `installLoader(instance, {onProgress})`, `loadedVersionId(instance)`.
- Fabric/Quilt: `resolveFabricInstallManifest` / `resolveQuiltInstallManifest` + `executeInstallManifest`; version id `fabric-loader-<loader>-<mc>` / `quilt-loader-<loader>-<mc>`.
- Forge/NeoForge: download installer to `<gameRoot>/cache/installers`, run `java -jar <jar> --installClient <gameRoot>` with cwd gameRoot; version id parsed from `versions/` new directory containing `inheritsFrom === mcVersion`.
- Requires vanilla installed first.

- [ ] Test: loader version filtering by MC version, version-id parsing, rejection of unknown loader.
- [ ] Implement with child process log capture and 10-minute timeout.
- [ ] Verify by installing Fabric + Forge 1.20.1 into a temp root (manual).
- [ ] Commit.

## Milestone 5 — Modrinth content

### Task 10: Modrinth client

**Files:** `src/main/services/modrinth.ts`, `src/shared/types.ts`, `tests/unit/modrinth.test.ts`

**Interfaces:**
- Produces: `searchProjects({query, projectType, loader, mcVersion, category, sort, offset, limit})`, `getProject(idOrSlug)`, `getProjectVersions(id, {loader, mcVersion})`, `getVersion(id)`, `getVersions(ids[])`.
- Uses `https://api.modrinth.com/v2`, User-Agent `HiyoLauncher/<version>`, 5-min in-memory cache; honors 429.
- Types: `MrProject`, `MrVersion`, `MrSearchResult`.

- [ ] Test: facet construction for loader+version, version sorting (release > beta > alpha, newest first), 429 retry with `Retry-After`.
- [ ] Implement.
- [ ] Commit.

### Task 11: Mod / resource pack / shader management

**Files:** `src/main/services/content.ts`, `tests/unit/content.test.ts`

**Interfaces:**
- Produces: `listContent(instanceId)` (installed files + metadata `.hiyo-content.json`), `installContent({instanceId, projectId, versionId, kind})`, `resolveDependencies(version, kind)` (required deps recursive, max depth 8), `toggleContent`, `deleteContent`, `checkUpdates(instanceId)`, `updateContent`.
- Kind → folder: mod→`mods`, resourcepack→`resourcepacks`, shader→`shaderpacks`, datapack→`datapacks`.
- Blocks wrong loader/MC version (Review Focus) with `CONTENT_INCOMPATIBLE`.
- Enable/disable via `.disabled` suffix.

- [ ] Test: incompatible loader rejected, dependency recursion dedupes, `.disabled` toggle preserves base name, update detection by SHA1.
- [ ] Implement metadata file `{projectId, versionId, versionNumber, filename, sha1, kind, installedAt}`.
- [ ] Verify.
- [ ] Commit.

## Milestone 6 — Modpacks

### Task 12: mrpack parser + installer

**Files:** `src/main/services/modpack.ts`, `tests/unit/mrpack.test.ts`, `tests/fixtures/sample.mrpack`

**Interfaces:**
- Produces: `parseMrpack(zipPath)` → `{name, versionId, mcVersion, loader, loaderVersion, files[], overrides, clientOverrides}`; `installModpack({projectId?, filePath, name?})` → instanceId; `checkModpackUpdate(instanceId)`.
- Uses `fflate` to read zip; validates `modrinth.index.json` formatVersion 1; path safety for every entry.

- [ ] Test: fixture pack parses loader/version/files, rejects `../` entry and absolute path, skips `env.client === "unsupported"`, applies overrides after files.
- [ ] Implement: create instance → install vanilla + loader → download files (verify sha1) → extract overrides → write modpack metadata.
- [ ] Verify with a small real Modrinth pack (manual).
- [ ] Commit.

## Milestone 7 — Skins, servers, diagnostics

### Task 13: Skins

**Files:** `src/main/services/skins.ts`, `src/renderer/src/pages/Skins.tsx`, `tests/unit/skins.test.ts`

**Interfaces:**
- Produces: `getSkin(accountId)` → texture URL/model from profile properties; `uploadSkin(accountId, filePath, variant)` (Microsoft only) using `POST https://api.minecraftservices.com/minecraft/profile/skins`; offline: store PNG locally + optional CustomSkinLoader config writer.
- UI: skinview3d preview, drag-drop PNG, model toggle.

- [ ] Test: valid PNG 64×64/64×32 accepted, wrong size rejected; offline skin path stays inside account folder.
- [ ] Implement.
- [ ] Commit.

### Task 14: Servers + SLP ping

**Files:** `src/main/services/servers.ts`, `tests/unit/server-ping.test.ts`, `src/renderer/src/pages/Servers.tsx`

**Interfaces:**
- Produces: `listServers()`, `addServer({name, ip})`, `removeServer(index)`, `pingServer({host, port})` → `{online, players, max, version, motd, latency, icon?}`.
- Reads/writes `servers.dat` (NBT, gzip) with a minimal encoder/decoder; SLP protocol 1.7+ handshake + status request over TCP with 3s timeout.

- [ ] Test: NBT round-trip for servers.dat; SLP varint encode/decode; timeout returns `online:false`.
- [ ] Implement; click server → launch instance quickPlay.
- [ ] Commit.

### Task 15: Crash diagnostics + logs page

**Files:** `src/main/services/crash.ts`, `tests/unit/crash.test.ts`, `src/renderer/src/pages/Logs.tsx`

**Interfaces:**
- Produces: `analyzeCrash(text)` → `{summary, causes: [{id, title, tip, severity}], mods?}`; log tail via `fs.watch` + ring buffer; `logs:list`, `logs:read`, `logs:analyze`, `logs:export`.
- Patterns: OutOfMemoryError, UnsupportedClassVersionError, NoSuchMethodError (mod conflict), DuplicateMods, MissingDependency, GLFW/OpenGL 1282, access violation, "A fatal error has been detected by the Java Runtime".

- [ ] Test with 5 fixture logs asserting cause ids.
- [ ] Implement UI with severity badges and copy button.
- [ ] Commit.

## Milestone 8 — Experience polish

### Task 16: Theming + settings UI

**Files:** `src/renderer/src/stores/ui.ts`, `src/renderer/src/components/theme/ThemeProvider.tsx`, `src/renderer/src/pages/Settings.tsx`, `src/renderer/src/styles.css`

**Interfaces:**
- Produces: `applyTheme(settings)` sets CSS vars (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--ring`), `data-theme` attribute; presets `ocean|aurora|voxel|mono`; custom accent via `<input type=color>`; background image/video with blur+dim; density/font scale; language; sidebar side; animations toggle.
- Default `ocean` dark: bg `#071a22`, surface `#0d2a33`, accent `#5ec8d8`, pastel text `#e6f7f9`.

- [ ] Test: preset map produces expected accent; invalid accent falls back.
- [ ] Implement; persist via `settings:update`.
- [ ] Verify visual: onboarding + home with each preset (manual screenshots).
- [ ] Commit.

### Task 17: App shell, onboarding, home, instances UI

**Files:** `src/renderer/src/App.tsx`, `components/layout/*`, `pages/{Onboarding,Home,Instances,InstanceDetail}.tsx`, `i18n/*`

**Interfaces:**
- Produces: sidebar routes, account switcher, window controls, onboarding (language → game folder → theme → first instance), home hero with Play, instance grid/list, detail tabs (Overview/Mods/Resource packs/Shaders/Settings), create instance dialog with version+loader pickers, repair/delete/clone actions.

- [ ] Implement UI components (Button, Card, Dialog, Select, Tabs, Switch, Slider, Tooltip, Progress, Skeleton, EmptyState).
- [ ] Wire IPC via TanStack Query; optimistic updates for toggles.
- [ ] Verify keyboard nav + focus ring.
- [ ] Commit.

### Task 18: Browse / Modpacks UI

**Files:** `src/renderer/src/pages/{Browse,Modpacks}.tsx`, `components/content/*`

**Interfaces:**
- Uses Task 10/11/12 IPC. Browse tabs: Mods, Resource packs, Shaders; search debounce 300ms; filters loader + MC version + category; install dialog shows dependencies; progress toast.
- Modpacks: search Modrinth `project_type:modpack`, install with step progress.

- [ ] Implement virtualized grid, skeleton loaders, error states.
- [ ] Verify with live Modrinth (manual).
- [ ] Commit.

### Task 19: Discord RPC + updater

**Files:** `src/main/services/{discord,updater}.ts`, `src/renderer/src/pages/Settings.tsx`

**Interfaces:**
- Discord: optional client id `MS_CLIENT_ID`-independent setting; presence `{details: instance, state: "Minecraft <ver> • <loader>", startTimestamp}`; disable cleanly when Discord absent.
- Updater: `updater:check` → `{available, version, notes}`; `updater:download`, `updater:install`; only in packaged builds; GitHub provider from `electron-builder.yml`.

- [ ] Implement with try/catch; never crash app if Discord absent.
- [ ] Verify build check (manual packaged).
- [ ] Commit.

## Milestone 9 — Quality gate

### Task 20: Tests, CI, docs, release

**Files:** `.github/workflows/{ci,release}.yml`, `README.md`, `LICENSE`, `CHANGELOG.md`, `docs/microsoft-auth.md`, `electron-builder.yml`, `build/icon.*`

- [ ] Add unit tests coverage for Tasks 2–15 (target: pure logic branches).
- [ ] CI: matrix ubuntu/windows/macos, `npm ci`, typecheck, test, build; release on tag with `electron-builder --publish always`.
- [ ] README: features, screenshots, download, dev setup, Azure client ID setup, offline mode disclaimer, license.
- [ ] Run full verification: `npm run typecheck && npm test && npm run build`.
- [ ] Commit + tag `v1.0.0`.

---

## Verification Commands

```bash
npm run typecheck
npm test
npm run build
npm run dev
```

## Execution Method

User delegated full autonomy ("làm hết đi", "bạn tự làm mọi thứ"). Execute natively in this session (executing-plans), verifying each milestone before moving on.
