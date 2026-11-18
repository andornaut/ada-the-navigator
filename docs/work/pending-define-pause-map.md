---
id: TBD
title: Add the local Map, its tools and the Quests modal
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-11)
design: flight-rules
related: [ada-0014, ada-0015]
---

## Scope

The Map names its tools and each place's kind, shows the holodisk waypoint and distances, and holds
Return to Earth and the objective lines. Its Quests modal lists the galaxy's quests (All quests). It
outlines the central survey area, and the mapped percentage counts places inside the 25000 charting
circle. 5d395f31 also adds free weapon switching and donations.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/economy.md`, `gameplay/player-copy.md`,
  `gameplay/quests.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `5d395f31`, `266f3864`, `fd359391`, `6542909e`, `d880e9d3`, `66eb7121`, `8048b446`,
`a9109ea3`, `97909206`, `d16fcf48`, `8444fb97`, `b669c760`, `a258b5a2`, `87371491` (2026-11-11 to
2026-11-14). Main paths: `gameplay/economy.md`, `gameplay/player-copy.md`, `gameplay/quests.md`,
`gameplay/rules.md`.
