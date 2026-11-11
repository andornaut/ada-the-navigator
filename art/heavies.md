# Galaxy one heavies

The frigate and the capital are a hull plus destructible hardpoints, and every
gun and turret aims at Ada independently of the hull. The retaliator's
three-barrel gun follows the same turret contract. Tech composes each frame from
layers; Gameplay owns hardpoint ids, positions, hit radii and the rules for
damage, speed and defeat.

- Rebuild with `node art/tools/heavies.ts`. It reads Gameplay's catalog
  (`src/data/enemy-catalog.ts`), writes `public/art/enemies/` and replaces its
  own entries at the end of the root manifest. `--offsets <file.json>` reads
  the offsets from a file instead; `--out <dir>` writes the files and a
  `manifest-entries.json` to that directory and leaves the manifest alone.
- [art/tools/heavies-placeholder.json](tools/heavies-placeholder.json) holds
  the approved mock-up's offsets. It is marked `placeholder`, so the tool
  writes it only with `--out`.
- Not yet exported: the files below are the contract for the first export.
- Models, projection and part order are shared with the
  [sector one enemies](enemies.md) through `art/tools/crafts.ts` and
  `art/tools/projection.ts`.

## Crafts

`display = frame * 0.4375`, as for every enemy. Spans and lengths are the drawn
hull in Ada widths of 42.88 model units.

| Archetype    | Frame | Display | `sizeRatio` | Span x length | Hardpoints                                                                                                             |
| ------------ | ----: | ------: | ----------: | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `frigate`    |   384 |     168 |           4 | 3.27 x 4.90   | `gunLeft`, `gunRight` (aimed), `engine`                                                                                |
| `capital`    |   480 |     210 |           5 | 4.99 x 5.27   | `command`, `engineLeft`, `engineRight`, `turretForeLeft`, `turretForeRight`, `turretAftLeft`, `turretAftRight` (aimed) |
| `retaliator` |   192 |      84 |           2 | 2.01 x 1.59   | `turret` (aimed, not destructible)                                                                                     |

- Frigate: long hunter with twin prow tines, a broadside gun on each sponson and
  a raised stern engine block with two jet mouths, which is one hardpoint.
- Capital: broad flagship with a great claw prow, a command tower, a nacelle on
  each side of the stern and four twin-barrel deck turrets. Its four escorts are
  the existing `fighter` frames.

## Offsets input

Positions have one source. The tool places each hardpoint's drawing at the
catalog offset and projects it per heading; no art file authors a hardpoint
position or a hit radius.

- Per archetype: `sizeRatio` and `hardpoints`, each `{ id, kind, offset }`.
  `kind` is `command`, `engine` or `weapon`. `offset` is `{ x, y }` in fractions
  of the hull width (`sizeRatio` Ada widths) in the hull's local frame: `-y`
  forward, `+x` starboard. Model units are `offset * sizeRatio * 42.88`.
- A file input has this shape; the catalog object reads into the same shape,
  and archetypes the tool does not draw are ignored.

```json
{
  "version": 1,
  "placeholder": false,
  "crafts": {
    "frigate": {
      "sizeRatio": 4,
      "hardpoints": [{ "id": "engine", "kind": "engine", "offset": { "x": 0, "y": 0.4606 } }]
    }
  }
}
```

- For each drawn archetype, the hardpoint id set and every `kind` must match the
  art exactly, or the tool stops without writing.
- Art owns the heights (`z`), the drawing around each origin, the jet mouths
  around an engine's origin and the barrel muzzles around a turret's pivot.

## Files

All in `public/art/enemies/`. `{a}` is the archetype, `{h}` a hardpoint id
exactly as in the catalog, `{k}` a hull heading and `{i}` an aim index, each
`0..15`.

| File                      | One per                   | Content                                                     |
| ------------------------- | ------------------------- | ----------------------------------------------------------- |
| `{a}-{k}.svg`             | heading                   | Hull with no hardpoints, frame and pivot as the table above |
| `{a}-{h}-{state}-{k}.svg` | hardpoint, state, heading | The hardpoint base, centred on its anchor                   |
| `{a}-{h}-top-{i}.svg`     | aimed hardpoint, aim      | The turret top, centred on its pivot                        |
| `{a}-hardpoints.json`     | archetype                 | Anchors, pivots, layer order and muzzles                    |
| `{a}-jets.json`           | frigate, capital          | Speed jets, each mouth tagged by its engine                 |

