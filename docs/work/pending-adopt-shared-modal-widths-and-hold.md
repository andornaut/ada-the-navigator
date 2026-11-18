---
id: TBD
title: Adopt the shared modal widths and the 500 ms detail-card hold
status: done
approved: user, 2026-11-18 (shared policy 7bf3ea5)
design: flight-rules
related: [pending-add-detail-cards]
---

## Scope

Modals use Large 688, Medium 500 and Small 400 widths with a 16 px screen margin, full-screen views
excluded, and the detail-card hold is 500 ms.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/economy.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `88a3f599` (2026-11-18). Main paths: `gameplay/economy.md`, `gameplay/rules.md`.
