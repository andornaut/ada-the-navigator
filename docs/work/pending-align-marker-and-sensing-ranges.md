---
id: TBD
title: Align Penny sensing and undiscovered station markers with the 5000 marker range
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-17)
design: flight-rules
related: [pending-unify-target-markers]
---

## Scope

Penny senses targets within the shared 5000 target-marker range, and undiscovered stations are
marked within 5000.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/economy.md`, `gameplay/player-copy.md`,
  `gameplay/quests.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `0c66efce`, `494f663e` (2026-11-17). Main paths: `gameplay/economy.md`,
`gameplay/player-copy.md`, `gameplay/quests.md`, `gameplay/rules.md`.
