---
id: TBD
title: Drop upgrades one level at a time by category weight
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-12)
design: economy
related: []
---

## Scope

Destroyed heavies drop double Stardust and no weapon; salvaged ones double the weapon chance and
stay in place. Any usable upgrade drops one level at a time, weighted by category, at the same rates
everywhere. Each galaxy unlocks one weapon for shops and drops.

## Criteria

- `gameplay/economy.md` states the rule on `main`.
- The companion docs it touched (`gameplay/quests.md`, `gameplay/rules.md`, `gameplay/ships.md`) agree
  with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `8a155af9`, `635cddcb`, `aa21c77d`, `7d19369e`, `ca83a400`, `e354efa0` (2026-11-12). Main
paths: `gameplay/economy.md`, `gameplay/quests.md`, `gameplay/rules.md`, `gameplay/ships.md`.
