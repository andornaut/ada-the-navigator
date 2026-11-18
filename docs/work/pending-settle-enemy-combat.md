---
id: TBD
title: Settle enemy aim, standoff, pursuit and retreat
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-12)
design: ships-and-enemies
related: [ada-0015]
---

## Scope

Small drones hold standoff bands with natural lead aim from 20 to 100% by position, the interceptor
holds 150 to 250, and enemy shots fly at 0.6 of Ada's level 1 speed. Enemies pursue last-seen
positions, patrol and investigate, and retreat within bounds. 2e3e86a6 and 1c507a09 are merges.

## Criteria

- `gameplay/ships.md` and `gameplay/enemies.md` state the rule on `main`.
- The companion docs it touched (`gameplay/economy.md`, `gameplay/player-copy.md`,
  `gameplay/quests.md`, `gameplay/rules.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `7697682d`, `69d21611`, `1fb09a53`, `a32fd709`, `3ced7694`, `7244b46d`, `2e3e86a6`,
`1c507a09`, `e34f769f`, `46184980`, `87fa6b2d`, `e7beb5b9` (2026-11-12 to 2026-11-13). Main paths:
`gameplay/economy.md`, `gameplay/enemies.md`, `gameplay/player-copy.md`, `gameplay/quests.md`,
`gameplay/rules.md`, `gameplay/ships.md`.
