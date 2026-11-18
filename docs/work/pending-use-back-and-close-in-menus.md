---
id: TBD
title: Use Back to title above Close in Menus, and Back or Close by parent in quest lists
status: done
approved: user, 2026-11-16 (inferred from handoff history)
design: flight-rules
related: [pending-define-back-navigation, pending-align-pause-actions]
---

## Scope

Every Menu outside Start shows Back to title above Close. A quest list opened from the Map or Paused
offers Back to that screen; one opened from gameplay offers Close.

## Criteria

- `gameplay/rules.md` states the rule on `main`.
- The companion docs it touched (`gameplay/player-copy.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `39105b85`, `434a96ff` (2026-11-17). Main paths: `gameplay/player-copy.md`,
`gameplay/rules.md`.
