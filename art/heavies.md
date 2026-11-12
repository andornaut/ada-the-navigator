# Heavies

The frigate, the capital and Gadget's own capital are a hull plus destructible
hardpoints, and every turret aims at Ada independently of the hull. Each class
is drawn once with every weapon mount it can carry; a mount its position tier
leaves unused shows a capped plate. Tech composes each frame from layers;
Gameplay owns the rules for damage, speed, disabling and defeat. Contact uses
each sprite's drawn silhouette ([Collision](#collision)).

- Rebuild with `node art/tools/heavies.ts`. It checks
  `tools/enemy-hardpoints.json` against Art's layout, writes
  `public/art/enemies/` and replaces its own manifest entries in the core
  manifest in place, after the sector one enemies.
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

| Archetype | Frame | Display | `sizeRatio` | Span x length | Weapon mounts | Files |
| --------- | ----: | ------: | ----------: | ------------- | ------------: | ----: |
| `frigate` |   384 |     168 |           4 | 3.27 x 4.26   |             4 |   258 |
| `capital` |   480 |     210 |           5 | 5.04 x 5.50   |             8 |   530 |
| `gadget`  |   560 |     245 |           5 | 5.78 x 5.74   |             8 |   530 |

- Frigate: long hunter with twin prow tines, a raised `engine` block that caps
  the stern with two jet mouths, and four weapon mounts: one on each sponson
  (`port`, `starboard`) and two on the centreline, `spine` on the dorsal spine
  plate and `bow` between the tine roots. The insignia sits on bare deck
  between the spine plate and the engine block.
- Capital: broad flagship with a great claw prow, a `command` tower at the
  centre, a nacelle on each side of the stern (`engine-left`, `engine-right`)
  and eight weapon mounts in four pairs: `weapon-left` and `weapon-right` on the
  shoulders, `weapon-rear-left` and `weapon-rear-right` on the wings,
  `claw-left` and `claw-right` on the claw arms, `stern-left` and
  `stern-right` on the stern deck. Its four escorts are the existing `fighter`
  frames.
