# Polish set: Tech handoff

Every renderer and reader change the accepted polish set needs, by group.
Staged rows are in [polish-rows.json](polish-rows.json); each group switches
in one landing. Art files that are already live need no Tech change beyond
the test pins listed.

## Live: no renderer change

| Group                         | Files                                                                                            | Tech follow-up                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Weapon and hostile map glyphs | `ui/icons/icons-20x20.svg`, `ui/icons/icons-24x24.svg`                                           | None                                                                                                        |
| Traveling debris              | The five debris sheets, `cartwheel/debris.json`, `whirlpool/debris.json`, `needle/channels.json` | `src/game/sceneNeedle.test.ts` pins the Needle plate's frame 0 bounds, now `[7.12, 18.745, 61.487, 59.542]` |
| Decorations, four galaxies    | `decoration-sheet.svg` and `backdrop.json` sprites for Cartwheel, Whirlpool, Needle, Phantom     | `src/game/textures.test.ts` pins each sprite's `width` and `height`; read them from each `backdrop.json`    |
| Quantum jump                  | `quantum-jump-tunnel.webp`, `-field.webp`, `-glow.png`, `-star.png`                              | None: ids, sizes and frame names are unchanged                                                              |

## Staged: switch with a reader or renderer change

| Rows group                                       | Art side                                                                            | Tech change                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decorations-sunflower`, `decorations-andromeda` | `decoration-set-sheet.svg`, six rows and six sprites each                           | Replace the three manifest rows with the six and `decorations.sprites` with the staged list, in `backdrop.json` and in `backdrop-lattice.json`; drop `decoration-sheet.svg`; update the `textures.test.ts` pins                                                                                                                                                                                                                       |
| `field`, `field-{galaxy}`                        | `backdrop-lattice.json` and one per galaxy ([motif field](backdrop.md#motif-field)) | `src/game/backdropField.ts` and `src/game/backdropLayers.ts`: motif plates on the lattice with even-odd rings, round two-tone planets on the chunk checker with one ring band, checker streaks of one length, checker rock placement; then point the `backdropLayers` and `backdrop` links at the new files and drop the old ones. Tests: `backdropLayers.test.ts`, `backdropStars.test.ts`, `asteroidArt.test.ts`, `scenery.test.ts` |
| `previews`                                       | Twelve cards in `public/art/previews/` ([preview cards](galaxies.md#preview-cards)) | Point the selector at `card-{galaxy}.png` and `card-{galaxy}-locked.png`; update `src/pwa/precachePlugin.ts` and `tools/browser-smoke.mjs`; retire `tools/galaxy-previews.mjs`, the `public/previews/` captures and the placeholder previews with their `galaxy-preview-*` rows. Tests: `routeArt.test.ts`, `precachePlugin.test.ts`                                                                                                  |
| `effects-destruction`                            | [Destruction, flat look](destruction.md#flat-look)                                  | `src/game/destructionArt.ts`, `src/game/shardPalettePack.ts`: cool toward the family's own tone, alpha in held steps; write the staged `shards.cool` and `shards.fade` into `destruction.json`                                                                                                                                                                                                                                        |
| `runtime-currents`                               | [Ordered darts](whirlpool.md#ordered-darts)                                         | `src/game/currentStreaks.ts`: filled dart polygon, even lanes and rows, stepped size and alpha; `currentStreaks.test.ts`                                                                                                                                                                                                                                                                                                              |
| `runtime-stitch`                                 | [Bolder stitch](needle.md#bolder-stitch)                                            | Data only: write `width`, `dash` and `alpha` into `channels.json`                                                                                                                                                                                                                                                                                                                                                                     |
| `runtime-eye`                                    | [Ordered Eye](needle.md#ordered-eye)                                                | `src/model/needle.ts`: piece by row, tumble frame by index and row, no spread; after Gameplay accepts 360 pieces in place of 468                                                                                                                                                                                                                                                                                                      |
| `runtime-band`                                   | [Flat band](needle.md#flat-band)                                                    | `src/game/backdropLayers.ts`: two flat strips, specks and stars by pitch and offset cycle; `backdropBand.test.ts`. The backdrop producer's contrast check then reads the flat profile                                                                                                                                                                                                                                                 |

## Specification only: renderer changes

| Effect                         | Specification                                                               | Tech change                                                                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bolt, pellet, Multi-Laser fan  | [Weapons, flat look](weapons.md#bolt-pellet-and-fan)                        | `src/game/weaponEffects.ts`: slug polygons, lit pellet, fan wedge under 5.6 px head spacing                                                                                                                 |
| Blast, beams, contacts, sparks | [Weapons, flat look](weapons.md#blast)                                      | `src/game/weaponEffects.ts`, `src/game/enemyWeaponsArt.ts`: flat shapes, stepped alpha                                                                                                                      |
| Ring burst, shockwave          | [Weapons, flat look](weapons.md#ring-burst-and-mine)                        | `src/game/enemyWeaponsArt.ts`                                                                                                                                                                               |
| Missiles and mine              | [Weapons, frames](weapons.md#missile-and-mine-frames), rows `weapon-solids` | `src/game/weaponEffects.ts`, `src/game/enemyWeaponsArt.ts`: add the staged rows to the core manifest, draw the frame for the heading or spin step in place of the polygons, and draw the flat flame in code |
| Pull streak                    | [Stardust](stardust.md#optional-pull-streak)                                | `src/game/stardustArt.ts`: two wedges                                                                                                                                                                       |
| Tow line                       | [Cartwheel props](cartwheel-props.md#tow-line)                              | `src/game/towArt.ts`: wider cable, one clamp block, no beads                                                                                                                                                |
| Lost item ping                 | [Jobs](jobs.md)                                                             | Ring width and stepped alpha                                                                                                                                                                                |
| Quantum jump iris rim          | [Quantum jump](quantum-jump.md#rendering)                                   | A 5 px `#dcc3f2` rim from r to r + 5 and a 3 px ink `#181425` ring from r + 5 to r + 8, in place of the 3 px rim and 1 px cyan line                                                                         |

