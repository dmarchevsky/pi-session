# pi-session

A [pi](https://github.com/badlogic/pi-mono) extension that makes a pi session visible to
[ollamaMQ](https://github.com/dmarchevsky/ollamaMQ) (≥ 0.13.0, `feat/session-labels-and-priority`):
three headers on every provider request and one command.

| header | value |
|---|---|
| `x-session-id` | the pi session id (UUIDv7, stable for the life of the session; ollamaMQ keys sticky routing on it — survives compaction, which is the bug this fixes) |
| `x-session-name` | ASCII slug ≤ 64 `[a-z0-9.-]`; ollamaMQ shows it as `#slug` (display only, never keyed) |
| `x-session-priority` | `high` / `top`; omitted when normal |

Slug ladder (first match wins, re-derived on change): session name → first 4 words of the first
user message → `basename(cwd)` → `session`. If no name is set, the slug is also written as the
session name once, so `/resume` shows readable names.

## Usage

```
/prio            # show current priority, name, session id
/prio high       # claim high priority for this session (durable across /resume; /fork starts clean)
/prio top        # outranks VIP lane — use sparingly
/prio normal     # back to default (header omitted)
```

Priority claims are honoured only when pi authenticates to ollamaMQ with a **registered client
key** (`config/clients.yaml` → `om-…`, set as `Authorization: Bearer …` on the provider in
`~/.pi/agent/models.json`). With the global key only, ollamaMQ reads the request as an anonymous
ip and drops the claim (label still shows). An operator pin in the ollamaMQ UI always wins.

## Install

```
mkdir -p ~/.pi/agent/extensions/pi-session
cp index.ts ~/.pi/agent/extensions/pi-session/index.ts
```

Dev loop: `pi --extension ./index.ts`. No dependencies (`package.json` not needed).

## Cautions

- Headers go to **every** provider. They are harmless elsewhere (ASCII-safe), but if an endpoint
  ever rejects unknown `x-session-*` headers, gate on `model.baseUrl` in the
  `before_provider_headers` handler.
- Do **not** enable pi's own `sendSessionAffinityHeaders` / `sessionAffinityFormat` for an
  ollamaMQ provider while this extension is loaded — same header, two sources; the extension is
  the source.
- `before_provider_headers` ships in pi's types (1.3.0) but is undocumented; after a pi upgrade,
  re-grep `dist/core/extensions/types.d.ts` to confirm it still exists.

## Tests

`bun test` — slugify edge cases, priority parsing, branch-rebuild semantics (fork does not inherit).
