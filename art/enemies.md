# Sector one enemies

- Rebuild with `node art/tools/enemies.ts`. It writes `public/art/enemies/` and
  replaces the `enemy-*` entries at the end of the root manifest.
  [art/tools/crafts.ts](tools/crafts.ts) holds the craft models, shared with the
  [destruction effect](destruction.md).
  [art/tools/projection.ts](tools/projection.ts) holds the rotation, culling,
  depth and projection shared with [ship geometry](ship.md).
- Exports per archetype: `{archetype}-{0..15}.svg` idle frames and
  `{archetype}-jets.json`. Manifest ids are `enemy-{archetype}-{index}` with
  `archetype`, `directionIndex` and `facing` `world-{index}`.

## Family style

One salvage-craft family reads as hostile against Ada's white and blue ship:

- Coral `#d68b72` hull tops, darker coral sides `#a8654f` and rear edges `#7f4b3d`.
- Lighter salvage plates `#e6a890`; the retaliator turret top is `#c27a62`.
- Amber `#f0bd68` guns with `#b98a40` sides, matching the palette weapon signal.
- Dark visor `#2a2433` with `#1e1a26` sides.
- Forward pincers or tines on every hull are the family trait.
- Every drone carries General Gadget's [insignia](#insignia).

## Crafts

Frame and display sizes share one scale, `display = frame * 0.4375`, the same as
Ada's 96px frame at 42px. Extents are model units over Ada's 42.88-unit wingspan.

| Archetype     | Frame | Display | Span (Ada widths) | Length (Ada widths) | Mouths | Shape                                   |
| ------------- | ----: | ------: | ----------------: | ------------------: | -----: | --------------------------------------- |
| `swarm`       |    80 |      35 |              0.65 |                0.84 |      1 | Small beetle, forward mandibles         |
| `fighter`     |    96 |      42 |              0.98 |                1.26 |      2 | Horseshoe pincers, gun at each claw     |
| `interceptor` |    88 |    38.5 |              0.47 |                1.07 |      1 | Long needle, twin tines, centre gun     |
| `retaliator`  |   192 |      84 |              2.01 |                1.59 |      3 | Broad slab, plates, three-barrel turret |

Hit circles use Gameplay's `sizeRatio` in Ada widths: swarm 0.65, fighter 1,
interceptor 0.75 and retaliator 2. The interceptor's ratio sits near the mean of
its drawn length and width, so the narrow hull keeps a forgiving hit area.

## Insignia

One mark for the whole fleet: an ink `#181425` horseshoe claw opening toward
the nose, its prong tips hooked inward, closing on an amber `#f0bd68` disc.
Ink on the coral hull is 6.69:1. The same mark is General Gadget's voice
portrait ([Conversation portraits](conversation.md)).

- Two flat `decal` parts per craft in `crafts.ts`: the claw outline (radius
  `r`) and a 12-sided disc of radius `0.26 r` centred `0.2 r` forward of the
  claw centre. Both sit at the hull's top height with no thickness, so only
  their tops draw.
- Decals draw right after the hull and any part beside it, before the parts
  resting on the hull top, so plates, visors and turrets occlude them.
- Placement on bare hull top, in model units (forward is negative Y):

| Archetype     | Centre     | `r` | Display across | Position                                |
| ------------- | ---------- | --: | -------------: | --------------------------------------- |
| `swarm`       | (0, 6.5)   | 5.5 |         4.8 px | Behind the amber hatch                  |
| `fighter`     | (7.5, 3.5) | 5.2 |         4.6 px | Right shoulder, opposite the left plate |
| `interceptor` | (0, 10)    | 4.6 |         4.0 px | Behind the visor                        |
| `retaliator`  | (0, 20.5)  |   7 |         6.1 px | Behind the turret                       |

## Frames

- Transparent square viewport with the pivot at its centre; render the selected
  frame with rotation zero.
- Heading index, projection and local forward (negative Y) follow
  [ship geometry](ship.md): index `k` faces world angle `k * 22.5` degrees.
- Each part is an extruded plan. Parts resting on the hull top (base at or above
  the hull's top) draw after the hull; otherwise parts draw far to near by mean
  depth. Within a part, visible sides precede the top. Outward-normal culling
  toward the `(1, 1, 1)` view direction removes hidden faces.
- No jets, raster assets, filters, strokes or screen rotation in the frames.

## Speed jets

`{archetype}-jets.json` uses the version 1 schema and rules in
[ship geometry speed jets](ship.md#speed-jets), with these differences:

- Two layers, outer `#b8644c` to `#f0a07c` and core `#d68b72` to `#ffe2c8`;
  no halo.
- Length `(6 + 24 f²) * sqrt(frame / 96)` model units, so jets keep the same
  display proportion to each hull frame.
- `mouths` lists one entry per mouth (see the table), in frame px of that
  archetype's frame. Tips can extend past the frame; do not clip them to it.
