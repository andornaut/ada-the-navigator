---
id: TBD
title: Keep galaxy geography and reset enemies on fresh entry
status: done
approved: unrecorded (Gameplay-shipped, 2026-11-15)
design: flight-rules
related: []
supersedes: pending-specify-flight-persistence
---

## Scope

Each galaxy's seed is set on first entry and kept for the playthrough, and Restart clears it. Fresh
entry resets the enemy population.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/ships.md`) agree with it.

## Decisions

- Replaces pending-specify-flight-persistence: a new layout on each flight.

## Outcome

Landed in `d0f5f19e` (2026-11-15). Main paths: `gameplay/rules.md`, `gameplay/ships.md`.
