---
id: TBD
title: Recolour the controls and define the shared card and pause card
status: done
approved: user, 2026-11-10
design: art
related: []
---

## Scope

Recolour Chibi's controls to dark lavender with a muted gold primary, write the controls contract, and define the shared content-fitted card and the pause card.

## Criteria

- `ui-button` and `ui-button-primary` sheets use the gold primary `#bfa06f` and a lavender secondary with the `#aaa4c6` highlight.
- `art/controls.md` defines buttons, switches, focus, modals, HUD icons and the stick speed line.
- Every modal uses one content-fitted card layout with centred action groups.
- The pause card lists its full action set and home is named without a city.

## Decisions

- The user revised the dark lavender set to a muted gold primary and brighter lavender secondary, and asked for a pause menu like Chibi's.

## Outcome

Shipped on `main` in 33138c3e, b2bf2f16, d0bb6479, f649c33c, 6d6029ee and f377085b.
