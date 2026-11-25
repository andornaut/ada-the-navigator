# Job art in space

The station jobs' art in flight: the three landmark kinds surveys chart, a
hunt's search area and its lost item's glint (Gameplay's rules:
`gameplay/quests.md`). The board rows are in [Station and shop](shop.md#job-board),
the row icons in [Shop icons](shop-icons.md#job-icons) and the Map marks in
[Map](map.md#symbols).

- Rebuild with `node art/tools/job-art.ts`. It writes
  `public/art/landmarks/*.svg` (three-decimal coordinates for the authored
  beacon arcs, per [SVG output](README.md#svg-output)), the glint sheet `public/art/hunt-glint.png` with
  its Aseprite data `hunt-glint.json`, and [jobs.json](../public/art/jobs.json),
  and replaces its `landmark-*` and `hunt-glint` entries in the core manifest,
  after the discovery cache and ore nugget and before the `enemy-*` entries,
  and the core manifest's `jobs` link. JSON goes through the project's Prettier
  settings; reruns are byte-identical.
- Every galaxy has landmarks, so the art is shared and in core. The nebula's
  masses are white and take the galaxy's tint at runtime, keyed by galaxy id
  in `jobs.json` `tints`, as the backdrop rocks take theirs.

## Landmarks

Drawn in the galaxy's own field tones with lavender `pointOfInterest` accents,
so they stay quiet yet findable. Landmarks have no collision: Ada flies
through them. They draw on the ground layer, under play objects. Gameplay
defines no change when a landmark is charted, so the art has one state.

| Kind   | Manifest ids                                                             | Display, logical px | Pivot                              |
| ------ | ------------------------------------------------------------------------ | ------------------- | ---------------------------------- |
| Nebula | `landmark-nebula-outer`, `landmark-nebula-core`, `landmark-nebula-stars` | 475 x 225, layered  | (0.5, 0.5)                         |
| Wreck  | `landmark-wreck`                                                         | 189 x 113.4         | (0.5, 0.5)                         |
| Beacon | `landmark-beacon-a`, `landmark-beacon-b`                                 | 108 x 67.5          | (0.5, 0.5), the transmitter centre |

All are `facing: fixed`: no headings and no screen rotation, like the station.

### Nebula

- Three layers at one position, bottom to top, from `landmarks.nebula.layers`:
  the outer mass (`nebulaOuter` tint), the core (`nebulaCore` tint) and the
  stars, untinted.
- Masses: white ellipses under a Gaussian blur, standard deviation 10 for the
  outer mass and 7 for the core, all turned -6.875 degrees. Tech multiplies
  each by its tint (Phaser `setTint`), so the mass takes the tint exactly.
- Stars: one 7 x 7 and three 3 x 3 pixel sparkles, white, lavender `#c4afcc`
  and shade `#8f7c9c`, drawn crisp.

Tints, one rule (`tintRule`), in sRGB channels rounded half up:

- Dark field: `nebulaOuter` is the field's `environmentDetail` moved 0.16 of
  the way toward `pointOfInterest`, `nebulaCore` 0.34.
- Light field (`tint.light`): `nebulaOuter` is the `environmentDetail`;
  `nebulaCore` moves 0.18 toward ink `#181425`, stepping darker as Chibi's farm
  layers do.

| Galaxy id   | `nebulaOuter` | `nebulaCore` | Outer on field | Core on field | Stars on field      |
| ----------- | ------------- | ------------ | -------------- | ------------- | ------------------- |
| `base`      | `#555161`     | `#6d6578`    | 1.90:1         | 2.63:1        | Lavender 7.21:1     |
| `sunflower` | `#baab77`     | `#9d9068`    | 1.38:1         | 1.91:1        | Ink keyline 10.89:1 |
| `cartwheel` | `#957569`     | `#7f645d`    | 1.66:1         | 2.15:1        | Ink keyline 7.18:1  |
| `whirlpool` | `#92aba1`     | `#7c908b`    | 1.48:1         | 2.04:1        | Ink keyline 10.86:1 |
| `phantom`   | `#827388`     | `#907f97`    | 1.95:1         | 2.33:1        | Lavender 4.25:1     |

The masses stay under 3:1, field paint rather than signal; the stars carry
the landmark.

### Wreck

An old hull with no one aboard, split in two with debris, unlit: top
`#9d95ad`, side `#6b6482`, the break `#2a2433`, a rust band `#a77a68` and
dark windows `#3f3a4d`. The top is 5.05:1 on Whirlpool, 5.11:1 on the base
field, 5.16:1 on Cartwheel and 5.94:1 on Phantom. The stern half drifts
apart and tilts, with its fin; three debris flakes float by.

### Beacon

A horizontal satellite with a white receiver in a faceted muted-copper bus. Two
clipped-corner navy solar arrays sit at the ends of a long exposed lattice. Sky-blue gridlines
separate the cells. Lavender signal arcs mark the receiver.

The SVG uses a 48 x 30 view box and displays at 108 x 67.5 logical px, centred
on the transmitter. One pair of signal arcs sits above and below the body,
1.5 units wide with round caps. Frame A uses radius 7.5 and frame B uses
radius 12. The frames alternate every 700 ms (`frameMs`), and reduced motion
holds frame A (`reducedMotion`).

### Light field

On a light field the wreck, the beacon and the nebula's stars take the
[light-field](galaxies.md#light-fields) ink keyline (kinds `wreck`, `beacon`
and `nebulaStars` in `lightField.keylined`): 10.89:1 on Sunflower. The
nebula's masses take none: they are field paint, and Ada flies through them.

## Search area

A held hunt's search area, the circle Gameplay marks (900 world units in
radius), projects to an ellipse of 1273 x 636 logical px, so in flight only an
arc of it shows. Gameplay hides the direction indicator inside the area, so the
rim tells inside from outside. From `searchArea`:

- The projected circle, a 2 px `pointOfInterest` dash, 12 on and 8 off along
  the path, butt caps, at alpha 0.8: 5.11:1 on Whirlpool and 5.21:1 on
  Cartwheel.
- On a light field it draws over a 4 px ink dash at alpha 0.8 on the same
  path (`lightInk`), as the direction indicators: 6.92:1 on Sunflower.
- Ground layer, under play objects. Rim only: no fill inside.

## Lost item glint

The lost item is unseen until Ada is within Gameplay's glint range (160 world
units), then shows as the glint and is collected on contact.

- Core manifest id `hunt-glint`: a 45 x 15 sheet of 15 x 15 frames, displayed
  at 15 x 15 logical px with the pivot at the centre. `frames` names `rest`
  (0), `glint1` (1) and `glint2` (2); pixel art, opaque or clear, drawn with
  nearest-neighbour filtering.
- Lavender rays `#c4afcc`, shade `#8f7c9c` and a white core, so it reads as a
  point of interest and apart from Stardust's mint gem.
- Loop (`loop`): rest 420 ms, glint1 60 ms, glint2 80 ms, glint1 60 ms, as
  Stardust's. Reduced motion holds `rest`.
- Collision: each frame of `hunt-glint.json` carries `collision`, the rest
  frame's core traced by the [shared tracer](ship.md#shared-tracer); the rays
  are light, as the discovery cache's halo, so every frame carries the same
  parts.
- Light field: keylined, kind `huntGlint`.

Ping, from `glint.ping`: a world-plane ring, a 2:1 ellipse centred on the
glint, growing from 8 to 28 px across over 1200 ms, its 1 px
`pointOfInterest` stroke fading from alpha 0.9 to 0, repeating while the
glint shows. On a light field it draws over a 3 px ink ring at the same alpha.
Reduced motion draws no ping.

Accepted flat look ([handoff](polish-handoff.md)): the same ellipse and
growth, with a stroke `2 - p` px wide for progress `p`, 2 px narrowing to
1 px, at alpha 1 to `p` 0.5, 0.6 to 0.8, then 0.3, in place of the 1 px
stroke fading from 0.9 to 0.

| Mark              | Whirlpool | Cartwheel | Phantom | Sunflower           |
| ----------------- | --------- | --------- | ------- | ------------------- |
| Glint rays        | 7.13:1    | 7.28:1    | 8.38:1  | Ink keyline 10.89:1 |
| Glint core        | 14.47:1   | 14.77:1   | 17.00:1 | Ink keyline 10.89:1 |
| Ping at alpha 0.9 | 6.06:1    | 6.19:1    | 7.04:1  | Ink 3 px ring       |

## Assets

| File                                    | SHA-256                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `public/art/landmarks/nebula-outer.svg` | `ff297647e639780e5ccd34bb68fc7d771973d672778c0e9def9778fe816ce31c` |
| `public/art/landmarks/nebula-core.svg`  | `d63fed89f279d3e5a7f451c030ebdd305b75452f50ef9326b2b50a3c171aa2af` |
| `public/art/landmarks/nebula-stars.svg` | `a1b9a52d9c6027867b72311ddd335cc2637e54ce757ead12fe7725f9dbaeb880` |
| `public/art/landmarks/wreck.svg`        | `fe8a0761873babdaab096ca0291adbd32df448062168f87d4114c6e4b8dd5e74` |
| `public/art/landmarks/beacon-a.svg`     | `480e5f6431c4b767fa89714cdcdecfee2f19c01eb7966c2cafbde332e18f1163` |
| `public/art/landmarks/beacon-b.svg`     | `41b213a41328f58f7320ab865074f2c19cc9cdd1b83d7da78946ddef2113fc74` |
| `public/art/hunt-glint.png`             | `4d6e5783bb68d1f8e76cd68d8dfdf96a5dd8c33346e1162afaec0906617828cc` |
