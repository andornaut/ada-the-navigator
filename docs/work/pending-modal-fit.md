---
id: TBD
title: Fit modals and page their content within the safe game area
status: done
approved: Art, 2026-11-13
design: art
related: []
---

## Scope

Fit Settings, Ship and the other cards to fixed width presets inside the safe game area, and page the Quests card and station catalogs instead of scrolling.

## Criteria

- Card width is `min(presetWidth, availableGameWidth)` from the fixed Large, Medium and Small presets, clamped to the safe game-area rect.
- The Quests card fills the available card area in measured pages, keeping every entry's text at full size.
- Station catalogs use every complete column and height-based pages; switching tabs starts at page one.
- Previous is hidden on the first page and Next on the last, and focus stays on a visible control.

## Decisions

- Paging replaces scrolling and text scaling, so every card keeps full type sizes.

## Outcome

Shipped on `main` in 812bb372, bb34b1f3, ebd74873, a104cf0c and 108ef3b0.
