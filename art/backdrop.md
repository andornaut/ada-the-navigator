# Backdrop layers

Every galaxy draws the same five layers under the play objects, in its own
field tones, so the sky moves at several depths and shows Ada's motion over an
empty stretch. Tech draws them at runtime from data; Art owns this spec.

- Rebuild with `node art/tools/backdrop.ts`. It writes the shared rules to
  [backdrop.json](../public/art/backdrop.json), linked from the core manifest
  as `backdropLayers`, and each galaxy's tones and recipes to
  `public/art/{galaxy}/backdrop.json`, linked from that galaxy's manifest as
  `backdrop`. It also writes the nebula textures of each galaxy with a
  nebula far look into that galaxy's manifest: Whirlpool's
  (`nebula-whirlpool-1`, `-2`) and Phantom's smoke banks
  (`nebula-phantom-1`, `-2`). Reruns are byte-identical.
- Every galaxy reads its backdrop the same way: the core manifest's
  `galaxies` maps the galaxy's id to its manifest, which links `backdrop`. A
  [placeholder galaxy](#placeholder-galaxies) has a manifest holding only that
  link, so its own art later replaces both files with no code change.
- [art/tools/backdrop-field.ts](tools/backdrop-field.ts) holds the seeded
  generation the runtime follows: the hash, value noise, the plate pattern,
  the plate lattice and chunk placement.
- The build checks every [cap](#contrast-caps) and writes nothing when one
  fails. `--preview <dir>` also writes each checked camera's layers, stars and
  streaks included, as a PNG.

## Layers

Back to front. Parallax is the share of the camera's projected motion a layer
moves by. Play objects, effects and the HUD draw over all of them.

| Layer        | Parallax                           | Content                                                                                                                                                                | Draw                                            |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| L0 sky       | 0                                  | A diagonal gradient across the view from the background to a darker tone                                                                                               | One quad, fixed to the view                     |
| L2 phenomena | 0 fixed, 0.05 far, 0.12 planets    | Fixed layers a galaxy links in `fixed` (Andromeda's [haze](galaxies.md#backdrop-haze), Needle's [band](needle.md#space-look)); nebula banks and star clusters; planets | Fixed layers first, then far items and planets  |
| L1 plates    | 0.15                               | Large faceted plates on a seeded lattice, a few brightness steps either side of the background                                                                         | Darker steps `MULTIPLY`, lighter steps `SCREEN` |
| L3 stars     | 0.3 far, 0.5 near                  | Two depths of small stars with a slow twinkle                                                                                                                          | Antialiased discs                               |
| L4 debris    | 0.6 streaks, 0.7 specks, 0.8 rocks | Dust streaks, the dust specks and the [backdrop rocks](asteroids.md#backdrop)                                                                                          | As today, in layer coordinates                  |

- L1 draws over L2 although it is listed after it: plates move faster than
  every phenomenon, so they read as nearer. They are tone washes rather than
  paint: a darker plate multiplies what is under it by one grey factor and a
  lighter plate screens it with one colour, so the haze, the band, planets and
  nebulae keep their shapes and hues under a plate.
- Multiply and screen are Phaser `BlendModes.MULTIPLY` and `BlendModes.SCREEN`
  on the plates' Graphics, one object per mode.

## Coordinates

A layer's origin is the camera's world position projected with the scene's
isometric projection, `(x - y, (x + y) / 2)`, times the layer's parallax. A
layer point `(u, v)` draws at `(u, v) - origin + (360, 180)`, the view's
centre, in logical px. L4 places specks and rocks by their world rules at
`parallax` times the camera's world position and projects them as the scene
does, so they keep their isometric layout and move at their parallax.

## Generation

Everything is seeded per galaxy and per cell, so a galaxy's sky is the same on
every flight and costs no memory beyond what is on screen. `seed` in the
galaxy's file is fixed per galaxy in the tool (`SEEDS`), so a galaxy keeps its
sky when its id changes.

- **Hash.** `unit(seed, "i,j", salt)` is asteroid-art's backdrop rock hash:
  FNV-1a over the text `i,j:salt` from the seed, then a final mix, divided by
  2^32. The salts are named in the data or below.
- **Value noise.** An octave (`scale`, `weight`, `salt`, optional `angle` and
  `stretch`) turns the point by `angle` degrees and divides the along axis by
  `stretch`, divides by `scale`, and interpolates the lattice values
  `unit(seed, "i,j", salt)` with smoothstep weights, mapped to -1 to 1.
- **Pattern.** `plates.pattern` sums its terms: each `noise` octave times its
  weight; `wave`, `weight sin(direction . (u, v) / period + warp)`, where a
  `sine` warp is `weight sin(direction . (u, v) / period)` and a `noise` warp
  is its octave times `weight`; `spokes`, `weight cos(count a + r / twist)`
  times `clamp(1.4 - r / fade, 0, 1)`, with `r` and `a` the distance and angle
  from the centre of the point's `cell`, its v offset times `squash`.
- **Plates.** Lattice node `(i, j)` sits at `i e1 + j e2` (`plates.lattice`),
  each coordinate moved by `(unit - 0.5) jitter` (salts `plate-jx`,
  `plate-jy`). A `split` cell is two triangles along the diagonal that
  `plate-split` below 0.5 picks (`a b c` and `a c d`, else `a b d` and
  `b c d`); otherwise the cell is one plate. A plate's value is
  `patternWeight` (0.75) times the pattern at its centroid plus
  `jitterWeight` (1) times `unit - 0.5` (salt `plate-tone-{k}`, `k` the
  triangle). Its step is the number of `edges` (-0.55, -0.22, 0.3, 0.62) at or
  below the value, less 2; step 0 is sky and draws nothing. A galaxy with
  `lighter` false keeps only its darker steps.
- **Chunks.** A chunked layer holds at most one item per chunk: chunk `(i, j)`
  of size `chunk` has one when `unit(seed, "i,j", salt)` is below `chance`, at
  `((i + 0.2 + 0.6 u) w, (j + 0.2 + 0.6 v) h)` with `u`, `v` from the salts
  `{salt}-x` and `{salt}-y`. Planets use salt `planet`, chunk 1500 by 1000 and
  chance 0.55; far items `far`, 2400 by 1500 and 0.5. With the view at 720 by
  360 and these parallaxes, one or two show at most.
- **Planets.** The look is `planets[floor(unit("planet-look") n)]`; the radius
  is `(28 + 70 unit("planet-r")) size`. Lit from `light` (-0.62, -0.78), the
  upper left. Over the disc in `night`, `body` fills where the point lies
  outside a shadow disc of the same radius pushed away from the light by
  `push` r (0.42 for a crescent, 0.7 otherwise), and `lit` where it lies
  outside one pushed 1.9 times as far, inset 1.02; both shadow edges are
  14-sided (`facets`), so the terminator is faceted. A moon's `lit` draws at
  alpha 0.9. A ringed planet's ring is an ellipse of radii 2 r and 0.42 r,
  tilted `-14 + 20 unit("planet-tilt")` degrees, with bands 0.66 to 0.74 at
  alpha 0.5 and 0.78 to 0.98 at alpha 0.85; its back half draws under the disc
  and its front half over it. Planets are vector: draw them per frame or bake
  each into a texture at min(DPR, 2) when its chunk comes into view.
- **Far items.** The look is `far[floor(unit("far-look") n)]`. A `nebula`
  draws one of its two `assets`, `floor(unit("far-variant") 2)`, centred on
  the item at 768 by 320 logical px with linear filtering; the textures are
  192 by 80 texels, straight alpha. Its `core` and `veil` take the galaxy's
  nebula hue offset and chroma scale: Whirlpool's core +40 at 1.7 and veil -10
  at 1.5; Phantom's core -18 at 1.6 and veil +8 at 1.3, so its smoke stays
  violet. A `cluster` is a Gaussian glow in `glow`
  (sigma 64 by 42 px, alpha 0.7) with 90 stars in `star` at up to `alpha`,
  normally spread 47.6 by 34 px (Box-Muller on salts `cluster-{k}-r` and
  `cluster-{k}-a` of the item's cell), radius 0.5 px, or 0.8 px when
  `cluster-{k}-l` is below 0.2, at `alpha` times `0.5 + 0.5 unit("cluster-{k}-b")`.
- **Stars.** 240 px chunks per depth: 10 far stars of radius 0.55 px and 3
  near ones of 0.85 px per chunk. Star `k` of depth `d` (`far`, `near`) in
  chunk `(i, j)` sits at `((i + u) 240, (j + v) 240)` with `u`, `v` from the
  salts `star-{d}-{k}-x` and `-y`; it is 1.25 times larger when `-l` is above
  0.85; its alpha is the galaxy's `stars.alpha` for its depth times
  `0.55 + 0.45 unit("-b")`, times the twinkle.
- **Twinkle.** `0.7 + 0.3 sin(2 pi t / period + phase)` per star, with period
  `3 + 3 unit("-p")` s and phase `2 pi unit("-f")`.
- **Streaks.** Chunks of 260 px at chance 0.45 (salt `streak`), placed as
  above: one 1 px line, `26 + 46 unit("streak-length")` px long, at
  `streaks.angle` plus `(unit("streak-angle") - 0.5) 11.5` degrees, in
  `streaks.color` at `streaks.alpha`, fading to clear at both ends along a
  half sine.
- **Sky.** `t = smoothstep(clamp(0.45 x' + 0.75 y + offset))` with `x` and `y`
  the view position over its width and height, `x' = 1 - x` when `flip`, and
  `offset` -0.1; the colour runs from `from` (the background) at `t` 0 to `to`.

## Data

`backdrop.json`, version 1, the shared rules: `view`, `order`, and per layer
`parallax` with its chunk sizes, chances, salts, sizes and geometry
(`phenomena.planets`, `phenomena.nebula`, `phenomena.cluster`, `plates`,
`stars`, `debris`); `plates.blend` (`darker` `multiply`, `lighter` `screen`);
`stars.twinkle`; `caps`; and `check` (the sampled cameras and the opening
size).

`{galaxy}/backdrop.json`, version 1:

| Key           | Holds                                                                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `galaxy`      | The galaxy id                                                                                                                                                    |
| `placeholder` | Whether this is a [placeholder](#placeholder-galaxies) backdrop                                                                                                  |
| `light`       | Whether the field is light (Sunflower)                                                                                                                           |
| `seed`        | The galaxy's seed                                                                                                                                                |
| `background`  | The field background the tones derive from                                                                                                                       |
| `sky`         | `from`, `to`, `weights`, `offset`, `flip`                                                                                                                        |
| `plates`      | `lattice`, `split`, `jitter`, `lighter`, `pattern`, and `steps`: per step its resulting `color` over the background and its `multiply` factor or `screen` colour |
| `planets`     | Each look's `look` (`crescent`, `gibbous`, `ringed`, `moon`), `hue` offset, `size` and `colors` (`night`, `body`, `lit`, `ring`)                                 |
| `far`         | Each far look: `nebula` with `assets` and `colors`, or `cluster` with `colors` and `alpha`                                                                       |
| `fixed`       | The manifest links of fixed L2 layers drawn under the plates, fixed to the view: `backdropHaze` on Andromeda, `needleBand` on Needle, empty elsewhere            |
| `stars`       | `color` and `alpha` per depth. The colour is Oklab L 0.83 at the galaxy's tint hue with twice its tint chroma; Sunflower cream `#FFF7DC`                         |
| `streaks`     | `color` (`backdropLit`; on a light field `backdropSide`), `alpha`, `angle`                                                                                       |
| `check`       | The build's measured result: cameras, today's extreme tone, the new extreme tone and each signal's contrast over both                                            |

## Contrast caps

The rule: no backdrop area tone is brighter than the galaxy's brightest
backdrop tone today, or on a light field darker than its darkest. Today's
tone is the galaxy's `backdropLit` on a dark field (Andromeda's haze core or
Needle's band peak where brighter, measured from the texture and the profile) and `backdropSide` on Sunflower; a
placeholder's is the base field's. So Ada's white body
and darkest hull tone `#9AABBF`, the `obstacle` coral and Sunflower's ink
keyline never lose contrast against the backdrop. Ratios are WCAG against the
galaxy background:

| Layer            | Dark field                                                                                                   | Light field                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| L0 sky           | 1.08:1, darker only                                                                                          | 1.05:1, darker only                           |
| L1 plates        | Lighter 1.10 and 1.24:1, darker 1.08 and 1.16:1                                                              | Cream 1.05 and 1.10:1, darker 1.10 and 1.24:1 |
| L2 planets       | Body 1.30:1; lit side and ring lowered until, under the brightest plate, they stay at or under `backdropLit` | Day moon 1.05 to 1.12:1                       |
| L2 nebula        | Core tone under the same rule as the lit side                                                                | None                                          |
| L3 stars         | Far 1.8:1, near 3.0:1 at peak                                                                                | Far 1.06:1, near 1.10:1                       |
| L4 streaks       | 1.35:1 at peak                                                                                               | 1.35:1                                        |
| L4 rocks, specks | 1.8:1 ([backdrop rule](asteroids.md#backdrop))                                                               | 1.8:1                                         |

- The build checks each tone against its cap, then renders the area layers
  (L0, the fixed layers, L2 and L1) at six seeded cameras plus one centred on
  each planet and far look, takes the brightest (light field: darkest) tone
  after a 5 px grey opening, which drops point stars and 1 px lines, and fails
  if any signal's contrast over it is below its contrast over today's tone.
- Stars and streaks are points and hairlines, as the specks and the band's
  stars are; they stay
  below the 5:1 signal floor and smaller than Stardust, with no glint or cross
  shape.

Measured over the sampled cameras:

| Galaxy    | Today                      | New extreme      | Signal over today, then over the new extreme             |
| --------- | -------------------------- | ---------------- | -------------------------------------------------------- |
| Sunflower | `#A1966B` 1.79:1           | `#BAB27C` 1.30:1 | Ink 6.08, 8.38                                           |
| Cartwheel | `#643F39` 1.63:1           | `#5E353A` 1.44:1 | Obstacle 3.37, 3.81; hull 3.87, 4.37; white 9.08, 10.26  |
| Whirlpool | `#26515C` 1.66:1           | `#314E63` 1.65:1 | Obstacle 3.23, 3.25; hull 3.71, 3.73; white 8.70, 8.75   |
| Needle    | Band peak `#4F4945` 1.78:1 | `#4D4842` 1.74:1 | Obstacle 3.29, 3.36; hull 3.78, 3.86; white 8.86, 9.06   |
| Andromeda | Haze core `#6970A0` 3.12:1 | `#69709F` 3.10:1 | Obstacle 1.75, 1.77; hull 2.01, 2.03; white 4.72, 4.76   |
| Phantom   | `#49344E` 1.53:1           | `#423458` 1.52:1 | Obstacle 4.14, 4.16; hull 4.75, 4.78; white 11.14, 11.22 |

Over the brightest plate alone the obstacle stays at 4.3:1 or more and the
darkest hull tone at 5.0:1 or more on every dark field; on Sunflower the ink
keyline stays at 8.8:1 or more over the darkest plate.

## Placeholder galaxies

Every galaxy now has its own recipe. A galaxy added before its art is built
flies as a placeholder in the base space palette, with a placeholder backdrop
from the same generator (`PLACEHOLDER` in the tool), so it moves like every
other galaxy:

- Its field is the base `background` `#292734` and its rock tones the base
  `backdropLit` and `backdropSide`, as it flies.
- Monochrome: every tone keeps the base background's own hue and chroma, with
  no hue offsets, so it adds no hue. Stars are the base hue at Oklab L 0.83.
- One recipe for every placeholder: noise-toned triangles on a 420 by 365
  lattice, one grey gibbous planet look, no far items. Each galaxy's own seed
  gives it its own sky.
- `public/art/{galaxy}/manifest.json` holds no assets and only the `backdrop`
  link, and the core manifest maps the galaxy's id to it. A built galaxy's art
  replaces both files; the generator never overwrites an existing manifest.

## Reduced motion

The twinkle holds at 0.85 and nothing else animates. Parallax follows the
camera, which is Ada's own motion, so it stays. The
[selector preview](galaxies.md#selector-preview) capture includes every layer
at the capture camera.

## Performance and device pixels

- L0 is one gradient quad. L1 is up to 13 plates per view in two Graphics
  objects, one per blend mode, redrawn when the camera moves.
- L2 holds one or two items on screen. Planets are vector or baked at
  min(DPR, 2) when their chunk comes into view and released when it leaves,
  two at most, up to about 2.8 MB each at DPR 2. The nebula textures are
  192 by 80 texels, 60 KB each in memory.
- L3 is about 60 discs per view. L4 is today's rocks and specks plus two to
  four streaks.
- About two to three screens of overdraw in all. Chunk lookups are a few dozen
  hashes per frame.
- Draw vector layers at min(DPR, 2). Draw the nebula textures with linear
  filtering, never nearest: at parallax 0.05 to 0.15 a layer moves less than a
  pixel per frame, and nearest filtering would make it crawl. Do not snap stars
  to the pixel grid; antialiased discs move smoothly at sub-pixel speeds.
