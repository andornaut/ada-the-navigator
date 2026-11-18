---
id: TBD
title: Picture every aboard page as Ada's ship from outside
status: done
approved: user, 2026-11-12
design: art
related: []
supersedes: pending-cockpit-holodisk.md
---

## Scope

Draw the aboard backdrop from the ship model in place of the cockpit views, with the holodisk moment and the emergency jump home.

## Criteria

- `art/tools/aboard.ts` draws the backdrop from the ship model at heading 25 over the in-between field with treatment d.
- The holodisk moment is four overlays at the hull sequenced in `aboard-holodisk.json`; the emergency jump home is red.
- The cockpit backgrounds and holodisk insert retire, and `art/aboard.md` replaces `art/cockpit.md`.

## Decisions

- The user removed cockpit views from the game; aboard pages show the ship from outside while cockpit narration stays.

## Outcome

Shipped on `main` in 4e91f37b.
