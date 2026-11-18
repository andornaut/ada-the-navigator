---
id: TBD
title: Set button gaps and group order
status: done
approved: user, 2026-11-11
design: art
related: []
---

## Scope

Set the spacing between button faces and the order of buttons in a group.

## Criteria

- `STACK_BUTTON_GAP` (8) separates stacked faces, `BUTTON_GAP` (16) side-by-side faces, and `SMALL_BUTTON_GAP` (24) any face under 48.
- A group is a row whenever its buttons fit at their own widths; otherwise a column or grid.
- The primary is rightmost in a row and at the bottom in a column.

## Decisions

- One gap and order rule across all games, so every card reads the same.

## Outcome

Shipped on `main` in 8c322050, f2daabb7 and ecedb11d.
