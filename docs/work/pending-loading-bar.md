---
id: TBD
title: Specify the loading bar
status: done
approved: user, 2026-11-11
design: art
related: []
---

## Scope

Specify the loading bar's look and the loads that show it.

## Criteria

- The bar is 3 high along the view's top edge, above all UI and ignoring safe insets: a 2-high cream fill and track over a 1 px ink rule.
- Known progress fills, holds 250 ms and fades over 150 ms; unknown progress shows a travelling segment; idle shows nothing.
- Only loads the player waits for show it, including the first-visit offline download.

## Decisions

- The ink rule keeps a full bar readable on Sunflower's light field.

## Outcome

Shipped on `main` in 8a3cde57, 8a4ec189, b4c24c60 and c9892554.
