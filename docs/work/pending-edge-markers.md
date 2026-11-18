---
id: TBD
title: Specify the off-screen edge markers
status: done
approved: user, 2026-11-12
design: art
related: []
---

## Scope

Specify the markers that point to off-screen objects, the threat red, and the route guard's marker.

## Criteria

- Edge markers sit 1 px inside the game area clamped by the safe rect, never under a notch or the home bar.
- A route guard is a 10 coral disc with a 7 by 2 ink bar; the bar fades over 150 ms when the guard is disabled, or at once under reduced motion.
- `art/layout.md` tabulates the marker lines and clearances per view.

## Decisions

- The user chose guard marker A and markers inside the safe area.

## Outcome

Shipped on `main` in 3f10cff7, df5225f6, 2aea6365 and 8013bf82.
