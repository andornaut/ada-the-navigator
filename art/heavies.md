# Galaxy one heavies

The frigate and the capital are a hull plus destructible hardpoints, and every
turret aims at Ada independently of the hull. Tech composes each frame from
layers; Gameplay owns hardpoint ids, positions, hit areas and the rules for
damage, speed and defeat. Hit areas are flat circles in the world plane, so
art heights never affect collision.

- Rebuild with `node art/tools/heavies.ts`. It reads
  `tools/enemy-hardpoints.json`, writes `public/art/enemies/` and replaces its
  own manifest entries in place, after the sector one enemies.
  `--offsets <file.json>` reads another file in the same format; `--out <dir>`
  writes the files and a `manifest-entries.json` to that directory and leaves
  the manifest alone.
- Models, projection and part order are shared with the
  [sector one enemies](enemies.md) through `art/tools/crafts.ts` and
  `art/tools/projection.ts`. `art/tools/enemies.ts` replaces only its own hull
  entries, `enemy-{swarm,fighter,interceptor,retaliator}-{k}`.

## Crafts

`display = frame * 0.4375`, as for every enemy. Spans and lengths are the drawn
craft in Ada widths of 42.88 model units.

| Archetype | Frame | Display | `sizeRatio` | Span x length | Files |
| --------- | ----: | ------: | ----------: | ------------- | ----: |
| `frigate` |   384 |     168 |           4 | 3.27 x 4.26   |   130 |
| `capital` |   480 |     210 |           5 | 5.04 x 5.50   |   258 |

- Frigate: long hunter with twin prow tines, a single-barrel gun turret on each
  sponson (`port`, `starboard`) and a raised `engine` block that caps the
  stern, with two jet mouths.
- Capital: broad flagship with a great claw prow, a `command` tower at the
  centre, a nacelle on each side of the stern (`engine-left`, `engine-right`)
  and four twin-barrel deck turrets: `weapon-left` and `weapon-right` on the
  shoulders, `weapon-rear-left` and `weapon-rear-right` on the wings. Its four
  escorts are the existing `fighter` frames.

## Offsets input

Positions have one source: `tools/enemy-hardpoints.json`, which Tech exports
from Gameplay's catalog. The tool places each hardpoint's drawing at its offset
and projects it per heading; no art file authors a hardpoint position or a hit
radius.

- `version` 1; `archetypes[a]` has `sizeRatio` and `hardpoints`, each with
  `id`, `role` (`command`, `engine` or `turret`), `offset` and `order`. Other
  fields are ignored.
- `offset` is `[x, y]` in fractions of the hull width (`sizeRatio` Ada widths)
  in the hull's local frame: `-y` forward, `+x` starboard. Model units are
  `offset * sizeRatio * 42.88`.
- Each drawn archetype's id set and every `role` must match the art exactly, or
  the tool stops without writing. Output lists hardpoints in `order`.
- Art owns the heights, the drawing around each origin, the jet mouths around an
  engine's origin and the barrel muzzles around a turret's pivot. The hulls are
  shaped so every hardpoint sits on the deck or against the hull edge at the
  catalog positions.

## Files

All in `public/art/enemies/`. `{a}` is the archetype, `{h}` a hardpoint id
exactly as in the catalog, `{t}` a turret top design, `{k}` a hull heading and
`{i}` an aim index, each `0..15`.

| File                      | One per                   | Content                                     |
| ------------------------- | ------------------------- | ------------------------------------------- |
| `{a}-{k}.svg`             | heading                   | Hull with no hardpoints                     |
| `{a}-{h}-{state}-{k}.svg` | hardpoint, state, heading | The hardpoint base, centred on its anchor   |
| `{a}-{t}-top-{i}.svg`     | top design, aim           | The turret top, centred on its pivot        |
| `{a}-hardpoints.json`     | archetype                 | Anchors, pivots, layer order and muzzles    |
| `{a}-jets.json`           | archetype                 | Speed jets, each mouth tagged by its engine |

Turrets with identical drawings share one top set: the frigate's two guns use
`gun` and the capital's four turrets, bolt and missile alike, use `turret`.

Sprite frames are square, a multiple of 8 px, and hold every heading and state
of that hardpoint around a centred pivot. Every heavies SVG keeps its `viewBox`
in frame px and declares its display size (frame times 0.4375) as `width` and
`height`, so it rasterizes at the size it is drawn. Anchors, pivots, muzzles
and jets stay in frame px. The sector one enemy SVGs declare their frame size.

| Sprite                     | Base frame | Base display | Top frame | Top display |
| -------------------------- | ---------: | -----------: | --------: | ----------: |
| Frigate hull               |        384 |          168 |           |             |
| Capital hull               |        480 |          210 |           |             |
| Frigate gun                |         48 |           21 |        88 |        38.5 |
| Frigate engine             |         80 |           35 |           |             |
| Capital command            |         72 |         31.5 |           |             |
| Capital engine (each side) |         88 |         38.5 |           |             |
| Capital turret             |         48 |           21 |        80 |          35 |

## Manifest entries

