# Job art in space

The station jobs' art in flight: the three landmark kinds surveys chart, a
hunt's search area and its lost item's glint (Gameplay's rules:
`gameplay/quests.md`). The board rows are in [Station and shop](shop.md#job-board),
the row icons in [Shop icons](shop-icons.md#job-icons) and the Map marks in
[Map](map.md#symbols).

- Rebuild with `node art/tools/job-art.ts`. It writes
  `public/art/landmarks/*.svg`, the glint sheet `public/art/hunt-glint.png` with
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

| Kind   | Manifest ids                                                             | Display, logical px | Pivot                                      |
| ------ | ------------------------------------------------------------------------ | ------------------- | ------------------------------------------ |
| Nebula | `landmark-nebula-outer`, `landmark-nebula-core`, `landmark-nebula-stars` | 380 x 180, layered  | (0.5, 0.5)                                 |
| Wreck  | `landmark-wreck`                                                         | 140 x 84            | (0.5, 0.5)                                 |
| Beacon | `landmark-beacon-a`, `landmark-beacon-b`                                 | 45 x 60             | (0.5, 0.825), the float on the world plane |

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
| `cartwheel` | `#644d4e`     | `#796269`    | 1.90:1         | 2.64:1        | Lavender 7.28:1     |
| `whirlpool` | `#435760`     | `#5f6a78`    | 1.90:1         | 2.63:1        | Lavender 7.13:1     |
| `black-eye` | `#544052`     | `#6c586c`    | 1.84:1         | 2.68:1        | Lavender 8.55:1     |

The masses stay under 3:1, field paint rather than signal; the stars carry
the landmark.

### Wreck

An old hull with no one aboard, split in two with debris, unlit: top
`#9d95ad`, side `#6b6482`, the break `#2a2433`, a rust band `#a77a68` and
dark windows `#3f3a4d`. The top is 5.05:1 on Whirlpool, 5.11:1 on the base
field, 5.16:1 on Cartwheel and 6.05:1 on Black Eye. The stern half drifts
apart and tilts, with its fin; three debris flakes float by.

### Beacon

A float, a mast with a crossbar, a lavender lamp with a white core and one
pair of signal arcs, 1.5 wide with round caps: inner (radius 7.5) in frame A,
outer (radius 12) in frame B. The frames alternate every 700 ms (`frameMs`),
like the station's blink; reduced motion holds frame A (`reducedMotion`).
Lavender `#c4afcc` lamp and float top, shade `#8f7c9c`, mast `#b5a2c0`,
crossbar `#6f5f7d`.

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

| Mark              | Whirlpool | Cartwheel | Black Eye | Sunflower           |
| ----------------- | --------- | --------- | --------- | ------------------- |
| Glint rays        | 7.13:1    | 7.28:1    | 8.55:1    | Ink keyline 10.89:1 |
| Glint core        | 14.47:1   | 14.77:1   | 17.34:1   | Ink keyline 10.89:1 |
| Ping at alpha 0.9 | 6.06:1    | 6.19:1    | 7.17:1    | Ink 3 px ring       |

## Assets

| File                                    | SHA-256                                                            |
| --------------------------------------- | ------------------------------------------------------------------ |
| `public/art/landmarks/nebula-outer.svg` | `09e84f49d019d4928909eaada1399975907093c62ea36b8fb0bd1355bab75c8f` |
| `public/art/landmarks/nebula-core.svg`  | `b9f4368ae954e4ffe3587f7f50b395c6971d61e2ced6bd5479ca639d07fc499e` |
| `public/art/landmarks/nebula-stars.svg` | `196cbd59363b6b06f160d4bf819a8882c0d67b1aa984cf0de7dd82c114aba975` |
| `public/art/landmarks/wreck.svg`        | `8d027a10449d22af4972cef7caf476c60b28d03ddc814c8043c460b92350655f` |
| `public/art/landmarks/beacon-a.svg`     | `17bacf5f373f48fb6bc857d4badcf009178d09068437917e294a8a317d3fc9a5` |
| `public/art/landmarks/beacon-b.svg`     | `47b79d57037fe4501a3eddf47987651a2b4c8b54280d1416ea994fd47a15978a` |
| `public/art/hunt-glint.png`             | `4d6e5783bb68d1f8e76cd68d8dfdf96a5dd8c33346e1162afaec0906617828cc` |
