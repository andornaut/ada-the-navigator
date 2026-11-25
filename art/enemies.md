# Sector one enemies

- The enemy fleet producer, `art/tools/fleet.ts`
  ([Enemy fleet redesign](enemy-redesign.md)), draws the swarm, fighter,
  interceptor and retaliators in every family.
  [art/tools/crafts.ts](tools/crafts.ts) holds the craft models, shared with the
  [destruction effect](destruction.md).
  [art/tools/projection.ts](tools/projection.ts) holds the rotation, culling,
  depth and projection shared with [ship geometry](ship.md).
- Enemy craft and their destruction shards use 16 headings (`ENEMY_HEADINGS`)
  in 22.5 degree world steps; enemy heading `k` faces ship heading `4k` of
  Ada's 64.
- The frigate and the capital follow the [heavies](heavies.md)
  contract.
- Exports per archetype: `{archetype}-{0..15}.svg` idle frames and
  `{archetype}-jets.json`. Manifest ids are `enemy-{archetype}-{index}` with
  `archetype`, `directionIndex` and `facing` `world-{index}`.

## Family style

The salvage fleets carry shared weapon signals and insignia:

- Coral `#d68b72` hull tops, darker coral sides `#a8654f` and rear edges `#7f4b3d`.
- Lighter salvage plates `#e6a890`; the retaliator turret top is `#c27a62`.
- Amber `#f0bd68` guns with `#b98a40` sides, matching the palette weapon signal.
- Dark visor `#2a2433` with `#1e1a26` sides.
- Combat hulls use forward pincers or tines. Industrial hulls carry role-specific paint
  across fleets, while their aimed tops and jets use the local fleet palette.
- Every drone carries Admiral Archie's [insignia](#insignia).

## Crafts

Canvas display sizes use `display = frame * 0.4375` exactly once. Canvas padding
is not physical size. `src/data/enemyDimensions.ts` owns the body ratios.
Normalization measures the intact assembled local X span before yaw/projection,
including physical hardpoints and their source-oriented tops. Ada's reference
span is derived from the ship model's wing corners. Jets, effects and padding
are excluded. Broken and capped parts inherit the intact assembly transform.

| Archetype     | Body span (Ada widths) | Geometry                                                 |
| ------------- | ---------------------: | -------------------------------------------------------- |
| `swarm`       |                   0.65 | Small beetle, forward mandibles                          |
| `fighter`     |                      1 | Horseshoe pincers, claw guns                             |
| `interceptor` |                      1 | Broad hostile diamond, cosmetic amber wingtip guns       |
| `retaliator`  |                      3 | Cargo hauler or mining freighter, aimed missile launcher |

Industrial asset stems are `retaliatorCargoHauler` and
`retaliatorMiningFreighter`, under each existing family prefix. Both retain
archetype `retaliator` and sixteen headings. Each stem has jets/collision,
shards and hardpoint metadata from the same normalized geometry. The
`retaliator` hull is the cargo hauler, so `retaliatorCargoHauler` entries and
sidecars name the `retaliator` frames, turret parts, jets and hardpoints; only
its shards are its own file. The existing
Rapid Missile launcher retains three cosmetic tips and one non-destructible aimed
mount. Variant selection belongs to the runtime consumer. The Cargo Hauler uses
a bilateral slate-blue gunmetal fuselage with a centered cockpit, a violet-gray
recessed storage saddle and a fitted stern drive. The Mining Freighter uses a
continuous teal hull with a split extraction bow, inset scoops, a paired cutter
and a connected stern.

## Insignia

One mark for the whole fleet: an ink `#181425` horseshoe claw opening toward
the nose, its prong tips hooked inward, closing on an amber `#f0bd68` disc.
Ink on the coral hull is 6.69:1. The same mark is the medal and cap badge on
Admiral Archie's portrait ([Conversation portraits](conversation.md)).

- Two flat `decal` parts per craft in `crafts.ts`: the claw outline (radius
  `r`) and a 12-sided disc of radius `0.26 r` centred `0.2 r` forward of the
  claw centre. Both sit at the hull's top height with no thickness, so only
  their tops draw.
- Decals draw right after the hull and any part beside it, before the parts
  resting on the hull top, so plates, visors and turrets occlude them.
- Placement on bare hull top, in model units (forward is negative Y):

| Archetype        | Centre     | `r` | Display across | Position                                |
| ---------------- | ---------- | --: | -------------: | --------------------------------------- |
| `swarm`          | (0, 6.5)   | 5.5 |         4.8 px | Behind the amber hatch                  |
| `fighter`        | (7.5, 3.5) | 5.2 |         4.6 px | Right shoulder, opposite the left plate |
| `interceptor`    | (0, 13)    | 4.6 |         4.0 px | Behind the visor                        |
| Cargo Hauler     | (0, -44)   | 3.2 |         4.2 px | Bow ahead of the cockpit                |
| Mining Freighter | (-15, 3)   | 4.5 |         5.4 px | Port shoulder of the extraction yoke    |

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
- Notch tips the [collision](#collision) outline cuts draw first, under the
  facets, in the colour of the topmost polygon within 0.6 frame px of the
  tip's apex.

## Speed jets

`{archetype}-jets.json` uses the version 1 schema and rules in
[ship geometry speed jets](ship.md#speed-jets), with these differences:

- Two layers, outer `#b8644c` to `#f0a07c` and core `#d68b72` to `#ffe2c8`;
  no halo.
- Length `(6 + 24 f²) * sqrt(frame / 96)` model units, so jets keep the same
  display proportion to each hull frame.
- `mouths` lists one entry per mouth (see the table), in frame px of that
  archetype's frame. Tips can extend past the frame; do not clip them to it.
- `headings[k].collision` follows the mouths: see [Collision](#collision).

## Collision

Each hull collides, makes contact and is placed by its drawn silhouette.
`{archetype}-jets.json` `headings[k].collision` is heading `k`'s silhouette:
an array of convex parts, each an array of `[x, y]` in frame px of that
archetype's frame, pivot at the frame centre. It has the schema of the ship's
`collision[k]` and the asteroids' `frames[k].collision`; offsets from the
pivot times 0.4375 give display px.

- Native solid-model fills drive each heading's convex collision parts.
  The shared checker requires strictly convex parts, its boundary-distance
  limit and intersection-over-union floor. Enemy tracing uses the same
  enclosed-aperture policy as that checker; thresholds are unchanged.
- Cargo and mining variants have separate sixteen-heading hull, collision,
  jet and aimed-top exports. Their gameplay archetype remains `retaliator`.
- Traced notch tips, when present, are drawn into the corresponding SVG.
  Collision excludes jets, effects and padding.