- `width` and `height` are the frame px of the `viewBox`, the space every
  frame-px value refers to; `displayWidth` and `displayHeight` are the drawn
  size, which is also the SVG's declared size.
- Hull: `enemy-{a}-{k}`, the same fields as every enemy heading frame.
- Hardpoint base: `enemy-{a}-{h}-{state}-{k}` with `path`, `width`, `height`,
  `displayWidth`, `displayHeight` (frame times 0.4375), `facing` `world-{k}`,
  `directionIndex` `k`, `hardpoint`, `state`, `pivot` `{ 0.5, 0.5 }` and
  `archetype`.
- Turret top: `enemy-{a}-{t}-top-{i}` with the same fields except `aimIndex`
  `i` and `facing` `world-{i}` in place of `directionIndex`, and `top` `t` in
  place of `hardpoint` and `state`.
- Hardpoint and top ids never match the hull pattern `enemy-{archetype}-{index}`,
  so hull heading sets stay complete and separate.

## Hardpoints file

`{a}-hardpoints.json`, version 1. Positions are frame px in the hull frame
(pivot at its centre), except muzzles; scale every value by the display size
like the hull frame.

- `archetype`, `frame`: the hull archetype and frame size.
- `hardpoints[]`, in catalog order: `id`, `role`, `states`
  (`["intact", "destroyed"]`) and `top` (the top design, or `null`).
- `headings[k]`: `index`; `order`, the layer ids for hull heading `k` far to
  near, with `hull` among them; `hardpoints[]` with `id`, `anchor` (the
  projected hardpoint origin at its anchor height, where that hardpoint's base
  sprite centre goes) and, for turrets, `pivot` (the projected top pivot, where
  the top sprite centre goes).
- `tops[t][i]`: `index` (aim `i`) and `muzzles`, one `[x, y]` per barrel tip in
  frame px relative to the pivot.

## Composing a frame

1. Pick hull heading `k` from the hull facing with the existing enemy rule.
2. For each id in `headings[k].order`: `hull` draws `{a}-{k}`; a hardpoint
   draws its base for its current state with the sprite centre at `anchor`.
   An intact turret then draws its top `{a}-{t}-top-{i}` at `pivot`.
3. Pick each top's aim index `i` from that turret's world aim angle with the
   same rule as hull headings: index `i` faces world angle `i * 22.5` degrees,
   whatever the hull heading. Tech turns each aim with the ship's
   `aimTurnSeconds`. `pivot` plus a muzzle is that barrel tip in hull frame px.
4. Draw speed jets behind the composed frame.

