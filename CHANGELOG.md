# Changelog

## 0.1.1 — 2026-10-21

- Add `package.json` manifest: `pi install <git-url>` packages report their version from it (`pi list` showed "unknown").
- `package.json` is now the single version manifest; the `VERSION` file is removed.

## 0.1.0 — 2026-10-20

First release: pi extension exposing a pi session to ollamaMQ (>= 0.13.0).

- `x-session-id` / `x-session-name` / `x-session-priority` headers on every provider request.
- `/prio [normal|high|top]` command; claims durable across `/resume`, `/fork` starts clean.
- Readable session slugs (name → first user message → cwd); auto-names sessions on first start.
