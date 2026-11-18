---
id: TBD
title: Centre the Quests line disc in its 28 chip slot
status: approved
approved: Art, 2026-11-18, review of ada-0004
design: ui
related: [ada-0004, ada-0014]
---

## Scope

Lay the shared Quests list's line buttons (the map's Quests and the Paused card's Quests,
`src/ui/questsScreen.ts`) on the `art/map.md` "Quests modal" chip slot: a 28 slot from the
face's inset, `markGap`, then the label on the 50 text column (`MAP_SCREEN.quests.textColumn`).

## Criteria

- A line button's 24 disc is centred in the 28 slot, 18 to 42 from the face's left.
- Its label starts at 50, the text column the plain lines and their 28 ring use; the visible
  disc-to-label gap stays 8.
- A unit test pins the text column for mapped and plain lines; the browser smoke measures the
  rendered disc and label at 1280x720 and at 720x360 with phone insets.

## Decisions

- The disc keeps its 24 drawn size and gains 2 of side margin, so the slot, `markGap` and the
  text column all match the spec without redrawing the icon.

## Outcome

None yet.