Tests to rerun with the effect changes: `weaponEffects.test.ts`,
`weaponImpacts.test.ts`, `enemyWeaponsArt.test.ts`, `destructionArt.test.ts`,
`shardPalettePack.test.ts`, `stardustArt.test.ts`, `towArt.test.ts`,
`lightField.test.ts` and `quantumJump.test.ts`.

## Disabled frames

Tech selects these in place of element opacity ([Controls](controls.md)).
The two sprite sheets gained frames in place, with every existing frame
unchanged pixel for pixel. The four icons are staged in their own sheets as
`disabled-icons`, because the live icon sheets' view positions and id list
are pinned by tests.

| Sprite                             | New frame or view                                         | Tech wiring                                                                       |
| ---------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `ui-close` (72 by 24), in place    | Tag `disabled`, frame 2                                   | Show it for a disabled close                                                      |
| `ui-switch` (128 by 16), in place  | Tags `on-disabled` and `off-disabled`, frames 2 and 3     | Show them for a disabled switch row                                               |
| `icons-35x35-disabled.svg`, staged | Views `pause-disabled` and `menu-disabled`                | Map both ids in `src/data/uiIconUrl.ts` and show them for a disabled disc         |
| `icons-20x20-disabled.svg`, staged | Views `icon-cargo-20-disabled` and `icon-tow-20-disabled` | Map both ids in `src/data/uiIconUrl.ts` and show them on a disabled ship card row |

To fold the four icons into the live sheets instead, move their ids from
`stagedIcons` to `staticIcons` in `art/tools/ui-icon-sources.ts`, repack and
update the view pins in `uiIconUrl.test.ts`, `statusPill.test.ts` and
`navigationButton.test.ts`.

## For Gameplay

- The Eye: 360 debris pieces in place of 468, with no across spread.
- Debris `radius` grew with the drawn extents: Cartwheel 58.56, Whirlpool
  plate 59.91 and girder 51.87, Needle plate 38.619 and girder 40.09 frame px.
