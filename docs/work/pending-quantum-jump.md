---
id: TBD
title: Draw the quantum jump effect as a warp tunnel
status: done
approved: user, 2026-11-11
design: art
related: []
---

## Scope

Write the quantum jump effect data and sheets, draw the jump as a warp tunnel from the shared ship model, and ship the field and tunnel sheets as lossless WebP.

## Criteria

- `quantum-jump.json` holds the 1000 ms jump's frames, the emergency jump's red charge frame and the 900 ms reduced-motion cross-fade.
- `ship-model.ts` holds Ada's ship model with no side effects; the jump's nine poses turn, bank and stretch the ship in every paint.
- The field and tunnel sheets are lossless WebP with their PNG sources archived in `art/sources/quantum-jump/`.
- `art/quantum-jump.md` covers timings, colours and rendering.

## Decisions

- The user approved warp A (streak tunnel).
- The ship model is shared so the sprites, aboard backdrop, jump and app icon stay byte-identical where they overlap.

## Outcome

Shipped on `main` in 4696df58, 7b347a6f and 91967e02.
