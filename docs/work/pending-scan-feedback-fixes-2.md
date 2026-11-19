---
id: TBD
title: Place scan receipts by Art's start and rise rules
status: approved
approved: Art review, 2026-11-18, answers on ada-0309, under the user's scan-feedback contract
design: ui
related: [ada-0309, ada-0127]
---

## Scope

Art's placement rules for the scan receipt's rectangle, refining [ada-0309](ada-0309.md). The
rise ends `SPACING.gap` under the HUD row or the conversation box. A start clamped to an edge
slides toward the centre until it has room. A start never overlaps the conversation box. The
receipt is placed in the HUD controls' rect.

## Criteria

- With no conversation line, the rise ends `SPACING.gap` (8) under the HUD row above it, the same
  gap as under the conversation box.
- A start clamped to an edge keeps the edge nearest the target and slides along it toward the
  screen's centre until it is clear of every control by `SPACING.gap` and leaves at least 48 of
  rise before its end. With no such place on that edge, it takes the nearest one on the bottom
  edge.
- A start that would overlap the conversation box moves `SPACING.gap` below it, and the rise rule
  applies from there.
- Placement uses the HUD controls' rect: the game area clamped by the safe rect.
- Tests for each; recaptures of the remembered start at 720x360, ordinary at 1280x720 with the
  conversation dismissed, and a start that would overlap the box.

## Decisions

- Every shown HUD and touch control is grown by `SPACING.gap` for clearance; the rise ends
  `SPACING.gap` below the lowest of them, or of the conversation box's parts, above its column.
- A conversation box shown or gone mid-rise starts a new rise segment from where the receipt
  is, so it never hops or moves down.

## Outcome
