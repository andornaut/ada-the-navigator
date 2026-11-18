---
id: TBD
title: Draw the cockpit background and the holodisk
status: done
approved: user, 2026-11-11
design: art
related: []
---

## Scope

Render the cockpit close-up backgrounds with Astra's speaking patches, and draw the holodisk icons, pickup, beacon and insert.

## Criteria

- The cockpit close-up renders Ada's ship over the in-between field, muted (blur, desaturation, haze), as empty and seated backgrounds on a 960x540 logical canvas at 2x.
- The seated cockpit serves every page after Ada sits and the galaxy selector.
- The holodisk ships as 16, 20 and 24 px icons, an 11 px pickup with an 810 ms coin turn, and a dotted beacon ring with a 1.2 s pulse.
- The cockpit canopy is opaque as in game, with no hull lamp.

## Decisions

- The user approved the opaque-canopy close-up and removed Astra's hull lamp.

## Outcome

Shipped on `main` in f19c93d9, 3cf1e526, d153224d, 60b0b6ed and 0d698df2.
