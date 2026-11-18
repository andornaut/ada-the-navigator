---
id: TBD
title: Reuse Chibi's UI assets, fonts and touch joystick sheets
status: done
approved: user, 2026-11-10
design: art
related: []
---

## Scope

Import Chibi's UI sheets, font references, Settings navigation icon and touch joystick ring and knob sheets into Ada's UI manifest.

## Criteria

- The reused sheets ship under `public/art/ui/` and are listed in the UI manifest with formatted metadata.
- `art/ui.md`, `art/settings-icon.md` and `art/touch-joystick.md` record each sheet's source and use.
- The joystick ring and knob keep Chibi's frame sizes.

## Decisions

- Chibi's settings, positioning, fonts and controls are reused as the baseline so the two games share one control language.

## Outcome

Shipped on `main` in faa870ab, 70e0a63f, a551f68a and 43d4bf3c.
