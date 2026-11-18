---
id: TBD
title: Fuel shield recharge with ore
status: done
approved: user, 2026-11-12 (inferred from handoff history)
design: economy
related: [pending-define-shield-recharge, ada-0015]
---

## Scope

After the 30 s delay each ore funds 1% of maximum shield at the normal rate, so a full refill costs 100. Without ore, recharge stops at 10%. Ore rocks occur in every galaxy.

## Criteria

- `gameplay/economy.md` states the rule on `main`.
- The companion docs it touched (`gameplay/quests.md`) agree with it.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `3dba5587`, `f3b1e5f3` (2026-11-12). Main paths: `gameplay/economy.md`,
`gameplay/quests.md`.
