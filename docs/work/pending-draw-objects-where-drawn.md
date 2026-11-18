---
id: TBD
title: Collide, hit and place every flight object where it is drawn
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-11)
design: flight-rules
related: []
---

## Scope

Ships, shots and pickups contact objects at their drawn silhouettes, placement clearances use the
silhouette radius, and flown-through objects stay passable and draw behind Ada.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/economy.md`, `gameplay/ships.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `97cea61d`, `60fb7a11`, `f21a8928`, `8b561ca3`, `626ea496` (2026-11-11). Main paths:
`gameplay/economy.md`, `gameplay/rules.md`, `gameplay/ships.md`.
