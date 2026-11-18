---
id: TBD
title: Sell and drop ammunition per weapon
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-11)
design: economy
related: []
supersedes: pending-define-weapon-roster
---

## Scope

Laser is unlimited. Other weapons use ammunition sold in 10-Stardust packs and dropped as world
packs of a quarter shop pack for owned weapons, and each finite weapon holds at most 9999 shots.

## Criteria

- `gameplay/economy.md` states the rule on `main`.
- The companion docs it touched (`gameplay/cheats.md`, `gameplay/rules.md`) agree with it.

## Decisions

- Replaces pending-define-weapon-roster: unlimited upgraded weapons.

## Outcome

Landed in `c13e44c3`, `554825b8`, `7d94cffc`, `979ae047`, `dc532a60`, `8479fe75`, `4ecaf3f8`,
`1150b22d`, `30a82c12` (2026-11-11 to 2026-11-13). Main paths: `gameplay/cheats.md`,
`gameplay/economy.md`, `gameplay/rules.md`.
