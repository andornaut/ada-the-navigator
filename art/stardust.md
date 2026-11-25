# Stardust

- `node art/tools/friendly.ts` draws the pickup from the model layer
  ([Friendly object redesign](friendly-redesign.md)): the core manifest's
  `stardust` strip row on `/art/pickups/pickups-sheet.svg`, with its collision
  in `/art/pickups/pickups.json`. Reruns are byte-identical.
- `node art/tools/currency-svg.ts` writes the HUD icon `icon-stardust-20`.

## Pickup

Every pickup looks the same regardless of the Stardust it carries: one
eight-faced crystal, two square pyramids on a girdle, lit from the upper left
in flat tones. Ore's [nugget](cartwheel-props.md#ore-nugget) is a squat
six-sided rust crystal, so the two read apart by shape, colour and lightness.

| Tone       | Rest      | Glint 1   | Glint 2   |
| ---------- | --------- | --------- | --------- |
| Top        | `#fff2cc` | `#ffffff` | `#ffffff` |
| Left wall  | `#f4d98a` | `#fff2cc` | `#fffbe9` |
| Right wall | `#c8a24e` | `#f4d98a` | `#fff2cc` |

- Row `stardust`: a strip of four 32 by 40 frame px frames (`frameWidth`,
  `frameHeight`), each displayed at 14 by 17.5 logical px with the pivot at
  the centre. The crystal draws 13 by 14 display px. `frames` names `rest` (0),
  `glint1` (1) and `glint2` (2); frame 3 repeats glint 1.
- Twinkle: the crystal turns an eighth, then a quarter of a facet, as its tones
  catch the light, and turns back. `loop`: rest 420 ms, glint1 60 ms, glint2
  80 ms, glint1 60 ms; 620 ms in all. Each pickup starts at a random phase so a
  cluster twinkles out of step.
- Reduced motion: the rest frame only.
- Collision: `pickups.json` `frames.stardust` holds one strictly convex part in
  frame px from the frame's top left, the rest frame's outline, for every
  frame of the strip, so the body holds still through the twinkle.
- On a light field the pickup draws over the 1 px ink keyline
  ([Light fields](galaxies.md#light-fields)), 10.90:1 on Sunflower's
  `#D8C994`; on Phantom's `#514955` over the white edge, where the left wall is
  6.22:1 on the field.
- The tractor beam has no visual. A pulled pickup's drift toward Ada is the only
  feedback.

### Optional pull streak

While a pickup is pulled, a 1 px fading streak may trail it, 6 px past the
crystal's edge. Plot single pixels behind the centre, opposite the pull
direction, at distances 2.5 to 8.5 px in 0.5 px steps. For
`f = (distance - 2.5) / 6`, the colour is the left wall tone for `f < 0.5` and
the right wall tone after, with alpha `(210 (1 - f) + 40) / 255`. Reduced
motion draws no streak.

The accepted flat look replaces the fading pixels with two flat wedges
behind the pickup, opposite the pull direction, with `u` along that
direction from the centre: a body-tone wedge `(-2.5, -1.2) (-9, 0)
(-2.5, 1.2)` in `#c9a86a` and a lit wedge `(-2.5, -0.6) (-6, 0) (-2.5, 0.6)`
in `#f6e4b8` over it, both opaque. The shipped streak spans 2.5 to 8.5 px at
1 px wide with alpha from 0.98 to 0.16; the wedges span 2.5 to 9 px and are
2.4 px wide at the pickup. On a light field the body wedge takes the ink
keyline. Reduced motion draws none ([handoff](polish-handoff.md)).

## HUD icon

`icon-stardust-20`, 20 by 20, in the UI icon sheet `icons-20x20.svg`: one
four-point star with concave shoulders in the Stardust tones under a 2 px ink
outline. It marks the HUD status pill, balances and the confirm price.

## HUD count

The count leads the HUD status pill beside the pause button:
`icon-stardust-20` and the count in bold cream `#ead4aa`, as wide as it renders,
in at most five characters ("9999", "44.4k", "100k" to "9999k", "10m"), with a gold
`+N` tick (`#f4d98a`, the crystal's left wall) on pickup. Geometry and timing are `STATUS_PILL` in
[Layout](layout.md#status-pill); colours are in
[Controls](controls.md#status-pill).
