---
id: TBD
title: Recharge the shield 30 s after the last damage
status: done
approved: user, 2026-11-12 (inferred from handoff history)
design: flight-rules
related: [pending-fuel-shield-with-ore]
supersedes: pending-add-weapon-levels-and-phaser
---

## Scope

Recharge starts 30 s after the last damage at every level, a strip fills along the bar's bottom edge
during the delay, and nothing pulses around the ship.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/economy.md`) agree with it.

## Decisions

- Replaces pending-add-weapon-levels-and-phaser: delays 20, 15 and 10 s.

## Outcome

Landed in `7fa4a886`, `6a5979a8`, `cd5461b4` (2026-11-12). Main paths: `gameplay/economy.md`,
`gameplay/rules.md`.