Layer order: a hardpoint whose intact base rests on the hull top (base at or
above the hull top) draws after the hull. The others, the capital's nacelles,
sort with the hull far to near by the depth of their origin. Ties draw the
lower base first, then by id. Within each sprite, parts follow the
[shared rule](enemies.md#frames), and a part hosted on a raised part draws
straight after it.

## States

- `intact` and `destroyed` per hardpoint. A destroyed turret is a low scorched
  stump with a breach and no top. A destroyed engine or command is a scorched
  wreck of its block, pod or tower with a breach and one ember; parts on the
  deck also leave ragged scorch paint around them.
- Intact turrets stand on a fixed collar 1.5 units high (`{h}-intact`); the
  aimed top carries the head, barrels and hatch.
- Hit flash is a tint over the hardpoint's base and top. There are no flash
  frames.

## Speed jets

`{a}-jets.json` uses the [family jets schema](enemies.md#speed-jets) for its
frame. Each mouth also has `hardpoint`, the id of the engine that drives it.
Draw a mouth only while that engine is intact.

| Archetype | Mouths | Engine                                   | Width | Height |
| --------- | -----: | ---------------------------------------- | ----: | -----: |
| `frigate` |      2 | `engine` (both)                          |    10 |     11 |
| `capital` |      2 | `engine-left`, `engine-right` (one each) |    12 |      6 |

Mouth width and height are model units.

## Retaliator turret

The retaliator's gun is its hull weapon's aim mount, not a hardpoint, and
destroying the hull defeats it. Its turret head and barrels are flagged
`turret` in `art/tools/crafts.ts`, and `art/tools/heavies.ts` models them as a
top over a fixed collar, but the retaliator export is unchanged: it ships with
Tech's mount offset and turret-top renderer.

## Palette

Family colours follow [sector one enemies](enemies.md#family-style), with the
turret top `#c27a62`. Wrecks add:

| Role                        | Colour    | Contrast                                |
| --------------------------- | --------- | --------------------------------------- |
| Scorch top                  | `#5c3a31` | 3.70:1 on coral `#d68b72`               |
| Scorch side                 | `#42291f` | 2.96:1 on coral side `#a8654f`          |
| Burn (scorch paint on deck) | `#6e4436` | 3.07:1 on coral                         |
| Breach                      | `#1e1a26` | 1.71:1 on scorch; the visor side colour |
| Ember                       | `#f0a07c` | 8.14:1 on breach, 4.76:1 on scorch      |

The coral hull is 5.41:1 on the Sunflower field `#332712` and 5.44:1 on the
default field `#292734`. Scorch is 1.46:1 and 1.47:1 on those fields, so deck
wrecks read against the coral hull; a destroyed nacelle reads by its ember,
6.96:1 and 6.99:1 on the fields.

## Cartwheel claim jumpers

Cartwheel's drones and heavies are one family: the four sector one drones, the
frigate and the capital recoloured into rust, steel and ember, plus the turret
platform. Sunflower keeps the coral originals.

- Rebuild with `node art/tools/claim-jumpers.ts`, which takes the same
  `--offsets <file.json>` as `heavies.ts`. It draws the shared models in
  process, writes `public/art/cartwheel/enemies/` and replaces its own manifest
  entries in place, after the heavies and before Cartwheel's story craft.
- Models, parts, frames, headings, hardpoints, anchors and muzzles match the
  coral family; only fills change. Every SVG and shards file goes through the
  colour swap below, and the tool stops on any colour outside the family.
- The jets and hardpoints files are the coral family's, unchanged: the jets keep
  Gadget's family jet colours. Destruction uses the shared `destruction.json`
  timing and flash with the claim shards.

### Claim files and entries

- File names are the coral names in `public/art/cartwheel/enemies/`:
  `{a}-{k}.svg`, `{a}-jets.json` and `{a}-shards.json` for `swarm`, `fighter`,
  `interceptor` and `retaliator`; every [file](#files) of the frigate and the
  capital; and the platform's files. Each data file sits beside its frames as
  `{a}-{name}.json`.
- Ids are the coral ids with `enemy-claim-` in place of `enemy-`, such as
  `enemy-claim-frigate-3` and `enemy-claim-capital-turret-top-9`. Each entry has
  the coral entry's fields, its own `path`, the coral `archetype` and `family`
  `claim`. No claim id matches `enemy-{archetype}-{index}`, so the coral heading
  sets stay complete.

### Claim palette

Contrast is WCAG against Cartwheel's field `#39221E`.

| Role                  | Coral                | Claim     | Contrast |
| --------------------- | -------------------- | --------- | -------: |
| Hull top              | `#d68b72`            | `#bd7042` |   3.91:1 |
| Hull side             | `#a8654f`            | `#924e28` |   2.35:1 |
| Hull rear             | `#7f4b3d`            | `#703921` |   1.62:1 |
| Plates                | `#e6a890`            | `#b5a998` |   6.40:1 |
| Guns, lights, disc    | `#f0bd68`            | `#fa6d38` |   5.14:1 |
| Gun side              | `#b98a40`            | `#bc4524` |   2.82:1 |
| Turret top            | `#c27a62`            | `#a95e30` |   3.05:1 |
| Visor, hatch          | `#2a2433`            | `#2b1d1c` |   1.10:1 |
| Visor side, breach    | `#1e1a26`            | `#1f1514` |   1.21:1 |
| Scorch top            | `#5c3a31`            | `#452f28` |   1.19:1 |
| Scorch side           | `#42291f`            | `#33211b` |   1.03:1 |
| Burn (deck paint)     | `#6e4436`            | `#613e30` |   1.58:1 |
| Claw ink, wreck ember | `#181425`, `#f0a07c` | unchanged |          |

The platform adds deep rust `#7d4427` (painted spokes, 1.92:1) and steel side
`#85786a` (3.44:1). Claim scorch is 3.29:1 on rust, so wrecks read on the hull;
the wreck ember is 5.93:1 on claim scorch. Steel turret heads are 3.96:1 on the
platform's rail track `#703921`.

### Turret platform

A fixed ore-field guard: a rust wheel deck 3 Ada widths across (128.6 model
units) with a steel-toothed rim, ember work lights on every other tooth, painted
spokes, Gadget's claw on a steel hopper hub and a dark rail track. Two
twin-barrel steel turrets ride the rail.

- Archetype `platform`, `sizeRatio` 3, hull frame 176 (display 77). Hardpoints
  `port` and `starboard`, role `turret`, offsets `[-0.29, 0]` and `[0.29, 0]`:
  37.3 model units from the centre, on the rail between radii 24 and 50.
- The hull never turns. One frame, `platform.svg` (`enemy-claim-platform`,
  `facing` `fixed`, no `directionIndex`), is the `hull` layer for every seeded
  facing `k`; `headings[k]` of `platform-hardpoints.json` places the turrets and
  orders the layers.
- Bases `platform-{port,starboard}-{intact,destroyed}-{k}.svg` have frame 64
  (display 28); the shared top `platform-turret-top-{i}.svg` has frame 96
  (display 42) and two muzzles per aim. No jets file: the platform has no
  engines.
- Intact: a steel pad 1 unit high on the deck, a rust collar to 2.5 and the
  aimed top, its head to 6 with the barrels just above. Destroyed: a scorched
  pad, a soot stump with a breach and one ember, and burn paint on the deck.
- `tools/enemy-hardpoints.json` has no `platform` entry yet, so the tool uses
  its proposed entry (the offsets above). A catalog `platform` entry takes
  precedence.
