# Art

Art owns the art rules, asset specifications and pipeline in [art/](../../art/README.md); assets ship from `public/art/`.

- Layout: screen geometry, HUD placement and the modal width families (Large 688, Medium 500, Small 400, inset by a 16 px screen margin) are in [layout](../../art/layout.md).
- Space: placeholders stay monochrome apart from Ada's white-and-blue ship. Every play object draws over an ink keyline, and palette roles are in [space palette](../../art/space-palette.md).
- Ships and jets: hull, flame layers and the logical-size jet rule are in [ship](../../art/ship.md).
- Map: the local map, galaxy selector and survey header are in [map](../../art/map.md).
- Producers: generated assets come from `art/tools/` and are pinned by hash in `public/art/manifest.json`.

Reference: [art](../../art/README.md).

## Work items

| ID       | Title                                                                     | Link                                                                           |
| -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ada-0007 | Replace the survey beacon pedestal with symmetric solar panels            | [ada-0007.md](../work/ada-0007.md)                                             |
| ada-0008 | Document the player jet materials, small core and middle band             | [ada-0008.md](../work/ada-0008.md)                                             |
| ada-0009 | Encode the quantum jump sheets as lossy WebP quality 90                   | [ada-0009.md](../work/ada-0009.md)                                             |
| ada-0010 | Place the sticks and shield pill and specify the threat-red hit flash     | [ada-0010.md](../work/ada-0010.md)                                             |
| ada-0011 | Align the Ship card and ship keyline specs with the rendered game         | [ada-0011.md](../work/ada-0011.md)                                             |
| ada-0012 | Size modals by width family with Large cards at 688                       | [ada-0012.md](../work/ada-0012.md)                                             |
| ada-0013 | Place the Interaction close X, story Skip faces and 844x390 HUD row       | [ada-0013.md](../work/ada-0013.md)                                             |
| ada-0014 | Match the map tools and galaxy selector specs to source                   | [ada-0014.md](../work/ada-0014.md)                                             |
| TBD      | Document Art ownership and build producers on the published ArtKit        | [pending-art-pipeline.md](../work/pending-art-pipeline.md)                     |
| TBD      | Keep the art manifest as a shared core and per-galaxy manifests           | [pending-art-manifest.md](../work/pending-art-manifest.md)                     |
| TBD      | Write generated JSON in Prettier's layout through one writer              | [pending-generated-json-writer.md](../work/pending-generated-json-writer.md)   |
| TBD      | Reuse Archie's portraits for Ada and the Toronto cast                     | [pending-archie-portraits.md](../work/pending-archie-portraits.md)             |
| TBD      | Reuse Chibi's UI assets, fonts and touch joystick sheets                  | [pending-chibi-ui-reuse.md](../work/pending-chibi-ui-reuse.md)                 |
| TBD      | Define the restrained pastel space palette                                | [pending-space-palette.md](../work/pending-space-palette.md)                   |
| TBD      | Draw the weapon icon set and specify weapon effects                       | [pending-weapon-icons.md](../work/pending-weapon-icons.md)                     |
| TBD      | Build the isometric delta ship and its app icon                           | [pending-isometric-delta-ship.md](../work/pending-isometric-delta-ship.md)     |
| TBD      | Export the ship's speed jets, headings and nose points                    | [pending-ship-jets-headings.md](../work/pending-ship-jets-headings.md)         |
| TBD      | Rebuild Ada's ship as a pyramid hull                                      | [pending-ship-pyramid-hull.md](../work/pending-ship-pyramid-hull.md)           |
| TBD      | Draw the Settings row icons and 16 px control icons                       | [pending-control-icons.md](../work/pending-control-icons.md)                   |
| TBD      | Export the coral enemy family with destruction shards                     | [pending-coral-enemies.md](../work/pending-coral-enemies.md)                   |
| TBD      | Recolour the controls and define the shared card and pause card           | [pending-controls-cards.md](../work/pending-controls-cards.md)                 |
| TBD      | Draw the HUD weapon discs and their states                                | [pending-weapon-discs.md](../work/pending-weapon-discs.md)                     |
| TBD      | Specify the station card, shop and Stardust art                           | [pending-station-shop.md](../work/pending-station-shop.md)                     |
| TBD      | Export ship paint schemes as recoloured idle frames                       | [pending-paint-schemes.md](../work/pending-paint-schemes.md)                   |
| TBD      | Add the layout specification and its tokens                               | [pending-layout-spec.md](../work/pending-layout-spec.md)                       |
| TBD      | Draw the rock and its glow transitions                                    | [pending-rock-glow.md](../work/pending-rock-glow.md)                           |
| TBD      | Draw the cockpit background and the holodisk                              | [pending-cockpit-holodisk.md](../work/pending-cockpit-holodisk.md)             |
| TBD      | Draw the quantum jump effect as a warp tunnel                             | [pending-quantum-jump.md](../work/pending-quantum-jump.md)                     |
| TBD      | Specify the shared compact conversation box                               | [pending-conversation-box.md](../work/pending-conversation-box.md)             |
| TBD      | Draw Astra, General Gadget and Penny portraits                            | [pending-core-portraits.md](../work/pending-core-portraits.md)                 |
| TBD      | Paint the storybook Earth scenes and Ada's family                         | [pending-storybook-earth.md](../work/pending-storybook-earth.md)               |
| TBD      | Specify the story panel and anchor story backgrounds                      | [pending-story-panel.md](../work/pending-story-panel.md)                       |
| TBD      | Draw the growers, workshop and salvagers outposts and the discovery cache | [pending-outposts-cache.md](../work/pending-outposts-cache.md)                 |
| TBD      | Combine the HUD counts in one status pill                                 | [pending-status-pill.md](../work/pending-status-pill.md)                       |
| TBD      | Anchor the HUD and touch sticks to the game area                          | [pending-touch-sticks.md](../work/pending-touch-sticks.md)                     |
| TBD      | Draw the asteroid and backdrop rock sprites with footprints               | [pending-asteroids.md](../work/pending-asteroids.md)                           |
| TBD      | Export the frigate and capital with destructible hardpoints               | [pending-heavies.md](../work/pending-heavies.md)                               |
| TBD      | Give each galaxy a field hue and rule the light-field keyline             | [pending-galaxy-fields.md](../work/pending-galaxy-fields.md)                   |
| TBD      | Draw the Whirlpool lantern whale family                                   | [pending-whales.md](../work/pending-whales.md)                                 |
| TBD      | Specify the Projects tab and draw project world changes                   | [pending-project-world-changes.md](../work/pending-project-world-changes.md)   |
| TBD      | Add the ammunition count pill, empty state and ammunition icons           | [pending-ammo-hud.md](../work/pending-ammo-hud.md)                             |
| TBD      | Specify the full-screen local map                                         | [pending-local-map.md](../work/pending-local-map.md)                           |
| TBD      | Draw Cartwheel's hub, craft, resource rocks and claim jumpers             | [pending-cartwheel.md](../work/pending-cartwheel.md)                           |
| TBD      | Draw Whirlpool's currents, river debris and buoys                         | [pending-whirlpool-currents.md](../work/pending-whirlpool-currents.md)         |
| TBD      | Draw the start screen and its HUD row discs                               | [pending-start-screen.md](../work/pending-start-screen.md)                     |
| TBD      | Export story craft noses and dock poses                                   | [pending-story-craft-noses.md](../work/pending-story-craft-noses.md)           |
| TBD      | Render art at device resolution                                           | [pending-device-pixel-rendering.md](../work/pending-device-pixel-rendering.md) |
| TBD      | Set button gaps and group order                                           | [pending-button-gaps.md](../work/pending-button-gaps.md)                       |
| TBD      | Specify the loading bar                                                   | [pending-loading-bar.md](../work/pending-loading-bar.md)                       |
| TBD      | Trace drawn silhouettes into convex collision parts                       | [pending-silhouette-collision.md](../work/pending-silhouette-collision.md)     |
| TBD      | Specify the off-screen edge markers                                       | [pending-edge-markers.md](../work/pending-edge-markers.md)                     |
| TBD      | Specify the galaxy map and draw its evening sky                           | [pending-galaxy-map.md](../work/pending-galaxy-map.md)                         |
| TBD      | Draw Andromeda's stations, settlements, craft and cast                    | [pending-andromeda.md](../work/pending-andromeda.md)                           |
| TBD      | Draw Needle's station, gates, channels, craft and cast                    | [pending-needle.md](../work/pending-needle.md)                                 |
| TBD      | Draw the galaxy cast and household portraits                              | [pending-cast-portraits.md](../work/pending-cast-portraits.md)                 |
| TBD      | Draw the job board art                                                    | [pending-job-board-art.md](../work/pending-job-board-art.md)                   |
| TBD      | Draw ore in its own tones and field families                              | [pending-ore-art.md](../work/pending-ore-art.md)                               |
| TBD      | Place the shield pill and draw its recharge timer                         | [pending-shield-pill.md](../work/pending-shield-pill.md)                       |
| TBD      | Generate layered parallax backdrops for every galaxy                      | [pending-parallax-backdrops.md](../work/pending-parallax-backdrops.md)         |
| TBD      | Draw Phantom's field, settlements, station and cast                       | [pending-phantom.md](../work/pending-phantom.md)                               |
| TBD      | Draw stations and destinations at the destination scale                   | [pending-destinations.md](../work/pending-destinations.md)                     |
| TBD      | Draw tiered heavy weapon mounts and enemy weapon effects                  | [pending-heavy-mounts.md](../work/pending-heavy-mounts.md)                     |
| TBD      | Draw the upgrade and ammo pack pickups                                    | [pending-pickups.md](../work/pending-pickups.md)                               |
| TBD      | Present station keepers in the story dialogue format                      | [pending-station-dialogue.md](../work/pending-station-dialogue.md)             |
| TBD      | Draw stranded craft for every galaxy's rescue tows                        | [pending-stranded-craft.md](../work/pending-stranded-craft.md)                 |
| TBD      | Colour jets, weapon discs and notices by upgrade tier                     | [pending-upgrade-tiers.md](../work/pending-upgrade-tiers.md)                   |
| TBD      | Picture every aboard page as Ada's ship from outside                      | [pending-aboard-pages.md](../work/pending-aboard-pages.md)                     |
| TBD      | Specify the Ship card's equipment, weapons and cargo layout               | [pending-ship-card.md](../work/pending-ship-card.md)                           |
| TBD      | Render story scenes as environment-only shared scenes                     | [pending-story-environments.md](../work/pending-story-environments.md)         |
| TBD      | Fit modals and page their content within the safe game area               | [pending-modal-fit.md](../work/pending-modal-fit.md)                           |
| TBD      | Align the Paused card actions and Ship navigation                         | [pending-pause-actions.md](../work/pending-pause-actions.md)                   |
| TBD      | Update the shared ship geometry and six paint schemes                     | [pending-ship-geometry-paints.md](../work/pending-ship-geometry-paints.md)     |
| TBD      | Draw blue wingtip retro jets                                              | [pending-retro-jets.md](../work/pending-retro-jets.md)                         |
| TBD      | Attach centred engine plumes to the ship's rear apertures                 | [pending-engine-apertures.md](../work/pending-engine-apertures.md)             |
| TBD      | Integrate the 64-heading player ship package                              | [pending-ship-64-headings.md](../work/pending-ship-64-headings.md)             |
| TBD      | Specify the shared weapon impact families                                 | [pending-weapon-impacts.md](../work/pending-weapon-impacts.md)                 |
| TBD      | Pair enemy actor profiles with reviewed enemy assets                      | [pending-enemy-actor-assets.md](../work/pending-enemy-actor-assets.md)         |
| TBD      | Ship the full UI fonts as WOFF2                                           | [pending-ui-fonts-woff2.md](../work/pending-ui-fonts-woff2.md)                 |
