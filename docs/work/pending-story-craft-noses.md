---
id: TBD
title: Export story craft noses and dock poses
status: done
approved: Art, 2026-11-11
design: art
related: []
---

## Scope

Export each story craft's nose distance and drawn tip per heading through one shared helper, and hold docked craft nose to the dock face.

## Criteria

- Each story craft's jets file carries per-heading nose distance and drawn tip.
- Pip's scooter, Elder Loom's glider and Cartwheel's craft use the shared `art/tools/nose.ts`.
- A docked craft holds with its nose at the dock face.

## Decisions

- One nose helper keeps every craft's docking and shot origin rule identical.

## Outcome

Shipped on `main` in 0b86bc09, 8eba5f84 and b015784c.
