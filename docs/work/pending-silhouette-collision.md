---
id: TBD
title: Trace drawn silhouettes into convex collision parts
status: done
approved: user, 2026-11-11
design: art
related: []
---

## Scope

Collide, hit and place every play object by its drawn silhouette, traced into convex parts by one shared tracer.

## Criteria

- `art/tools/silhouette.ts` traces a frame's drawn alpha into convex parts and fails the build unless the union matches the drawing at IoU 0.98 or more within 1 frame px.
- Ada's ship, the small enemies, heavies, traveling debris, rocks and pickups carry per-frame `collision` in their data files.
- Shots and ships hit rocks on the drawn silhouette, and rocks are placed by it; play derives a rock's reach from its collision parts.
- Ada draws in front of the objects she flies through.

## Decisions

- The user ruled that every object collides, contacts and is placed by its drawn silhouette.

## Outcome

Shipped on `main` in c025cf26, ae75a8ed, bd16ee62, 6f4b2271, 2457b8a9, b8cddbfb, 728b3674, 14fbf18c, 3a34e989 and 85476fa8.
