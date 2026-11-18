---
id: TBD
title: Specify the Use conversation view, full-screen cards, ore-fuelled recharge feedback and in-view enemy fire
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-17)
design: flight-rules
related: [pending-fuel-shield-with-ore, pending-define-in-flight-conversations]
---

## Scope

Every Use conversation except Dock opens a full-screen view with Skip, and Astra stands in when no
one is present. Card lists are full screen. Shield recharge spends 1 ore per 1% and shows a "-10"
tick. Enemies fire only inside the visible game area.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/economy.md`, `gameplay/player-copy.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `703fb961` (2026-11-17). Main paths: `gameplay/economy.md`, `gameplay/player-copy.md`,
`gameplay/rules.md`.
