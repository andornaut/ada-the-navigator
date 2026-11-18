---
id: TBD
title: Anchor the HUD and touch sticks to the game area
status: done
approved: user, 2026-11-11
design: art
related: []
---

## Scope

Anchor every control to the 2:1 game area clamped by the safe rect, mirror the HUD, and place the touch sticks and Use.

## Criteria

- The HUD's outermost drawn art sits `HUD_EDGE` (12) in from the game area's top and sides.
- Each stick's drawn ring edge sits 90 logical px from its outer screen side and 60 from the bottom, ignoring safe insets, clamped `STICK_AREA_MARGIN` (8) inside the game area.
- Only the move stick draws a speed line, stopping at the move input reach.
- `art/layout.md` tabulates rings, rest centres, Use and their clearances per view.

## Decisions

- Every control anchors to one game-area rect, so wider screens keep controls clear of curved corners.
- Only the move stick shows a speed line, by user decision.

## Outcome

Shipped on `main` in c68306d7, 808ba1e3, 5e877c49, dbb1b2d4, 786db142, a7d6438b, b0f2d2ad, 0fc5f32e, 1020ed7f, b4b64116, 6163a09d, 56e44ece, b7fb0978, 7187d4b0 and 38d0fdc1.
