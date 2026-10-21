# Changelog

## 0.1.3 — 2026-10-21

- Fix: name and `x-session-name` diverged. The first-user-message upgrade moved only the slug; the auto-set session name (cwd label) stayed, so the UI and ollamaMQ showed different labels. The upgrade now renames the session to the new slug; user-set names are never overwritten. Renames that bypass the running agent (pi-web writes some directly to the session file — agegr/pi-web#1388) remain invisible to any in-process consumer, this extension included.

## 0.1.2 — 2026-10-21

- Fix package loading: declare the `pi` manifest (`pi.extensions: ["./index.ts"]`) in `package.json`. Without it pi discovered no resources from the installed package — it showed as installed but the extension never loaded.

## 0.1.1 — 2026-10-21

- Add `package.json` manifest: `pi install <git-url>` packages report their version from it (`pi list` showed "unknown").
- `package.json` is now the single version manifest; the `VERSION` file is removed.

## 0.1.0 — 2026-10-20

First release: pi extension exposing a pi session to ollamaMQ (>= 0.13.0).

- `x-session-id` / `x-session-name` / `x-session-priority` headers on every provider request.
- `/prio [normal|high|top]` command; claims durable across `/resume`, `/fork` starts clean.
- Readable session slugs (name → first user message → cwd); auto-names sessions on first start.
