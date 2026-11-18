---
id: TBD
title: Apply the approved weapon tuning and contact-edge impacts
status: done
approved: user, 2026-11-14 (inferred from handoff history)
design: flight-rules
related: []
supersedes: pending-tune-weapon-ladder
---

## Scope

Canonical per-weapon damage, rate, spread and reach (for example a 16 degree Multi-Laser fan of 3 to
5 bolts at 0.7 damage, Heavy blast 60). Impacts resolve at contact edges, and player projectiles
snapshot inherited launch velocity.

## Criteria

- `gameplay/rules.md` states the rule on `main`.

## Decisions

- Replaces pending-tune-weapon-ladder.

## Outcome

Landed in `68e587fb`, `fc324858` (2026-11-14). Main paths: `gameplay/rules.md`.
