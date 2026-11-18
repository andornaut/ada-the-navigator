---
id: TBD
title: Scale Ada's top speed and turn rate by engine level
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-12)
design: flight-rules
related: []
supersedes: pending-define-movement-and-aim
---

## Scope

Top speed is 175, 200 and 225 by engine level. Aim turns in 0.08, 0.07 and 0.06 s and movement turns
half as fast. Current and towing speeds are restated for the 175 base. Also settles fixed shot
speeds, hazard damage, lance cadence and position-keyed drops.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/economy.md`, `gameplay/ships.md`) agree with it.

## Decisions

- Replaces pending-define-movement-and-aim: top speed and curve values.

## Outcome

Landed in `d12488c3`, `1e9c3f8a`, `d84550ea`, `4f6c57e3` (2026-11-12). Main paths:
`gameplay/economy.md`, `gameplay/rules.md`, `gameplay/ships.md`.
