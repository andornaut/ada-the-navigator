# Space visual pass

Source baseline: `f393139fa876944d8cdee14cd26e8039b1380545`.
Palette: approved `public/art/space-palette.json`, version 1, supplied by Art.
This spec uses its semantic keys; Tech owns runtime integration.

## Semantic rendering

| Existing subject                                       | Palette keys                                                   | Shape and emphasis                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Space field                                            | `background` `#292734`                                         | Dark muted violet field.                                                                                                                    |
| Harmless scenery: `rock`, stationary `debris`          | `environment` `#34333F`, `environmentDetail` `#403F4D`         | Muted solid silhouettes with restrained seams; visible blocking contours, no hazard cross or bright combat accents.                         |
| Resource-bearing `resource`                            | `environment`, `active` `#65C9BF`                              | Solid rock body with bright collectible/resource inset; retain distinction from ordinary scenery.                                           |
| Damaging `hazard`                                      | `obstacle` `#D68B72`                                           | Bright crossed circle with a clear outer damage boundary.                                                                                   |
| Ballistic `debris` with `velocity`                     | `environment`, `obstacle`                                      | Muted body, bright warning contour and directional marks. These objects damage on contact; never render them as harmless scenery.           |
| Friendly `destination`, including space NPC encounters | `pointOfInterest` `#C4AFCC`                                    | Distinct double ellipse and label. Preserve safe interaction space; do not use hostile hull or hazard symbols.                              |
| Cargo `pickup`                                         | `active`                                                       | Square container with central cargo dot.                                                                                                    |
| Weapon `pickup`                                        | `weapon` `#F0BD68`                                             | Square container with the weapon's HUD glyph at 14 px; see [weapon pickups](weapons.md#pickups).                                            |
| `enemy` hull and live combat parts                     | `environment`, `obstacle`, `shipHardpoint` `#70ACE8`, `weapon` | Bright hostile hull contour; blue live command/engine parts, amber live weapons. Retain archetype silhouettes, part shapes and health bars. |
| Disabled hardpoints                                    | `environment`, `environmentDetail`                             | Muted crossed-out parts; no live accent.                                                                                                    |
| Shots                                                  | `weapon` for friendly, `obstacle` for hostile                  | Preserve bolt versus missile shape; differentiate ownership beyond hue through an additional contour or glyph.                              |
| Discovery indicator                                    | `pointOfInterest`                                              | Preserve existing arrow and circle; no additional navigation system.                                                                        |

Ordinary asteroids and stationary scenery block or slide Ada without damage.
Attacks, marked hazards and moving ballistic debris damage the shield. Color
follows those existing behaviors, not the generic meaning of an object name.
Keep Ada's compact white-and-blue authored ship and existing character sprites.
NPCs are characters, not damaging scenery; the type union has no separate NPC
kind. Preserve encounter identity and approved dialogue instead of inventing NPCs.

## Bounded spatial variety

Use existing harmless rock silhouettes for faceted asteroids, compact ribbed
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

References below use the source baseline above.

- `src/main.ts:21`: replace the fixed canvas background with `background`.
- `src/game/scene.ts:55`: palette loading is absent; preload currently loads only
  the art manifest and its assets. Consume Art's separately supplied palette pin.
- `src/game/scene.ts:239`: mute motion markers with `environmentDetail`; keep
  enough contrast to show movement against the new field.
- `src/game/scene.ts:555`: replace the shared grey stroke/fill with per-subject
  semantics. `drawObject` currently makes rock and debris identical at line 632;
  inspect `velocity` to mark damaging ballistic debris separately.
- `src/game/scene.ts:558`: preserve destination double ellipses and labels;
  reconcile the fixed label background at line 568 with the field color.
- `src/game/scene.ts:599`: retain pickup glyphs while separating cargo and weapons;
  replace the white resource fill at line 629 with a readable resource accent.
- `src/game/scene.ts:368`: enemy hull, detail and pack marks remain greyscale.
  Live/disabled part styles at line 389 and health bars at line 424 need semantic
  colors without losing command, engine and weapon shape distinctions.
- `src/game/scene.ts:252`: shots share white styling; preserve missile geometry
  while exposing friendly/hostile ownership from `Shot.enemy`.
- `src/game/scene.ts:471`: discovery marks are white. Feedback at line 483 also
  shares white; retain distinct pulse shapes and reserve hazard color for damage
  rather than recoloring every feedback event as a threat.

## Geometry and readability constraints

`src/model/types.ts:13` defines the seven existing kinds; line 22 supplies the
optional velocity distinction. `src/model/flight.ts:139` generates encounter
regions; line 205 already selects open, clustered and paired-wall terrain.
Gameplay owns changes to spacing, placement and clearances. Tech integrates
approved visual variants without changing those rules.

`src/model/flight.ts:514` resolves scenery collision using circular radii.
`src/model/flight.ts:687` applies ballistic-debris damage; line 863 applies marked
hazard damage. Preserve these distinctions and safe destination clearance at
line 350. The scenery and safe-arrival contract is in Gameplay's
[Flight and combat](../gameplay/rules.md#flight-and-combat); existing spatial
variety is described under
[Persistence and regeneration](../gameplay/rules.md#persistence-and-regeneration).

At logical display size, check that muted contours remain visible against the
field, especially inside the compressed isometric projection
(`src/game/scene.ts:217`). Do not let seams, stars or labels obscure live parts,
projectiles or passage edges. Lavender POIs, teal resources, amber weapons and
salmon hazards need their distinct shapes retained for hue-independent reading.
Large hostile hulls must remain distinguishable from harmless constructed masses.
Keep decorative silhouettes within existing culling bounds
(`src/game/scene.ts:547`) and leave visible gaps wherever movement is possible.
