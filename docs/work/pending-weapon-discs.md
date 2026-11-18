---
id: TBD
title: Draw the HUD weapon discs and their states
status: done
approved: user, 2026-11-10
design: art
related: []
---

## Scope

Draw the HUD weapon buttons as Chibi's disc buttons with their idle, selected and refused states, and give every weapon an opaque face.

## Criteria

- Each weapon is a 48 target with a 33 disc and a 20 glyph, anchored to the HUD rect with the pause button.
- Weapons switch at any time; a tap during the 1 s switch wait plays the Refused cue and there is no Locked state.
- Every weapon face is opaque dark; the selected face is navy `#262b44` and each inactive weapon has its own dark face.
- Tier dots align with their rings, and count text is tinted by selection.

## Decisions

- Opaque faces replace transparent centres so the glyphs keep contrast on light fields.

## Outcome

Shipped on `main` in e801230a, 5ab98d8f, b66f5965, 123b9361, 468b717b, c55c3c56 and aeae66e9.
