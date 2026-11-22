# Space visual pass

Original rollout baseline: `f393139fa876944d8cdee14cd26e8039b1380545`.
Palette: approved `public/art/space-palette.json`, version 1, supplied by Art.
This spec uses its semantic keys; Tech owns runtime integration.

## Semantic rendering

These are the Art requirements for semantic roles and primitive shapes.
Authored assets take precedence where the game has them.

| Existing subject                                       | Palette keys                                                   | Shape and emphasis                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Space field                                            | `background` `#292734`                                         | Dark muted violet field.                                                                                                                    |
| Ordinary scenery: `rock`, stationary `debris`          | `environment` `#34333F`, `environmentDetail` `#403F4D`         | Muted solid silhouettes with restrained seams; visible blocking contours, no hazard cross or bright combat accents.                         |
| Resource-bearing `resource`                            | `environment`, `active` `#65C9BF`                              | Solid rock body with bright collectible/resource inset; retain distinction from ordinary scenery.                                           |
| Damaging `hazard`                                      | `obstacle` `#D68B72`                                           | Bright crossed circle with a clear outer damage boundary.                                                                                   |
| Ballistic `debris` with `velocity`                     | `environment`, `obstacle`                                      | Muted body, bright warning contour and directional marks. Retain a distinct warning cue for moving debris.                                  |
| Friendly `destination`, including space NPC encounters | `pointOfInterest` `#C4AFCC`                                    | Distinct authored silhouette or double-ellipse fallback, without an in-world name label. Preserve safe interaction space.                   |
| Cargo `pickup`                                         | `active`                                                       | Square container with central cargo dot.                                                                                                    |
| Upgrade `pickup`                                       | `weapon` `#F0BD68`                                             | Square container with the generic upgrade double chevron; see [the upgrade pickup](weapons.md#pickups).                                     |
| `enemy` hull and live combat parts                     | `environment`, `obstacle`, `shipHardpoint` `#70ACE8`, `weapon` | Bright hostile hull contour; blue live command/engine parts, amber live weapons. Retain archetype silhouettes, part shapes and health bars. |
| Disabled hardpoints                                    | `environment`, `environmentDetail`                             | Muted crossed-out parts; no live accent.                                                                                                    |
| Shots                                                  | `weapon` for friendly, `obstacle` for hostile                  | Preserve bolt versus missile shape; differentiate ownership beyond hue through an additional contour or glyph.                              |
| In-world discovery cue                                 | `pointOfInterest`                                              | Keep the in-world holodisk pulse.                                                                                                           |

Ordinary scenery has a muted visual treatment and can deal bump damage.
[Gameplay's collision and safe-arrival rules](../gameplay/rules.md#flight-and-combat)
cover scenery, the Needle gate-rim exception, attacks and marked hazards.
[Space encounters and feedback](../gameplay/rules.md#space-encounters-and-feedback)
covers ballistic debris motion and terrain. Keep Ada's compact white-and-blue
ship and existing character sprites. Preserve NPC encounter identity and approved dialogue. Keep friendly
encounters visually distinct from hostile hulls and hazard symbols.

## Bounded spatial variety

Use existing ordinary rock silhouettes for faceted asteroids, compact ribbed
space structures, stepped bulkhead-like masses and segmented wall-like obstacles.
Keep each variation within its existing collision footprint. Derive stable
variants from existing identity; no extra object kinds or simulation state are
needed. Distinguish constructed-looking seams from resource insets and weapon
mounts. Do not introduce story identities for decorative structures.

Use the existing open areas, asteroid clusters and paired-wall narrow passages.
Keep combat groups sparse with quiet stretches and no enemy-entry warning.
Preserve clear passable paths, quest access and safe NPC, destination and teleport
zones. Do not join separated collision circles with a solid visual wall, draw
open doorways across blocked space, or suggest a passable opening through a solid
object. Tighter layouts require Gameplay to specify clearance and geometry;
renderer decoration alone cannot establish corridor collision. Planet interiors
and Descent-style interior transitions are not approved or implemented contracts.

## Concrete Tech integration points

The original rollout proposed moving the fixed background, greyscale
primitives and white effects to the semantic palette. Current source loads
the palette from the core manifest and falls back to
`FALLBACK_SPACE_PALETTE` if parsing fails (`src/game/scene.ts`,
`src/game/sceneUi.ts`). Galaxy data can retint the background and environment.

`src/game/sceneObjects.ts` prefers authored art for destinations, resource
rocks, traveling debris and pickups where their assets are available. A
primitive destination uses two ellipses without a name label. The resource
circle fallback uses `pointOfInterest` via `spaceObjectColor`
(`src/game/spacePalette.ts`). The `active` resource accent in the table is the
design intent. Primitive debris with a velocity uses the hazard-coloured
contour. Flight shots select friendly or hostile colour from `Shot.enemy`.
Keep motion marks readable against the field and retain distinct feedback
pulse shapes, with damage styling reserved for damage.

`drawIndicators` in `src/game/sceneHud.ts` draws the in-world holodisk pulse.
Off-screen indicators share the DOM marker layer. Follow the
[Gameplay target marker contract](../gameplay/marker-design.md#contract) for
eligibility and knowledge and [Layout](layout.md#edge-markers) for placement.

## Geometry and readability constraints

Flight resolves scenery contact against drawn silhouettes where available,
with a primitive collision fallback. Keep visual boundaries on the actual
collision footprint. Gameplay owns spacing, placement, safe clearance and
contact consequences under [Flight and combat](../gameplay/rules.md#flight-and-combat).
[Persistence and regeneration](../gameplay/rules.md#persistence-and-regeneration)
governs terrain across flights.

At logical display size, check that muted contours remain visible against the
field, especially inside the compressed isometric projection. Keep seams,
stars and labels clear of live parts, projectiles and passage edges. Lavender POIs, teal resources, amber weapons and
salmon hazards need their distinct shapes retained for hue-independent reading.
Large hostile hulls must remain distinguishable from constructed-looking scenery.
Keep decorative silhouettes within the culling bounds in
`src/game/sceneObjects.ts` and leave visible gaps wherever movement is possible.
