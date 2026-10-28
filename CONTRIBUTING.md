# Contributing to HiyoLauncher

Thank you for contributing. Please read this before opening a PR.

## Code of conduct

Be respectful and constructive. Harassment or discrimination is not tolerated.

## Dev setup

Prerequisites: Node.js 24, npm. Git.

```bash
git clone https://github.com/hiyo412012/HiyoLauncher.git
cd HiyoLauncher
npm install
npm run dev        # start the app in dev mode
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript checks (node + web)
npm run build      # production build
```

## Project layout

See `docs/superpowers/specs/2026-10-28-hiyolauncher-design.md` for architecture.
High-level: `src/shared` (types/IPC/schemas), `src/main` (Node services + IPC),
`src/preload` (typed bridge), `src/renderer` (React app).

## Code style

- TypeScript strict mode; avoid `any` unless unavoidable.
- Prefer small, focused modules; one service per file under `src/main/services`.
- All filesystem writes that replace files must be temp-file + rename (atomic).
- All IPC inputs validated with zod in `src/main/ipc.ts` (or domain files).
- User-facing strings go through i18n (`vi` default, `en`).
- Never import Node APIs in the renderer; use `window.hiyo`.
- Respect `prefers-reduced-motion` for animations.

## Testing

- Add unit tests for pure logic (Vitest) under `tests/unit/`.
- Run `npm test` and `npm run typecheck` before submitting.

## Pull requests

- Branch from `main`; keep PRs focused and small.
- Link the related issue in the PR description.
- Ensure CI passes (typecheck, tests, build on win/mac/linux).
- Do not commit secrets, tokens, client IDs, or local paths.
- Update `CHANGELOG.md` for user-facing changes.
- New features should include tests where practical.

## Secrets

- Never commit `.env`, tokens, or Azure client IDs.
- Microsoft OAuth uses a public client (device code); no client secret is needed.
- Report security issues privately — see `SECURITY.md`.