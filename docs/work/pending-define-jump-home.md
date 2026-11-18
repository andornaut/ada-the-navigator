---
id: TBD
title: Define the jump home, overnight recharge and ore on failure
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-11)
design: flight-rules
related: []
---

## Scope

The jump home costs only the flight and lands in Ada's room with an overnight recharge. The
emergency jump tints red and its warning holds three visible seconds. Mined pieces are ore, ore
stays aboard across galaxies and home, and a shield-failure jump loses half the undeposited ore.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/economy.md`, `gameplay/player-copy.md`,
  `gameplay/prototype.md`, `gameplay/quests.md`, `gameplay/ships.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `f3ae8ed7`, `c7da1642`, `5e04474b`, `645fbf26`, `a8475d3e`, `48a5a890` (2026-11-11 to
2026-11-13). Main paths: `gameplay/economy.md`, `gameplay/player-copy.md`, `gameplay/prototype.md`,
`gameplay/quests.md`, `gameplay/rules.md`, `gameplay/ships.md`.
