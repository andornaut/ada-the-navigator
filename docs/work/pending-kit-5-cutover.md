---
id: TBD
title: Cut over to coordination-kit 1 and delivery-kit 5
status: approved
approved: game-coordinator, 2026-11-18, shared kit cutover
design: tooling
related: [ada-0044]
---

## Scope

Pin coordination-kit 1.0.0 beside delivery-kit and move the coordination surfaces it took over
from delivery-kit 5.0: the `message`, `inbox`, `ledger`, `protocol`, `harness`, `claude` and
`codex` commands and the `/build/registry`, `/build/transport`, `/build/accounting` and
`/build/protocol` imports. `run`, `status`, `control`, gate configuration and
`/build/source-identity` stay on delivery-kit.

## Criteria

- coordination-kit and delivery-kit are exact published tarballs with committed lockfile
  integrity; delivery-kit 5 requires coordination-kit `>=1.0.0 <2.0.0`.
- No game script, tool, test, config or doc calls a moved command or import through delivery-kit.
- The runner is replaced only while idle, after the separate cutover notice.

## Decisions

- coordination-kit 1.0.0 declares no dependencies or peers and requires Node `>=24.21.0`, which
  the pinned Node 24.22.2 meets.
- The kit smoke test validates the registry through `@andornaut/coordination-kit/build/registry`.

## Outcome

Pending.
