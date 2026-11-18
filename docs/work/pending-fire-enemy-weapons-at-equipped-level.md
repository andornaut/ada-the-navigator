---
id: TBD
title: Fire enemy weapons at their equipped level with per-archetype signatures
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-17)
design: ships-and-enemies
related: [pending-settle-enemy-combat, pending-define-weapon-roster]
---

## Scope

Enemies fire the shared weapons at their equipped level, launch velocity inheritance and weapon
coverage are shared with Ada, and each archetype has one weapon signature instead of a weapon pool.

## Criteria

- `gameplay/ships.md` and `gameplay/enemies.md` state the rule on `main`.
- The companion docs it touched (`gameplay/rules.md`) agree with it.

## Decisions

- Pairs with the projectile parity source work that Tech integrated.

## Outcome

Landed in `ad9e4bb2`, `3f7ef388`, `69e59db9` (2026-11-17). Main paths: `gameplay/enemies.md`,
`gameplay/rules.md`, `gameplay/ships.md`.
