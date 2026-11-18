---
id: TBD
title: Build the isometric delta ship and its app icon
status: done
approved: user, 2026-11-10
design: art
related: []
---

## Scope

Build the solid isometric ship generator, export the selected compact delta profile with its canopy and fin, and draw the app icon and favicon from it.

## Criteria

- `art/tools/` builds the ship from solids in the shared projection and exports `ship-*.svg` frames connected to the space palette.
- Faces are culled toward the (1, 1, 1) viewer with depth -(x + y + z), and raised enemy parts draw after the hull.
- The canopy is an opaque faceted half-ellipsoid with a derived highlight colour; `ship-paint.json` carries `canopyHighlight`.
- `public/art/app-icon/` holds the app icon and favicon sizes.

## Decisions

- The user selected the compact delta profile and approved the culling fix.

## Outcome

Shipped on `main` in dba90900, 5748a399, 22fd995d, aa00fa6e, 8b65bf8b, b082b7b5, 7bcbe090, d318a78f, dbe0c907 and 9ee95e90.
