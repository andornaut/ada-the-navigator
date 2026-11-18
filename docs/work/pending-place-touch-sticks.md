---
id: TBD
title: Place the touch sticks and set move reach
status: done
approved: user, 2026-11-11 (inferred from handoff history)
design: flight-rules
related: [ada-0010, ada-0015]
---

## Scope

Move reach and deadzone are in logical pixels, and the stick line extends to the thumb. The last
rule on `main` places the rings 60 from the screen's sides and 40 above its bottom, clamped inside
the game area.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/prototype.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `3c3ae477`, `750e0676`, `194c6b68`, `94cc0791`, `2afef7b5`, `2ace9c97`, `1ca3a37f`,
`94e310fa`, `ee787124` (2026-11-11 to 2026-11-12). Main paths: `gameplay/prototype.md`,
`gameplay/rules.md`.
