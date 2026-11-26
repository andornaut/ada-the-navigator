# Polish set production

The plan and state of the accepted polish set: what each group ships, where
it is staged and what remains. Renderer changes are in the
[Tech handoff](polish-handoff.md).

## Groups

| Group                         | Deliverable                                                                                                           | State                                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Weapon and hostile map glyphs | Produced files, replaced in place                                                                                     | Produced                                           |
| Traveling debris              | Produced files and collision data, replaced in place                                                                  | Produced                                           |
| Giant decorations             | Produced files in place for every galaxy, six frames on Sunflower and Andromeda                                       | Produced                                           |
| Backdrop field                | Produced data in place, with its contrast check                                                                       | Produced                                           |
| Quantum jump                  | Produced rasters, replaced in place; the iris rim is a specification                                                  | Produced                                           |
| Weapon and destruction looks  | Specifications; staged shard data                                                                                     | Specified                                          |
| Runtime effects               | Staged data and specifications: current streaks, stitch, the Eye, the band                                            | Specified                                          |
| Missile and mine frames       | Produced frames of the solid models in [Weapons](weapons.md#missile-and-mine-frames), staged                          | Produced                                           |
| Galaxy preview cards          | Produced cards, staged beside the captured previews                                                                   | Produced from the station redesign's main stations |
| Disabled frames               | Close X and switch frames added to their sheets in place; pause, menu, cargo and tow icons staged in their own sheets | Produced                                           |

Unchanged by decision: play asteroids, backdrop rocks, portraits, pet sprites
and story scenes.

## Staging

[polish-rows.json](polish-rows.json) holds one group per switch, each
rewritten whole by its producer.

## Model layer

The solids come from the shared mesh layer in `art/tools/solid.ts`
(`meshRing`, `meshHoop`, `meshDome`, `meshSpiral`, `meshBlock`, `meshBar`,
`meshPlace`), with tone paths from `art/tools/fleet.ts`. The debris arc and
the Whirlpool decoration arms close the spiral's open underside and starting
end with their own faces.

## Review

`node art/tools/polish-contact-sheet.ts <dir>` writes the glyph, debris and
decoration sheets, and `node art/tools/backdrop.ts --preview <dir>` the
motif field cameras as `{galaxy}-lattice-{k}.png`.

## Known producer defects

- `art/tools/cartwheel-props.ts` rewrites
  `public/art/cartwheel/manifest.json` with the `svgSheet` key of the
  stranded craft rows in a different position. The content is equal; the
  reordered file is not committed.
