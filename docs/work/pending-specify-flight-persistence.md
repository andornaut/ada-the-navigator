---
id: TBD
title: Specify flight persistence and fresh exploration history
status: done
approved: user, 2026-11-10 (inferred from handoff history)
design: flight-rules
related: [pending-keep-galaxy-geography]
---

## Scope

Closing the game resumes the same flight with exact important state. Chunks follow a hybrid
retention contract, and a compact visited-chunk bitset keeps first visits exact.

## Criteria

- `gameplay/prototype.md` states the rule on `main`.

## Decisions

- Recorded as the current approved rule; values marked provisional stay tunable.

## Outcome

Landed in `12d4745a`, `e549d692`, `3ca71839` (2026-11-10). Main paths: `gameplay/prototype.md`.
