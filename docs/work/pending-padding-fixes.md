---
id: TBD
title: Fix the eleven padding mismatches from the drawn-pixel audit
status: approved
approved: user, 2026-11-18, fix the 11 mismatches
design: art
related: [ada-0278]
---

## Scope

Fix the 11 mismatches from the ada-0278 audit: the map header panel, the locked galaxy "..." label, the status pill with cargo or tow last, the item notice chip, the Quests line chip inset, the Rapid Missile disc glyph, the Disabled banner, the galaxy name pills and the Pause grid button lip. Labels are measured on the cap band, content-fitted pills match their vertical padding, and the tow icon is re-centred. Minor 1 to 2 px items stay.

## Criteria

- Each fixed element measures within 1 logical px on every side on rendered pixels at 1280x720 and 720x360 with insets.
- Spec changes are in art/layout.md and art/map.md; asset changes go through their producers.

## Decisions

## Outcome