- Gadget: General Gadget's own capital, Black Eye's heavy ([Gadget](#gadget)).

## Layout and the catalog

Art's layout in `art/tools/heavies.ts` lists every hardpoint and weapon mount
with its `offset`, and the hardpoints file publishes it. The catalog export
`tools/enemy-hardpoints.json`, which Tech generates from Gameplay's catalog, may
list a subset: every hardpoint it lists must match Art's id, role and offset
exactly, and its `sizeRatio` must match, or the tool stops without writing.
Mounts the export does not list yet are kept, so the catalog adopts them by
copying Art's offsets.

- Export format: `version` 1; `archetypes[a]` has `sizeRatio` and
  `hardpoints`, each with `id`, `role` (`command`, `engine` or `turret`),
  `offset` and `order`. Other fields are ignored.
- `offset` is `[x, y]` in fractions of the hull width (`sizeRatio` Ada widths)
  in the hull's local frame: `-y` forward, `+x` starboard. Model units are
  `offset * sizeRatio * 42.88`. Output lists hardpoints in Art's order: the
  catalog's, then the new mounts in fill order.
- Art owns the positions, the heights, the drawing around each origin, the jet
  mouths around an engine's origin and the barrel muzzles around a turret's
  pivot. Every mount sits on bare deck or a deck plate.

## Mounts

Weapons fill mounts pairs first, so the loadout stays symmetric; an odd count
adds a centreline mount. The fill order and each position tier's weapons are
in the hardpoints file (`fill`, `tiers`), from Gameplay's
[enemy weapons](../gameplay/ships.md#enemy-weapons).

| Frigate mount        | Offset       | Positions 1 to 2 | 3 to 4        | 5 to 6        |
| -------------------- | ------------ | ---------------- | ------------- | ------------- |
| `port`, `starboard`  | `[∓0.3, 0]`  | Laser            | Laser         | Laser         |
| `spine` (centreline) | `[0, 0.025]` | capped           | Rapid Missile | Rapid Missile |
| `bow` (centreline)   | `[0, -0.22]` | capped           | capped        | Charged lance |

| Capital and Gadget mounts         | Capital offset   | Gadget offset    | Positions 1 to 2 | 3 to 4                       | 5 to 6                 |
| --------------------------------- | ---------------- | ---------------- | ---------------- | ---------------------------- | ---------------------- |
| `weapon-left`, `weapon-right`     | `[∓0.35, -0.3]`  | `[∓0.36, -0.3]`  | Laser            | Laser                        | Laser                  |
| `weapon-rear-left`, `-rear-right` | `[∓0.42, 0.08]`  | `[∓0.44, 0.1]`   | Multi-Laser      | Multi-Laser                  | Rapid Missile          |
| `claw-left`, `claw-right`         | `[∓0.15, -0.45]` | `[∓0.16, -0.48]` | capped           | Rapid Missile, Heavy Missile | Phaser, Heavy Missile  |
| `stern-left`, `stern-right`       | `[∓0.1, 0.31]`   | `[∓0.11, 0.33]`  | capped           | capped                       | Ring burst, Mine layer |

A pair cell with two weapons lists the left mount's first. Heavy Missile stays
on `claw-right` from positions 3 to 6; the mine layer sits at the stern because
its mines drop behind the ship.

### Weapon tops

Each weapon kind has one top design per class (`{a}-{t}-top-{i}`). Laser and
Multi-Laser keep the barrel tops; the other kinds have their own, so the threat
reads before it fires.

| Weapon (`weapon`) | Top (`t`)                            | Look                                             | Aim      |
| ----------------- | ------------------------------------ | ------------------------------------------------ | -------- |
| `laser`           | `gun` (frigate), `turret` (capitals) | One or two amber barrels on the turret head      | `target` |
| `multiLaser`      | `turret`                             | Two amber barrels                                | `target` |
| `rapidMissile`    | `pod`                                | A squared pod with four amber missile caps       | `target` |
| `heavyMissile`    | `rail`                               | One plate missile on a rail, amber warhead, band | `target` |
| `phaser`          | `dish`                               | Round dish, dark lens, one long thin emitter     | `target` |
| `chargedLance`    | `lance`                              | Twin plate rails, amber charge crystal between   | `target` |
| `ringBurst`       | `dome`                               | Twelve-sided dome with eight amber rim studs     | `target` |
| `mineLayer`       | `hopper`                             | Hopper with two amber mines and a dark aft chute | `aft`    |

`aim` `target` turns with the turret's world aim; `aft` holds aim index
`(k + 8) mod 16` for hull heading `k`. Every top's pivot sits on the collar,
1.5 units above the deck, so a mount's `pivot` serves whichever top it carries.

### Capped plate

An unused mount draws `{a}-{h}-capped-{k}`: a low plate disc (`plate` top,
`coralSide` sides, 0.8 units high) with a `coralRear` seam ring and four bolts,
no hardpoint and no top. It neither fires nor counts as a hardpoint.

## Files

All in `public/art/enemies/`. `{a}` is the archetype, `{h}` a hardpoint id
exactly as in the catalog, `{t}` a turret top design, `{k}` a hull heading and
`{i}` an aim index, each `0..15`.

| File                      | One per                   | Content                                          |
| ------------------------- | ------------------------- | ------------------------------------------------ |
| `{a}-{k}.svg`             | heading                   | Hull with no hardpoints                          |
| `{a}-{h}-{state}-{k}.svg` | hardpoint, state, heading | The hardpoint base, centred on its anchor        |
| `{a}-{h}-capped-{k}.svg`  | cappable mount, heading   | The capped plate, centred on its anchor          |
| `{a}-{t}-top-{i}.svg`     | top design, aim           | The turret top, centred on its pivot             |
| `{a}-hardpoints.json`     | archetype                 | Anchors, pivots, order, tiers, banner, collision |
| `{a}-jets.json`           | archetype                 | Speed jets, each mouth tagged by its engine      |

Mounts with identical drawings share one top set per design.

Sprite frames are square, a multiple of 8 px, and hold every heading and state
of that hardpoint around a centred pivot. Every heavies SVG keeps its `viewBox`
in frame px and declares its display size (frame times 0.4375) as `width` and
`height`, so it rasterizes at the size it is drawn. Anchors, pivots, muzzles
and jets stay in frame px. The sector one enemy SVGs declare their frame size.

| Sprite                            |         Frame |       Display |
| --------------------------------- | ------------: | ------------: |
| Frigate, capital and Gadget hulls | 384, 480, 560 | 168, 210, 245 |
| Weapon mount base (every state)   |            48 |            21 |
| Frigate engine                    |            80 |            35 |
| Capital command; Gadget command   |        72; 80 |      31.5; 35 |
| Capital engine; Gadget engine     |        88; 96 |      38.5; 42 |
| Top `pod`                         |            40 |          17.5 |
| Tops `dome`, `hopper`             |            48 |            21 |
| Tops `turret`, `rail`             |            80 |            35 |
| Top `gun`                         |            88 |          38.5 |
| Top `dish`                        |            96 |            42 |
| Top `lance`                       |           104 |          45.5 |

## Manifest entries

- `width` and `height` are the frame px of the `viewBox`, the space every
  frame-px value refers to; `displayWidth` and `displayHeight` are the drawn
  size, which is also the SVG's declared size.
- Hull: `enemy-{a}-{k}`, the same fields as every enemy heading frame.
- Hardpoint base: `enemy-{a}-{h}-{state}-{k}` with `path`, `width`, `height`,
  `displayWidth`, `displayHeight` (frame times 0.4375), `facing` `world-{k}`,
  `directionIndex` `k`, `hardpoint`, `state`, `pivot` `{ 0.5, 0.5 }` and
  `archetype`. A capped plate is the same with `state` `capped`.
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
- `hardpoints[]`, in Art's order: `id`, `role`, `states`
  (`["intact", "destroyed"]`) and `top`: the one top design the hardpoint
  carries at every position tier, or `null` when it has none or its tier
  decides. A mount heavy (frigate, capital, Gadget) adds `capped`, whether the
  mount has capped plate sprites.
- `fill` (mount heavies): the weapon mount ids in fill order.
- `tiers[]` (mount heavies): `positions` (`[1, 2]`, `[3, 4]`, `[5, 6]`) and
  `mounts`, every mount id in fill order mapped to `{ "weapon", "top", "aim" }`
  or `null` for a capped plate. Pick the tier whose `positions` holds the
  galaxy's route position.
- `headings[k]`: `index`; `order`, the layer ids for hull heading `k` far to
  near, with `hull` among them; `hardpoints[]` with `id`, `anchor` (the
  projected hardpoint origin at its anchor height, where that hardpoint's base
  sprite centre goes) and, for every hardpoint that can carry a top, `pivot`
  (the projected top pivot, where the top sprite centre goes); `banner`, the
  [Disabled banner](#disabled-banner)'s centre.
- `tops[t][i]`: `index` (aim `i`) and `muzzles`, one `[x, y]` per barrel tip in
  frame px relative to the pivot.

The platform has no `fill` or `tiers`: its two turrets carry their `top` at
every position.

Sample (capital, positions 3 to 4, abridged):

```json
{
  "fill": [
    "weapon-left",
    "weapon-right",
    "weapon-rear-left",
    "weapon-rear-right",
    "claw-left",
    "claw-right",
    "stern-left",
    "stern-right"
  ],
  "tiers": [
    {
      "positions": [3, 4],
      "mounts": {
        "weapon-left": { "weapon": "laser", "top": "turret", "aim": "target" },
        "claw-right": { "weapon": "heavyMissile", "top": "rail", "aim": "target" },
        "stern-left": null
      }
    }
  ]
}
```

## Composing a frame

1. Pick hull heading `k` from the hull facing with the existing enemy rule.
2. For each id in `headings[k].order`: `hull` draws `{a}-{k}`; a hardpoint
   draws its base for its current state with the sprite centre at `anchor`. A
   mount its tier leaves `null` draws `{a}-{h}-capped-{k}` there instead.
   An intact turret then draws its top `{a}-{t}-top-{i}` at `pivot`, `t` being
   its tier's `top` (or the hardpoint's `top` without tiers).
3. Pick each top's aim index `i` from that turret's world aim angle with the
   same rule as hull headings: index `i` faces world angle `i * 22.5` degrees,
   whatever the hull heading. Tech turns each aim with the ship's
   `aimTurnSeconds`. An `aft` top holds `(k + 8) mod 16`. `pivot` plus a
   muzzle is that barrel tip in hull frame px.
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
- Disabled: every weapon mount the tier fills is destroyed. The heavy draws its
  stumps and the [Disabled banner](#disabled-banner).
- Salvaged: the banner goes and the heavy draws [dimmed](#salvaged-dimming).

### Disabled banner

Procedural, drawn by Tech over the disabled heavy: no sprite.

- Face: `threat` `#FF6B6B` ([space palette](space-palette.md)), 24 logical px
  high, radius 4, a 1 px ink `#181425` border, 8 px insets either side of the
  label.
- Label: Gameplay's "Disabled" string in `TYPE.label` (16 bold on 20,
  [layout](layout.md)) in ink, centred in the face. Ink on threat is 6.86:1;
  the border carries the edge on a light field, where bare threat is 1.75:1.
- Position: the face centred on `headings[k].banner`, the pivot x and the
  centre y of the hull layer's drawn bounds (from `headings[k].collision`) in
  hull frame px, so it overlays the ship. It follows the drawn heading, sits
  above every layer of the heavy and is not dimmed or keylined.

### Salvaged dimming

A salvaged heavy draws as one composed group, so overlapping layers never show
through each other: each pixel's colour `c` becomes `c + 0.85 (L - c)` with
`L = 0.299 r + 0.587 g + 0.114 b`, then the group's alpha is 0.6. On a light
field the [keyline](galaxies.md#light-fields) belongs to the group, so it dims
with it. Speed jets stay off.

## Collision

The hull and every hardpoint sprite collide, make contact and are placed by
their drawn silhouettes, in `{a}-hardpoints.json`. Each value is an array of
convex parts, each an array of `[x, y]` in frame px, the schema of the ship's
`collision[k]`. Positions follow the file's rule: hull frame px, except tops,
which are relative to the pivot like muzzles.

- `headings[k].collision`: the hull layer drawn for heading `k`. The platform's
  hull never turns, so every heading holds `platform.svg`'s.
- `headings[k].hardpoints[j].collision`: `{ "intact": parts, "destroyed": parts }`,
  one per state in `states`, plus `capped` for a cappable mount, for that
  hardpoint's base at heading `k`, placed at its `anchor` in hull frame px.
- `tops[t][i].collision`: top `t` at aim `i`, relative to the pivot.

`art/tools/heavies.ts` traces every sprite's fills with the
[shared tracer](ship.md#shared-tracer); the frames have no strokes, so nothing
grows. Each sprite takes the first Douglas-Peucker tolerance of 0.4 and 0.3
frame px that passes the 0.98 floor. Only the destroyed weapon mount stump at
heading 7 needs 0.3 (20 sprites, every frigate, capital and Gadget weapon
mount); at 0.4 its ragged scorch paint, quantized by the cell grid, reaches
0.9797. The frigate hull cuts 8 notch tips between its prow tines; its frames
draw them under the faces.

Checked against the fills plus the tips: every part strictly convex and every
boundary within 0.36 frame px of the drawing. librsvg renders at 4 px per frame
px agree within 0.002.

| Sprite                                 | Parts    | Intersection over union |
| -------------------------------------- | -------- | ----------------------- |
| Frigate hull                           | 12 to 15 | 0.996 to 0.997          |
| Capital hull                           | 15 to 21 | 0.998                   |
| Gadget hull                            | 17 to 24 | 0.998 to 0.999          |
| Platform hull                          | 26       | 0.997                   |
| Engines and command, intact            | 1 to 18  | 0.992 to 0.999          |
| Engines and command, destroyed         | 1 to 10  | 0.991 to 0.998          |
| Weapon mount bases, intact             | 1        | 0.980 to 0.992          |
| Weapon mount bases, destroyed          | 4 to 7   | 0.982 to 0.989          |
| Capped plates                          | 1        | 0.980 to 0.987          |
| Platform turret bases                  | 1 to 12  | 0.988 to 0.995          |
| Tops `gun`, `turret`, `pod`, `rail`    | 1 to 8   | 0.983 to 0.998          |
| Tops `dish`, `lance`, `dome`, `hopper` | 2 to 22  | 0.980 to 0.999          |
| Platform turret top                    | 3 to 9   | 0.988 to 0.997          |

## Speed jets

`{a}-jets.json` uses the [family jets schema](enemies.md#speed-jets) for its
frame. Each mouth also has `hardpoint`, the id of the engine that drives it.
Draw a mouth only while that engine is intact.

| Archetype | Mouths | Engine                                   | Width | Height |
| --------- | -----: | ---------------------------------------- | ----: | -----: |
| `frigate` |      2 | `engine` (both)                          |    10 |     11 |
| `capital` |      2 | `engine-left`, `engine-right` (one each) |    12 |      6 |
| `gadget`  |      2 | `engine-left`, `engine-right` (one each) |    12 |      6 |

## Gadget

General Gadget's own capital, Black Eye's heavy: the capital class's mounts,
tiers and tops on a more threatening hull, in the coral family palette.

- Archetype `gadget`: files `gadget-*` in `public/art/enemies/`, manifest ids
  `enemy-gadget-{k}`, `enemy-gadget-{h}-{state}-{k}` and
  `enemy-gadget-{t}-top-{i}` in the core manifest, `gadget-hardpoints.json`
  and `gadget-jets.json`. Frame 560 at the capital's scale; `sizeRatio` 5
  scales its offsets.
- Hull: a serrated claw hull whose prongs reach 142 units forward, saw-toothed
  wing edges, two wing patch plates, a raised `coralRear` dorsal ridge from the
  tower to the stern, and the insignia on bare deck ahead of the tower.
- `command`: an octagonal tower 16 units above the deck with a dark visor and
  two stepped ear fins on its rear shoulders, each three shrinking prisms 18
  units high with a plate-coloured middle step. No face. Destroyed: a scorched
  tower stump with the ears' stumps, a broken visor, a breach and one ember.
- `engine-left`, `engine-right`: the capital's nacelles 1.1 times larger at
  `[∓0.27, 0.44]`.

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
platform. Sunflower keeps the coral originals. Andromeda's
[garnet drones](andromeda.md#garnet-drones) are the same recolour in garnet.

- Rebuild with `node art/tools/claim-jumpers.ts`, which takes the same
  `--offsets <file.json>` as `heavies.ts`. It draws the shared models in
  process, writes `public/art/cartwheel/enemies/` and replaces its own entries
  in place in [Cartwheel's manifest](../public/art/cartwheel/manifest.json),
  after the hub and buoy and before the story craft.
- Models, parts, frames, headings, hardpoints, anchors and muzzles match the
  coral family; only fills change. Every SVG and shards file goes through the
  colour swap below, every jets file through the claim jet colours, and the
  tool stops on any colour outside the family.
- Jets files keep the coral shape, lengths, layers, mouth data and
  [collision](enemies.md#collision); hardpoints files, mounts, tiers and
  collision included, are the coral family's, unchanged. Claim frames draw the
  coral notch tips, capped plates and tops. Gadget has no claim version.
  Andromeda's [garnet](andromeda.md#garnet-drones) and Needle's
  [crimson](needle.md#needle-drones) families recolour the frigate and capital
  the same way, mounts and tiers included. Destruction uses the shared
  `destruction.json` timing and flash with the claim shards.

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

Speed jets ramp slow to fast, in place of Gadget's jet colours:

| Layer | Gadget                 | Claim                  | Contrast, slow and fast |
| ----- | ---------------------- | ---------------------- | ----------------------: |
| Outer | `#b8644c` to `#f0a07c` | `#bc4524` to `#fa6d38` |          2.82:1, 5.14:1 |
| Core  | `#d68b72` to `#ffe2c8` | `#fa6d38` to `#ffebda` |         5.14:1, 12.77:1 |

The outer tail is the ember side; the hot core end is a warm near-white (OKLab
L 0.95, C 0.03).

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
- The hardpoints and offsets come from the catalog's `platform` entry in
  `tools/enemy-hardpoints.json`, like every other craft's.
