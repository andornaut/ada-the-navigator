---
id: TBD
title: Define movement drift, aim damping and stick deflection
status: done
approved: user, 2026-11-10 (inferred from handoff history)
design: flight-rules
related: []
---

## Scope

Movement has a short drift and aim a smaller damping, and both converge promptly. A deflection speed
curve maps the stick, jets scale with speed, and Ada's ship carries a little more momentum.

## Criteria

- `gameplay/prototype.md` states the rule on `main`.
- The companion docs it touched (`gameplay/ships.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `8d2f2339`, `1a69b687`, `7e121196`, `51795056` (2026-11-10 to 2026-11-12). Main paths:
`gameplay/prototype.md`, `gameplay/ships.md`.
