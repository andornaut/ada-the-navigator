# Touch joystick sheets

Reuse Chibi's `ui-move-hint` (ring) and `ui-move-knob` sprite sheets without visual
changes. Both on-screen sticks use the 75 by 75 ring frame and the 11 by 11 knob frame.

- Source: `andornaut/chibis-way-home`, commit `04720cc115c6db655e4b25a9cfa6630e54ce10c7`.
- Source paths: `public/art/sprites/ui-move-hint.{png,json}` and `ui-move-knob.{png,json}`.
- Public paths: `/art/ui/sprites/ui-move-hint.{png,json}` and `ui-move-knob.{png,json}`.
- UI manifest keys: `ui-move-hint` and `ui-move-knob`, paths relative to `/art/ui/`.
- `ui-move-hint` tags: `rest` 0, `held-left` 1, `held-right` 2, each 100 ms.
- `ui-move-knob` tags: `rest` 0, `held` 1, each 100 ms.
- The renderer redraws ring and knob pixels from vector layers (ink outline,
  cream at rest, white when lit) at the sheet frame sizes, with the rest pose at
  alpha 0.85. The sheets supply frame names, sizes, tags and timing.
- Only the move stick draws a speed line, under the knob, stopping at the move
  input reach; see [Controls](controls.md#touch-sticks).

PNG bytes are unchanged. JSON data is unchanged; whitespace follows Ada's formatter.
Source files remain untouched. Reuse is explicitly authorized by the project owner.

| File                | Source SHA-256                                                     | Destination SHA-256                                                |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `ui-move-hint.png`  | `9943d22562ff412e82a1eb8c5a1f70ccd7c3e9665ec954ef59da6be19ae3c45d` | same                                                               |
| `ui-move-hint.json` | `d7b6fccccf2ca6f0d96f2a003ca6a93909fb023ee6610d07169dd1a8a8503034` | `f9f6c53c5293070c81aecd493b40210fd4bbfa8914f8365f512614099f0320b8` |
| `ui-move-knob.png`  | `fd3d2e1c4d058d578f355ba13f297d8f9c476f5c08a4ad652cdac491deffa569` | same                                                               |
| `ui-move-knob.json` | `69a04cecc8eae711e2ab94f809b3128e02546fd013d0dacc1957a2737c9b41d7` | `799c0587327171580f1db81fbedb2a6b5eea438e81b99c9b0efc1ae1a5fcce3b` |
