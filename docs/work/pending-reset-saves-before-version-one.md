---
id: TBD
title: Reset incompatible saves before version 1
status: done
approved: user, 2026-11-15 (inferred from handoff history)
design: flight-rules
related: [pending-specify-flight-persistence]
---

## Scope

Before version 1 an invalid or incompatible save resets through the new-game path; the rules carry
no save migration text.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/economy.md`, `gameplay/player-copy.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `5d8e1d1f`, `494f663e` (2026-11-17). Main paths: `gameplay/economy.md`,
`gameplay/player-copy.md`, `gameplay/rules.md`.
