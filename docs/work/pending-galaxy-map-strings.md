---
id: TBD
title: Read the galaxy map's destination and Earth panel strings from content
status: approved
approved: Gameplay, 2026-11-18
design: ui
related: [ada-0004]
---

## Scope

Move the galaxy map's destination actions ("Jump to {galaxy}", "Stay in {galaxy}", "Jump to
Earth", "Stay on Earth") and the Earth panel's kicker "Home", title "Earth" and description
from `src/ui/galaxyMap.ts` into the content labels, beside `galaxyLockedAction`.

## Criteria

- The galaxy map reads these strings from `CONTENT.labels` through its labels option, as it
  reads `lockedAction`.
- Rendered text is unchanged and matches gameplay/player-copy.md and gameplay/rules.md.
- Unit tests read the strings from content and still pin the literal text.

## Decisions

- Each listed action has its own key, so "Jump to Earth" and "Stay on Earth" are explicit strings
  rather than a filled galaxy template.
- `{galaxy}` is filled with `String.replace`, as the map fills `{number}` in "Galaxy {number}".

## Outcome

None yet.
