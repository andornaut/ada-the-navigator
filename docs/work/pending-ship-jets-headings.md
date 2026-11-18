---
id: TBD
title: Export the ship's speed jets, headings and nose points
status: done
approved: user, 2026-11-10
design: art
related: []
---

## Scope

Replace baked thrust flames with continuous speed jets, export Ada's ship in 32 headings and record her nose point per heading.

## Criteria

- `ship-jets.json` holds the speed jet geometry the game draws as continuous thrust.
- Ada's ship has 32 headings (`SHIP_HEADINGS`) and enemy craft 16 (`ENEMY_HEADINGS`); heading 2k keeps the former heading k's angle and polygons.
- `ship-nose.json` lists the hull's forward tip in frame px for every heading, linked as `shipNose`.
- `art/README.md` and `art/ship.md` describe the jets and heading counts.

## Decisions

- Speed jets replace thrust frames, with length growing quadratically with speed.
- More headings on Ada's ship only, since she turns most and is always on screen.

## Outcome

Shipped on `main` in 9f839f6d, f096947e, 81808dd4, d9433f8b, daa00cdc, 2fc9a05a and d76c69f3.
