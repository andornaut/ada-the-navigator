---
id: TBD
title: Order Pause and Menu by label and show Exit only in a closable installed app
status: approved
approved: user, 2026-11-18, policy 6379d03 and c14d027
design: ui
related: []
---

## Scope

Order the Paused card and the Menu card by label with Back to title above the primary bottom
button, and show Exit on the Start screen only in an installed app window that can close. Draw
the Menu button from Art's `menu.svg` poses and remove the unreachable room Paused card and its
Map path.

## Criteria

- Flight Pause: Map, Quests, Settings and Ship in two columns sorted by label, then full-width
  Back to title directly above full-width primary Resume; Map is hidden, not disabled, when the
  model does not permit it.
- Start Menu: Achievements, Exit (when shown) and Settings by label, then primary Close. Earth
  and story Menu: Achievements, Settings, Back to title, then primary Close.
- Exit (the disc at `hudButtonTarget(0)`, the Start Menu entry and Q) shows only where
  `runsInAppWindow` holds and `appCannotClose` does not; it only closes the window and never
  navigates. A browser tab keeps the back guard and shows no Exit.
- Start screen Tab order: Continue or Start, Restart, Menu, then Exit when shown.
- Browser smoke proves a tab with no Exit, an emulated installed app with Exit, the Start Menu
  and the flight Paused grid at 1280x720 and at 720x360 with phone insets.

## Decisions

- The Menu and the Paused grid sort by their labels at runtime, so the order follows the copy.
- Exit is a disc alone at the top right plus an alphabetical Start Menu entry; the retired Start
  screen Settings and Achievements discs stay hidden.
- Ada's room has no Map: its Menu replaces the room Paused card, so the room-page Map permission
  and the galaxy selection path from it are removed.

## Outcome