The retaliator's hull frames and jets stay with `art/tools/enemies.ts`; this
tool adds its turret files and `retaliator-hardpoints.json`.

Sprite frames are square, a multiple of 8 px, and hold every heading and state
of that hardpoint around a centred pivot. From the mock-up geometry:

| Sprite                     | Base frame | Top frame |
| -------------------------- | ---------: | --------: |
| Frigate gun                |         48 |        88 |
| Frigate engine             |         80 |           |
| Capital command            |         72 |           |
| Capital engine (each side) |         88 |           |
| Capital turret             |         48 |        80 |
| Retaliator turret          |         24 |       104 |

## Manifest entries

- Hull: `enemy-{a}-{k}`, the same fields as every enemy heading frame.
- Hardpoint base: `enemy-{a}-{h}-{state}-{k}` with `path`, `width`, `height`,
  `displayWidth`, `displayHeight` (frame times 0.4375), `facing` `world-{k}`,
  `directionIndex` `k`, `hardpoint`, `state`, `pivot` `{ 0.5, 0.5 }` and
  `archetype`.
- Turret top: `enemy-{a}-{h}-top-{i}` with the same fields except `aimIndex`
  `i` and `facing` `world-{i}` in place of `directionIndex`, and no `state`.
- Hardpoint and top ids never match the hull pattern `enemy-{archetype}-{index}`,
  so hull heading sets stay complete and separate.

## Hardpoints file

`{a}-hardpoints.json`, version 1. Positions are frame px in the hull frame
(pivot at its centre), except muzzles; scale every value by the display size
like the hull frame.

- `archetype`, `frame`: the hull archetype and frame size.
- `hardpoints[]`: `id`, `kind`, `states` (`["intact", "destroyed"]`, or
  `["intact"]` for the retaliator turret) and `aimed` (has a top).
- `headings[k]`: `index`; `order`, the layer ids for hull heading `k` far to
  near, with `hull` among them; `hardpoints[]` with `id`, `anchor` (the
  projected hardpoint origin at its anchor height, where that hardpoint's base
  sprite centre goes) and, for aimed hardpoints, `pivot` (the projected top
  pivot, where the top sprite centre goes).
- `tops[h][i]`: `index` (aim `i`) and `muzzles`, one `[x, y]` per barrel tip in
  frame px relative to the pivot.

## Composing a frame

1. Pick hull heading `k` from the hull facing with the existing enemy rule.
2. For each id in `headings[k].order`: `hull` draws `{a}-{k}`; a hardpoint
   draws its base for its current state with the sprite centre at `anchor`.
   An intact aimed hardpoint then draws its top at `pivot`.
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
  hull also leave ragged scorch paint on the deck.
- Intact turrets stand on a fixed collar 1.5 units high (`{h}-intact`); the
  aimed top carries the head, barrels and hatch.
- Hit flash is a tint over the hardpoint's base and top. There are no flash
  frames.

## Speed jets

`{a}-jets.json` uses the [family jets schema](enemies.md#speed-jets) for its
frame. Each mouth also has `hardpoint`, the id of the engine that drives it.
Draw a mouth only while that engine is intact.

| Archetype | Mouths | Engine                                 | Width | Height |
| --------- | -----: | -------------------------------------- | ----: | -----: |
| `frigate` |      2 | `engine` (both)                        |    10 |     11 |
| `capital` |      2 | `engineLeft`, `engineRight` (one each) |    12 |      6 |

Mouth width and height are model units. The retaliator's jets file is unchanged
and its mouths have no `hardpoint`.

## Retaliator turret

The turret head and the three barrels leave the hull frames
`retaliator-{k}.svg`, which keep their ids, size and pivot. They become
`retaliator-turret-top-{i}`, over the fixed collar `retaliator-turret-intact-{k}`.
The barrels keep the -0.2, 0 and 0.2 radian spread about the turret's aim, so
`tops.turret[i].muzzles` lists three tips. The turret is hardpoint `turret`,
`kind` `weapon`, at the catalog offset; the placeholder puts it at the hull
centre, `(0, 0)`.

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
