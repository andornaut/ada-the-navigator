# Backdrop layers

Every galaxy draws the same five layers under the play objects, in its own
field tones, so the sky moves at several depths and shows Ada's motion over an
empty stretch. Tech draws them at runtime from data; Art owns this spec.

- Rebuild with `node art/tools/backdrop.ts`. It writes the shared rules to
  [backdrop-lattice.json](../public/art/backdrop-lattice.json), linked from
  the core manifest as `backdropLayers`, and each galaxy's tones and recipes
  to `public/art/{galaxy}/backdrop-lattice.json`, linked from that galaxy's
  manifest as `backdrop`. It also writes each galaxy's
  [rare decoration](#rare-giant-decorations) sheet and the nebula textures of
  each galaxy with a nebula far look into that galaxy's manifest: Whirlpool's
  (`nebula-whirlpool-1`, `-2`) and Phantom's smoke banks
  (`nebula-phantom-1`, `-2`). Reruns are byte-identical.
- Every galaxy reads its backdrop the same way: the core manifest's
  `galaxies` maps the galaxy's id to its manifest, which links `backdrop`. A
  [placeholder galaxy](#placeholder-galaxies) has a manifest holding only that
  link, so its own art later replaces both files with no code change.
- [art/tools/backdrop-field.ts](tools/backdrop-field.ts) holds the seeded
  generation the runtime follows: the hash, the motif lattice, the checker and
  chunk placement.
- The build checks every [cap](#contrast-caps) and writes nothing when one
  fails. `--preview <dir>` also writes each checked camera's layers, stars and
  streaks included, as a PNG.

## Layers

Back to front. Parallax is the share of the camera's projected motion a layer
moves by. Play objects, effects and the HUD draw over all of them.

| Layer        | Parallax                                           | Content                                                                                                                                                                                                  | Draw                                                   |
| ------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| L0 sky       | 0                                                  | A diagonal gradient across the view from the background to a darker tone                                                                                                                                 | One quad, fixed to the view                            |
| L2 phenomena | 0 fixed, 0.05 far, 0.12 planets                    | Fixed layers a galaxy links in `fixed` (Andromeda's [haze](galaxies.md#backdrop-haze), Needle's [band](needle.md#space-look)); nebula banks and star clusters; round two-tone planets on a chunk checker | Fixed layers first, then far items and planets         |
| L1 plates    | 0.15                                               | The galaxy's motif plates on a regular lattice, in two flat steps either side of the background                                                                                                          | Darker steps `MULTIPLY`, lighter steps `SCREEN`        |
| L3 stars     | 0.3 far, 0.5 near                                  | Two depths of small stars with a slow twinkle                                                                                                                                                            | Antialiased discs                                      |
| L4 debris    | 0.6 streaks, 0.7 specks, 0.45 far rocks, 0.8 rocks | Dust streaks on a checker, the dust specks, the far rock depth and the [backdrop rocks](asteroids.md#backdrop) on a checker                                                                              | In layer coordinates; far rocks under specks and rocks |

- Every layer adds depth by density, not tone: each element is muted toward
  the field background ([Muting](#muting)), so the extra layers read as haze.
- L1 draws over L2 although it is listed after it: plates move faster than
  every phenomenon, so they read as nearer. They are tone washes rather than
  paint: a darker plate multiplies what is under it by one grey factor and a
  lighter plate screens it with one colour, so the haze, the band, planets and
  nebulae keep their shapes and hues under a plate.
- Multiply and screen are Phaser `BlendModes.MULTIPLY` and `BlendModes.SCREEN`
  on the plates' Graphics, one object per mode.

### Rare giant decorations

Each galaxy's optional `decorations` recipe adds purely decorative compositions
below the plates. Placement, parallax, jitter and weighted sizes are authored in
[backdrop-decorations.ts](tools/backdrop-decorations.ts), then published in each
galaxy's `backdrop-lattice.json`; consumers do not duplicate these values. The shared
size distribution weights approximately one, two and three screen-width
formations 6:3:1, independently of the selected signature. A screen is 720
projected gameplay pixels, not a device-pixel width or a placement cell.

The placement target is an average new visible formation every 8 to 10 screens
of projected travel. The focused travel proof must report opaque-geometry
entries, residence, simultaneous formations and quiet runs separately. A
bounding-box entry rate or the fraction of nonempty cameras does not establish
this target. Prefer the lowest measured parallax that preserves a distant feel
with bounded overlap and quiet stretches.

The recipe's `sprites` entries hold `asset`, `width`, `height` and `bodies`;
a galaxy has three or six, and the runtime picks among however many it lists.
Each body's normalized `polygons` have an `outer` ring and optional
`holes`; polygons combine by union. Coordinates follow the actual visible
drawing, with ring and hoop openings as holes. A solid formation's largest
connected piece is the body `formation` and each further piece `part-2`
onward; a planet frame's standalone moons have separate ids. The producer
derives display size from the visible formation span, not transparent canvas
margins. Independent bodies remain visibly larger than the canonical 42-pixel
ship at minimum scale.

The native SVG sources are 1024 by 768, tagged `kind: backdrop-decoration`
in the galaxy manifest. The consumer caps the longest texture edge at 1024,
uses linear filtering, shares textures across placements and retains
`BatchHandlerQuadSingle`. The rotated full bounds remain the render envelope;
visible encounter proofs use the opaque geometry. Decorations have no model
objects, collision, loot, discovery, landmark or map role. Functional landmarks,
route-map compositions and story-room art remain separate.

Every galaxy has three solid formations on its own theme, modelled in
[decoration-models.ts](tools/decoration-models.ts) as connected solids and
resolved by depth into flat tones under the one light from the upper left:
tops lightest, walls facing left mid, walls facing right darkest, round
bodies in two tones on a clean terminator. A formation is fitted inside a
60 px margin of its frame and centred. Sunflower and Andromeda also keep
their three flat planet frames, so their sets hold six frames: the planets
as sprites 1 to 3 and the solids as 4 to 6.

| Galaxy    | Frames | Solid formations                                                                                                           |
| --------- | -----: | -------------------------------------------------------------------------------------------------------------------------- |
| Sunflower |      6 | A planet inside one broad ring; a bloom of eight petals round a seed dome; a small ringed planet and three moons in an arc |
| Cartwheel |      3 | One wheel lying on its axle; two wheels on one long axle; one wheel on edge with its axle through it                       |
| Whirlpool |      3 | Two, three and one spiral arms round a domed drum                                                                          |
| Andromeda |      6 | One saucer with its lamp; two saucers stacked on one stem; three saucers stepping down in size                             |
| Needle    |      3 | A needle through one level eye ring; two eye rings on one needle; a needle threaded through an upright eye                 |
| Phantom   |      3 | One three-armed slab on a spindle; a slab over its turned double; a large and a small slab, each on its spindle            |

Sunflower's and Andromeda's planet frames are golden ringed planets with
overlapping broad rings and polygon regions, and blue-violet gas planets
with broad curved bands and distant moons.

[backdrop-decorations.ts](tools/backdrop-decorations.ts) is the native
composition producer. `backdrop.ts` writes its assets and recipes only after
the existing galaxy contrast checks pass. Each frame uses opaque colours
from that galaxy's planet recipe at full strength (before
[muting](#muting)), so overlapping forms do not compound alpha or add palette
entries. A solid formation takes three of them, light to dark: lit, body
and night. Its main solid uses all three, its second solid the two darker
ones, and a planet's ring the darkest alone. Sunflower's solids take body,
night and ring, the three tones of its planet frames, and Andromeda's take
lit, body and ring.

| Galaxy    | Solid tones (contrast on the field)            | Maximum |
| --------- | ---------------------------------------------- | ------: |
| Sunflower | `#DACDAF` 1.05, `#CEBC85` 1.14, `#CDB47C` 1.22 |  1.22:1 |
| Cartwheel | `#B8AAA9` 1.12, `#B8A2A2` 1.04, `#B4918D` 1.13 |  1.13:1 |
| Whirlpool | `#CCD6D8` 1.12, `#C2D0D5` 1.05, `#A9C1C9` 1.13 |  1.13:1 |
| Andromeda | `#A2A1AE` 1.12, `#9C9BAD` 1.04, `#8787A7` 1.22 |  1.22:1 |
| Needle    | `#CBC6BE` 1.12, `#C6C0B3` 1.05, `#B8B099` 1.14 |  1.14:1 |
| Phantom   | `#6A6277` 1.49, `#61586F` 1.29, `#524C5D` 1.05 |  1.49:1 |

Sunflower's and Andromeda's six frames, the three planets then the three
solids, are in `{galaxy}/decoration-set-sheet.svg` (3072 by 1536); every other
galaxy's three solids are in `{galaxy}/decoration-sheet.svg` (2048 by 1536).
A sheet's frames sit in rows of the least whole number of columns whose
square holds them. `node art/tools/polish-contact-sheet.ts <dir> decorations`
writes a review sheet of every frame on its field.

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
- **Chunks.** A chunked layer holds at most one item per chunk: chunk `(i, j)`
  of size `chunk` has one when `unit(seed, "i,j", salt)` is below `chance`, at
  `((i + 0.2 + 0.6 u) w, (j + 0.2 + 0.6 v) h)` with `u`, `v` from the salts
  `{salt}-x` and `{salt}-y`. Planets use salt `planet`, chunk 800 by 560 and
  chance 0.92, and draw only in the chunks whose `i + j` is even
  (`planets.checker`); far items `far`, 1100 by 700 and 0.95. With the view
  at 720 by 360 and these parallaxes, up to three planets and three far items
  overlap the view.
- **Plates.** Node `(i, j)` of the lattice `e1 = (250, 125)`,
  `e2 = (-250, 125)` (`plates.lattice`) sits at `i e1 + j e2` in layer px,
  with no jitter. A node is empty when `(i + 2 j) mod 3` is 0
  (`plates.empty`), so two nodes of every three hold a plate. A plate is the
  galaxy's motif about its node (`plates.motif.rings`, layer px: the first
  ring is the edge and a further ring a hole, filled even-odd). Nodes whose
  `i + j` is even take the first paint of `plates.steps` and odd nodes the
  second: the galaxy's first lighter and first darker step, or Andromeda's
  two darker steps (`lighter` false). Round motifs lie on the world plane and
  draw as 2:1 ellipses.
- **Planets.** The look is `planets[floor(unit("planet-look") n)]`; the radius
  is `(26 + 64 unit("planet-r")) size`. A planet is a round disc in `night`
  with one lit disc in `lit`, 1.04 radii wide, its centre 0.55 radii
  (crescent) or 0.9 radii (gibbous, moon, ringed) toward the light
  `(-0.62, -0.78)`, the upper left, clipped to the planet: two flat tones on
  a round terminator, with no facets. A ringed planet has one opaque `ring`
  band from 0.78 to 0.98 of the radii `(2, 0.42)`, tilted -14 degrees, its
  far half under the planet and its near half over it. Planets are vector:
  draw them per frame or bake each into a texture at min(DPR, 2) when its
  chunk comes into view.
- **Far items.** The look is `far[floor(unit("far-look") n)]`. A `nebula`
  draws one of its two `assets`, `floor(unit("far-variant") 2)`, centred on
  the item at 768 by 320 logical px with linear filtering; the textures are
  192 by 80 texels, straight alpha, the veil at peak alpha 0.4125 and the
  core over it at 0.6 (`nebula.alpha`). Its `core` and `veil` take the galaxy's
  nebula hue offset and chroma scale: Whirlpool's core +40 at 1.7 and veil -10
  at 1.5; Phantom's core -18 at 1.6 and veil +8 at 1.3, so its smoke stays
  violet. A `cluster` is a Gaussian glow in `glow`
  (sigma 64 by 42 px, alpha 0.5) with 90 stars in `star` at up to `alpha`,
  normally spread 47.6 by 34 px (Box-Muller on salts `cluster-{k}-r` and
  `cluster-{k}-a` of the item's cell), radius 0.5 px, or 0.8 px when
  `cluster-{k}-l` is below 0.2, at `alpha` times `0.5 + 0.5 unit("cluster-{k}-b")`.
- **Stars.** 240 px chunks per depth: 28 far stars of radius 0.55 px and 8
  near ones of 0.85 px per chunk. Star `k` of depth `d` (`far`, `near`) in
  chunk `(i, j)` sits at `((i + u) 240, (j + v) 240)` with `u`, `v` from the
  salts `star-{d}-{k}-x` and `-y`; it is 1.25 times larger when `-l` is above
  0.85; its alpha is the galaxy's `stars.alpha` for its depth times
  `0.55 + 0.45 unit("-b")`, times the twinkle.
- **Twinkle.** `0.7 + 0.3 sin(2 pi t / period + phase)` per star, with period
  `3 + 3 unit("-p")` s and phase `2 pi unit("-f")`.
- **Streaks.** One streak at the centre of every 240 px cell whose `i + j` is
  even, 44 px long and 1 px wide at the galaxy's `streaks.angle`, in
  `streaks.color` at `streaks.alpha`, with no spread and no fade.
- **Sky.** `t = smoothstep(clamp(0.45 x' + 0.75 y + offset))` with `x` and `y`
  the view position over its width and height, `x' = 1 - x` when `flip`, and
  `offset` -0.1; the colour runs from `from` (the background) at `t` 0 to `to`.
- **Specks.** `debris.specks`: one per 112 layer px cell `(x, y)`, at
  `(112 x + (37 y) % 83, 112 y + (53 x) % 79)` (JavaScript `%`) projected at
  parallax 0.7, a 1 px radius disc in `backdropSide` at alpha 0.45.
- **Rocks.** `debris.rocks` and `debris.farRocks` are two depths of the
  [backdrop rocks](asteroids.md#backdrop) with one rule: world cell `(x, y)`
  of size `cell` holds a rock when `x + y` is even (`checker`, `chance` 1),
  so no two rocks share an edge; its sprite is
  `sprites[floor(unit("{salt}-sprite") n)]`, its position
  `((x + unit("{salt}-x")) cell, (y + unit("{salt}-y")) cell)` and its scale
  `scale[0] + (scale[1] - scale[0]) unit("{salt}-scale")` times its display
  size. Rocks: salt `backdrop`, cell 320, scale 0.6 to 1, parallax 0.8. Far
  rocks: salt `backdrop-far`, cell 240, scale 0.3 to 0.5 (52 px wide at the
  smallest, wider than the 42 px ship), parallax 0.45, drawn under the specks
  and rocks.
- **Rock value.** A rock is tinted `backdropLit` (Phaser `setTint`), then
  each channel is moved toward the field background to `value` of its
  distance (0.75 for rocks, 0.4 for far rocks): `bg + (tinted - bg) value`.
  The rock stays opaque, so overlapping rocks never show through each other:
  a background-filled silhouette under the tinted rock drawn at alpha
  `value`.

| Galaxy    | Motif (`plates.motif.name`)                  | Even nodes | Odd nodes | Extreme |
| --------- | -------------------------------------------- | ---------- | --------- | ------: |
| Sunflower | `petal`: a diamond 236 by 71                 | `#DFCA99`  | `#D2C490` |  1.12:1 |
| Cartwheel | `rim`: a ring 224 by 112, opening 165 by 83  | `#BCA190`  | `#B7988C` |  1.18:1 |
| Whirlpool | `arm`: 250 degrees of a tapering spiral      | `#BDD0C4`  | `#B3C8BF` |  1.17:1 |
| Andromeda | `disc`: an ellipse 224 by 112                | `#898EA9`  | `#8E94B0` |  1.52:1 |
| Needle    | `lens`: 401 by 24 along the band, -6 degrees | `#C6BFA9`  | `#C0B6A1` |  1.11:1 |
| Phantom   | `slab`: three arms 118 long and 47 wide      | `#544D5A`  | `#4E4652` |  1.32:1 |

The producer runs the [area check](#contrast-caps) over the random cameras and
one centred on each planet look and far look it draws, and each galaxy file
records the result in `check`. `node art/tools/backdrop.ts --preview <dir>`
also writes each camera as `{galaxy}-lattice-{k}.png`.

### Muting

The build fixes every tone under its [cap](#contrast-caps), then compresses it
toward the field background (`MUTE` in the tool) before writing it, so the
data holds the drawn values:

| Element              | Compression                                                        |
| -------------------- | ------------------------------------------------------------------ |
| Plate steps          | 0.6 of the offset: multiply `1 - 0.6 (1 - m)`, screen channels 0.6 |
| Planet colours       | 0.55 of their sRGB distance from the background                    |
| Stars                | Alpha times 0.75                                                   |
| Cluster stars        | `alpha` times 0.8                                                  |
| Streaks              | Alpha times 0.8                                                    |
| Nebula, cluster glow | Shared rules: `nebula.alpha` and `cluster.glow.alpha` above        |
| Rocks, far rocks     | At runtime, by `value` ([Rocks](#generation))                      |

L2 tones are capped under the full-strength brightest plate, and the rare
decorations keep the full-strength planet tones.

## Data

`backdrop-lattice.json`, version 2, the shared rules: `view`, `order`, and per
layer `parallax` with its chunk sizes, chances, salts, sizes and geometry
(`phenomena.planets` with `checker`, `lit` and `ring`, `phenomena.nebula`,
`phenomena.cluster`, `plates` with `lattice`, `empty` and `size`, `stars`,
`debris`); `plates.blend` (`darker` `multiply`, `lighter` `screen`);
`phenomena.nebula.alpha`, baked into the textures; `stars.twinkle`;
`debris.specks` (`cell`, `alpha`), `debris.rocks` and `debris.farRocks`
(`salt`, `cell`, `chance`, `scale`, `value`, `checker`) and `debris.streaks`
(`cell`, `length`, `width`); `caps`; and `check` (the sampled
cameras and the opening size).

`{galaxy}/backdrop-lattice.json`, version 2:

| Key           | Holds                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `galaxy`      | The galaxy id                                                                                                                                                                                  |
| `placeholder` | Whether this is a [placeholder](#placeholder-galaxies) backdrop                                                                                                                                |
| `light`       | Whether the field is light (Sunflower)                                                                                                                                                         |
| `seed`        | The galaxy's seed                                                                                                                                                                              |
| `background`  | The field background the tones derive from                                                                                                                                                     |
| `sky`         | `from`, `to`, `weights`, `offset`, `flip`                                                                                                                                                      |
| `plates`      | `lighter`, the `motif` (`name` and `rings`) and its two `steps`: per step its muted `multiply` factor or `screen` colour and its resulting `color` over the background ([Plates](#generation)) |
| `planets`     | Each look's `look` (`crescent`, `gibbous`, `ringed`, `moon`), `hue` offset, `size` and `colors` (`night`, `body`, `lit`, `ring`)                                                               |
| `far`         | Each far look: `nebula` with `assets` and `colors`, or `cluster` with `colors` and `alpha`                                                                                                     |
| `fixed`       | The manifest links of fixed L2 layers drawn under the plates, fixed to the view: `backdropHaze` on Andromeda, `needleBand` on Needle, empty elsewhere                                          |
| `stars`       | `color` and `alpha` per depth. The colour is Oklab L 0.83 at the galaxy's tint hue with twice its tint chroma; Sunflower cream `#FFF7DC`                                                       |
| `streaks`     | `color` (`backdropLit`; on a light field `backdropSide`), `alpha`, `angle`                                                                                                                     |
| `check`       | The build's measured result: cameras, today's extreme tone, the new extreme tone and each signal's contrast over both                                                                          |

## Contrast caps

Area-tone caps preserve the galaxy's existing reference: its brightest backdrop
tone on a dark field, or darkest on a light field. The reference includes fixed
haze or band peaks where applicable. Recognition checks use the ink keyline on
each light field: all opened area samples must retain at least the ink's
contrast against the unchanged reference, within the existing 0.005 tolerance.
Phantom's dark field takes the same ink with no recognition floor, so its
`check` records no signal.

The 5:1 field requirement applies to the base background and its recognition
edge, not every bare ship fill over every formation. Separate diagnostics derive
Classic white and the darkest Classic hull facet from the shared ship model and
record their sampled minima, colours and locations. A bare facet can approach
1:1 at an intermediate field tone while its recognition outline remains clear;
these diagnostics are not a 5:1 or no-degradation assertion for bare fills.
Ratios are WCAG luminance contrast:

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
  after a 5 px grey opening, which drops point stars and 1 px lines, and checks
  every sampled tone against the recognition reference. The metadata records
  the minimizing source colour and location. Brightest-only sampling is not
  sufficient for a fill whose luminance lies inside the background range.
- Stars and streaks are points and hairlines, as the specks and the band's
  stars are; they stay
  below the 5:1 signal floor and smaller than Stardust, with no glint or cross
  shape.

Measured over the sampled cameras:

| Galaxy    | Recognition edge: reference / sampled minimum | Bare white / darkest hull minimum |
| --------- | --------------------------------------------- | --------------------------------- |
| Sunflower | 6.083 / 9.149                                 | 1.483 / 3.868                     |
| Whirlpool | 6.078 / 8.688                                 | 1.483 / 3.674                     |
| Needle    | 5.282 / 7.974                                 | 1.696 / 3.372                     |
| Andromeda | 3.592 / 4.178                                 | 2.675 / 1.767                     |
| Cartwheel | 4.036 / 5.727                                 | 2.247 / 2.422                     |
| Phantom   | None                                          | 6.136 / 1.000                     |

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

- L0 is one gradient quad. L1 keeps its plate lattice in two Graphics
  objects, one per blend mode, redrawn when the camera moves.
- L2 holds up to three planets and three far items on screen. Planets are
  vector or baked at min(DPR, 2) when their chunk comes into view and released
  when it leaves, up to about 2.4 MB each at DPR 2. The nebula textures are
  192 by 80 texels, 60 KB each in memory.
- L3 is about 185 discs per view. L4 holds about six streaks, about 21
  specks, two to four rocks and three to four far rocks per view; its six rock
  silhouettes include the 180 and 270 logical-px-wide decorative masses.
- Draw vector layers at min(DPR, 2). Draw the nebula textures with linear
  filtering, never nearest: at parallax 0.05 to 0.15 a layer moves less than a
  pixel per frame, and nearest filtering would make it crawl. Do not snap stars
  to the pixel grid; antialiased discs move smoothly at sub-pixel speeds.
