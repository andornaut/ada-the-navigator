---
id: TBD
title: Export the frigate and capital with destructible hardpoints
status: done
approved: user, 2026-11-11
design: art
related: []
---

## Scope

Define the heavies export contract and export the frigate and capital with destructible hardpoints and aimed turrets.

## Criteria

- Heavies ship hull frames, per-hardpoint intact and destroyed sprites, shared turret tops with muzzles, and a hardpoints file with anchors, pivots and layer order.
- Every hardpoint is placed from the catalog offsets in `tools/enemy-hardpoints.json`, including the turret platform's.
- Heavies SVGs keep frame px viewBoxes and declare width and height at frame times 0.4375.
- Jets are tagged by engine id.

## Decisions

- The user approved the frigate and capital mock-ups and the hull refit.

## Outcome

Shipped on `main` in babecce9, 6e6a91f0, d32a9cd9 and 17d3f0f0.
