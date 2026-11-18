---
id: TBD
title: Subset the UI fonts to the glyphs the game's strings use
status: approved
approved: user, 2026-11-18, download size (policy 820117b)
design: art
related: []
---

## Scope

Subset the two WOFF2 UI fonts in `public/art/ui/` to the glyphs used by every player-visible string. Tech adds the build check that every player-visible string is covered.

## Criteria

- Both fonts contain only the glyphs the strings use, plus the fallback needs of the loading-failure screen.
- The build check fails when a player-visible string uses an uncovered glyph.
- Text renders unchanged at 1280x720 and 720x360.

## Decisions

## Outcome
