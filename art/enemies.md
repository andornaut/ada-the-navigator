# Sector one enemies

- Rebuild with `node art/tools/enemies.ts`. It writes `public/art/enemies/` and
  replaces the `enemy-*` entries at the end of the root manifest.
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

## Frames

- Transparent square viewport with the pivot at its centre; render the selected
  frame with rotation zero.
- Heading index, projection and local forward (negative Y) follow
  [ship geometry](ship.md): index `k` faces world angle `k * 22.5` degrees.
- Each part is an extruded plan. Parts draw far to near by mean depth; within a
  part, visible sides precede the top. Outward-normal culling removes hidden faces.
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
