# Art

Art owns the art rules, asset specifications and pipeline in [art/](../../art/README.md); assets ship from `public/art/`.

- Layout: screen geometry, HUD placement and the modal width families (Large 688, Medium 500, Small 400, inset by a 16 px screen margin) are in [layout](../../art/layout.md).
- Space: placeholders stay monochrome apart from Ada's white-and-blue ship. Every play object draws over an ink keyline, and palette roles are in [space palette](../../art/space-palette.md).
- Ships and jets: hull, flame layers and the logical-size jet rule are in [ship](../../art/ship.md).
- Map: the local map, galaxy selector and survey header are in [map](../../art/map.md).
- Producers: generated assets come from `art/tools/` and are pinned by hash in `public/art/manifest.json`.

Reference: [art](../../art/README.md).

## Work items

| ID       | Title                                                                     | Link                               |
| -------- | ------------------------------------------------------------------------- | ---------------------------------- |
| ada-0007 | Replace the survey beacon pedestal with symmetric solar panels            | [ada-0007.md](../work/ada-0007.md) |
| ada-0008 | Document the player jet materials, small core and middle band             | [ada-0008.md](../work/ada-0008.md) |
| ada-0009 | Encode the quantum jump sheets as lossy WebP quality 90                   | [ada-0009.md](../work/ada-0009.md) |
| ada-0010 | Place the sticks and shield pill and specify the threat-red hit flash     | [ada-0010.md](../work/ada-0010.md) |
| ada-0011 | Align the Ship card and ship keyline specs with the rendered game         | [ada-0011.md](../work/ada-0011.md) |
| ada-0012 | Size modals by width family with Large cards at 688                       | [ada-0012.md](../work/ada-0012.md) |
| ada-0013 | Place the Interaction close X, story Skip faces and 844x390 HUD row       | [ada-0013.md](../work/ada-0013.md) |
| ada-0014 | Match the map tools and galaxy selector specs to source                   | [ada-0014.md](../work/ada-0014.md) |
| ada-0133 | Document Art ownership and build producers on the published ArtKit        | [ada-0133.md](../work/ada-0133.md) |
| ada-0134 | Keep the art manifest as a shared core and per-galaxy manifests           | [ada-0134.md](../work/ada-0134.md) |
| ada-0135 | Write generated JSON in Prettier's layout through one writer              | [ada-0135.md](../work/ada-0135.md) |
| ada-0136 | Reuse Archie's portraits for Ada and the Toronto cast                     | [ada-0136.md](../work/ada-0136.md) |
| ada-0137 | Reuse Chibi's UI assets, fonts and touch joystick sheets                  | [ada-0137.md](../work/ada-0137.md) |
| ada-0138 | Define the restrained pastel space palette                                | [ada-0138.md](../work/ada-0138.md) |
| ada-0139 | Draw the weapon icon set and specify weapon effects                       | [ada-0139.md](../work/ada-0139.md) |
| ada-0140 | Build the isometric delta ship and its app icon                           | [ada-0140.md](../work/ada-0140.md) |
| ada-0141 | Export the ship's speed jets, headings and nose points                    | [ada-0141.md](../work/ada-0141.md) |
| ada-0142 | Rebuild Ada's ship as a pyramid hull                                      | [ada-0142.md](../work/ada-0142.md) |
| ada-0143 | Draw the Settings row icons and 16 px control icons                       | [ada-0143.md](../work/ada-0143.md) |
| ada-0144 | Export the coral enemy family with destruction shards                     | [ada-0144.md](../work/ada-0144.md) |
| ada-0145 | Recolour the controls and define the shared card and pause card           | [ada-0145.md](../work/ada-0145.md) |
| ada-0146 | Draw the HUD weapon discs and their states                                | [ada-0146.md](../work/ada-0146.md) |
| ada-0147 | Specify the station card, shop and Stardust art                           | [ada-0147.md](../work/ada-0147.md) |
| ada-0148 | Export ship paint schemes as recoloured idle frames                       | [ada-0148.md](../work/ada-0148.md) |
| ada-0149 | Add the layout specification and its tokens                               | [ada-0149.md](../work/ada-0149.md) |
| ada-0150 | Draw the rock and its glow transitions                                    | [ada-0150.md](../work/ada-0150.md) |
| ada-0151 | Draw the cockpit background and the holodisk                              | [ada-0151.md](../work/ada-0151.md) |
| ada-0152 | Draw the quantum jump effect as a warp tunnel                             | [ada-0152.md](../work/ada-0152.md) |
| ada-0153 | Specify the shared compact conversation box                               | [ada-0153.md](../work/ada-0153.md) |
| ada-0154 | Draw Astra, General Gadget and Penny portraits                            | [ada-0154.md](../work/ada-0154.md) |
| ada-0155 | Paint the storybook Earth scenes and Ada's family                         | [ada-0155.md](../work/ada-0155.md) |
| ada-0156 | Specify the story panel and anchor story backgrounds                      | [ada-0156.md](../work/ada-0156.md) |
| ada-0157 | Draw the growers, workshop and salvagers outposts and the discovery cache | [ada-0157.md](../work/ada-0157.md) |
| ada-0158 | Combine the HUD counts in one status pill                                 | [ada-0158.md](../work/ada-0158.md) |
| ada-0159 | Anchor the HUD and touch sticks to the game area                          | [ada-0159.md](../work/ada-0159.md) |
| ada-0160 | Draw the asteroid and backdrop rock sprites with footprints               | [ada-0160.md](../work/ada-0160.md) |
| ada-0161 | Export the frigate and capital with destructible hardpoints               | [ada-0161.md](../work/ada-0161.md) |
| ada-0162 | Give each galaxy a field hue and rule the light-field keyline             | [ada-0162.md](../work/ada-0162.md) |
| ada-0163 | Draw the Whirlpool lantern whale family                                   | [ada-0163.md](../work/ada-0163.md) |
| ada-0164 | Specify the Projects tab and draw project world changes                   | [ada-0164.md](../work/ada-0164.md) |
| ada-0165 | Add the ammunition count pill, empty state and ammunition icons           | [ada-0165.md](../work/ada-0165.md) |
| ada-0166 | Specify the full-screen local map                                         | [ada-0166.md](../work/ada-0166.md) |
| ada-0167 | Draw Cartwheel's hub, craft, resource rocks and claim jumpers             | [ada-0167.md](../work/ada-0167.md) |
| ada-0168 | Draw Whirlpool's currents, river debris and buoys                         | [ada-0168.md](../work/ada-0168.md) |
| ada-0169 | Draw the start screen and its HUD row discs                               | [ada-0169.md](../work/ada-0169.md) |
| ada-0170 | Export story craft noses and dock poses                                   | [ada-0170.md](../work/ada-0170.md) |
| ada-0171 | Render art at device resolution                                           | [ada-0171.md](../work/ada-0171.md) |
| ada-0172 | Set button gaps and group order                                           | [ada-0172.md](../work/ada-0172.md) |
| ada-0173 | Specify the loading bar                                                   | [ada-0173.md](../work/ada-0173.md) |
| ada-0174 | Trace drawn silhouettes into convex collision parts                       | [ada-0174.md](../work/ada-0174.md) |
| ada-0175 | Specify the off-screen edge markers                                       | [ada-0175.md](../work/ada-0175.md) |
| ada-0176 | Specify the galaxy map and draw its evening sky                           | [ada-0176.md](../work/ada-0176.md) |
| ada-0177 | Draw Andromeda's stations, settlements, craft and cast                    | [ada-0177.md](../work/ada-0177.md) |
| ada-0178 | Draw Needle's station, gates, channels, craft and cast                    | [ada-0178.md](../work/ada-0178.md) |
| ada-0179 | Draw the galaxy cast and household portraits                              | [ada-0179.md](../work/ada-0179.md) |
| ada-0180 | Draw the job board art                                                    | [ada-0180.md](../work/ada-0180.md) |
| ada-0181 | Draw ore in its own tones and field families                              | [ada-0181.md](../work/ada-0181.md) |
| ada-0182 | Place the shield pill and draw its recharge timer                         | [ada-0182.md](../work/ada-0182.md) |
| ada-0183 | Generate layered parallax backdrops for every galaxy                      | [ada-0183.md](../work/ada-0183.md) |
| ada-0184 | Draw Phantom's field, settlements, station and cast                       | [ada-0184.md](../work/ada-0184.md) |
| ada-0185 | Draw stations and destinations at the destination scale                   | [ada-0185.md](../work/ada-0185.md) |
| ada-0186 | Draw tiered heavy weapon mounts and enemy weapon effects                  | [ada-0186.md](../work/ada-0186.md) |
| ada-0187 | Draw the upgrade and ammo pack pickups                                    | [ada-0187.md](../work/ada-0187.md) |
| ada-0188 | Present station keepers in the story dialogue format                      | [ada-0188.md](../work/ada-0188.md) |
| ada-0189 | Draw stranded craft for every galaxy's rescue tows                        | [ada-0189.md](../work/ada-0189.md) |
| ada-0190 | Colour jets, weapon discs and notices by upgrade tier                     | [ada-0190.md](../work/ada-0190.md) |
| ada-0191 | Picture every aboard page as Ada's ship from outside                      | [ada-0191.md](../work/ada-0191.md) |
| ada-0192 | Specify the Ship card's equipment, weapons and cargo layout               | [ada-0192.md](../work/ada-0192.md) |
| ada-0193 | Render story scenes as environment-only shared scenes                     | [ada-0193.md](../work/ada-0193.md) |
| ada-0194 | Fit modals and page their content within the safe game area               | [ada-0194.md](../work/ada-0194.md) |
| ada-0195 | Align the Paused card actions and Ship navigation                         | [ada-0195.md](../work/ada-0195.md) |
| ada-0196 | Update the shared ship geometry and six paint schemes                     | [ada-0196.md](../work/ada-0196.md) |
| ada-0197 | Draw blue wingtip retro jets                                              | [ada-0197.md](../work/ada-0197.md) |
| ada-0198 | Attach centred engine plumes to the ship's rear apertures                 | [ada-0198.md](../work/ada-0198.md) |
| ada-0199 | Integrate the 64-heading player ship package                              | [ada-0199.md](../work/ada-0199.md) |
| ada-0200 | Specify the shared weapon impact families                                 | [ada-0200.md](../work/ada-0200.md) |
| ada-0201 | Pair enemy actor profiles with reviewed enemy assets                      | [ada-0201.md](../work/ada-0201.md) |
| ada-0202 | Ship the full UI fonts as WOFF2                                           | [ada-0202.md](../work/ada-0202.md) |
| ada-0278 | Audit drawn-pixel padding on the remaining pills and buttons              | [ada-0278.md](../work/ada-0278.md) |
| ada-0279 | Mock up denser muted backdrops for every galaxy                           | [ada-0279.md](../work/ada-0279.md) |
| ada-0280 | Mock up full-screen cards and the conversation view for Use interactions  | [ada-0280.md](../work/ada-0280.md) |
| ada-0281 | Consolidate each art set's SVG frames into sheets with frame data         | [ada-0281.md](../work/ada-0281.md) |
| ada-0282 | Store shared enemy assets once and reference them from each galaxy        | [ada-0282.md](../work/ada-0282.md) |
| ada-0283 | Round generated SVG coordinates to one decimal and minify                 | [ada-0283.md](../work/ada-0283.md) |
| ada-0284 | Subset the UI fonts to the glyphs the game's strings use                  | [ada-0284.md](../work/ada-0284.md) |
| ada-0285 | Encode the story scenes and large root images as lossy WebP               | [ada-0285.md](../work/ada-0285.md) |
| ada-0286 | Show map survey progress as ten fixed pips                                | [ada-0286.md](../work/ada-0286.md) |
| ada-0289 | Use one compact conversation card for every Use interaction               | [ada-0289.md](../work/ada-0289.md) |
| ada-0290 | Ship the denser muted backdrops in every galaxy                           | [ada-0290.md](../work/ada-0290.md) |
| ada-0291 | Fix the eleven padding mismatches from the drawn-pixel audit              | [ada-0291.md](../work/ada-0291.md) |
| ada-0292 | Draw a maskable app icon with safe-zone padding                           | [ada-0292.md](../work/ada-0292.md) |
| ada-0296 | Load enemy and story craft data files from each manifest's sidecars map   | [ada-0296.md](../work/ada-0296.md) |
| ada-0297 | Draw the far rock depth and mute backdrop rocks opaquely                  | [ada-0297.md](../work/ada-0297.md) |
| ada-0298 | Ship the aboard backdrop set as SVG                                       | [ada-0298.md](../work/ada-0298.md) |
| ada-0301 | Ship the Garden Party chapter art                                         | [ada-0301.md](../work/ada-0301.md) |
| ada-0302 | Ship the finale ally ships and whale aura                                 | [ada-0302.md](../work/ada-0302.md) |
| ada-0303 | Mock up the finale allies follow-up                                       | [ada-0303.md](../work/ada-0303.md) |
| ada-0305 | Remove the art files the game never loads                                 | [ada-0305.md](../work/ada-0305.md) |
| ada-0306 | Regenerate debris, nebulae and Whirlpool art for the light galaxy fields  | [ada-0306.md](../work/ada-0306.md) |
| ada-0313 | Outline every play object on the light galaxy fields                      | [ada-0313.md](../work/ada-0313.md) |
| ada-0320 | Specify the Small Cheats card and draw the FPS counter icon               | [ada-0320.md](../work/ada-0320.md) |
| ada-0345 | Redraw stations and points of interest                                    | [ada-0345.md](../work/ada-0345.md) |
| ada-0347 | Distinguish combat, industrial, and rescue craft                          | [ada-0347.md](../work/ada-0347.md) |
| ada-0354 | Improve and reuse Earth Storybook backgrounds                             | [ada-0354.md](../work/ada-0354.md) |
