# UI

The interface is HTML over the Phaser canvas. Cards, buttons, actions and prose come from the
pinned game-kit typed layout tree through a local adapter; action registries, availability,
modal lifecycle and return context stay outside tree data. The Ship inventory and the read-only
completion indicators use shared presentation factories and stylesheet. The 720 by 360 play view stays centred while the canvas fills the available space,
and portrait touch screens turn the page frame to landscape.

Reference: [UI layout tree](../ui-layout-tree.md), [ship screen](../ship-screen.md),
[completion indicators](../completion-indicators.md), [Phone](../../src/README.md#phone).

## Work items

| ID       | Title                                                                           | Link                               |
| -------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| ada-0001 | Centre the game area in iPhone portrait                                         | [ada-0001.md](../work/ada-0001.md) |
| ada-0003 | Hide the parent dim when Settings opens over Pause or Menu                      | [ada-0003.md](../work/ada-0003.md) |
| ada-0004 | Remove the galaxy map close-button layout and align its header and danger panel | [ada-0004.md](../work/ada-0004.md) |
| ada-0023 | Keep the landscape play view in a turned portrait frame                         | [ada-0023.md](../work/ada-0023.md) |
| ada-0026 | Add analog throttle, weapon selection and the icon HUD                          | [ada-0026.md](../work/ada-0026.md) |
| ada-0028 | Add the browser-only cheats modal                                               | [ada-0028.md](../work/ada-0028.md) |
| ada-0031 | Add the Ada website and separate play entry                                     | [ada-0031.md](../work/ada-0031.md) |
| ada-0035 | Draw Chibi's on-screen joysticks with a deflection speed curve                  | [ada-0035.md](../work/ada-0035.md) |
| ada-0036 | Restyle cards and guard back navigation after Chibi                             | [ada-0036.md](../work/ada-0036.md) |
| ada-0040 | Size the DOM UI from the layout module                                          | [ada-0040.md](../work/ada-0040.md) |
| ada-0043 | Play Earth scenes as storybook pages                                            | [ada-0043.md](../work/ada-0043.md) |
| ada-0049 | Show status pills and item notices in the HUD                                   | [ada-0049.md](../work/ada-0049.md) |
| ada-0050 | Add the in-flight conversation box                                              | [ada-0050.md](../work/ada-0050.md) |
| ada-0053 | Replace the Travel list with the full-screen pause map                          | [ada-0053.md](../work/ada-0053.md) |
| ada-0057 | Place the touch sticks and Use disc inside the game area                        | [ada-0057.md](../work/ada-0057.md) |
| ada-0060 | Add achievements and the Achievements card                                      | [ada-0060.md](../work/ada-0060.md) |
| ada-0063 | Merge Shield recharge into Shield levels and show the recharge delay            | [ada-0063.md](../work/ada-0063.md) |
| ada-0064 | Open every launch on a Chibi-style start screen                                 | [ada-0064.md](../work/ada-0064.md) |
| ada-0066 | Show loading on a top-edge bar                                                  | [ada-0066.md](../work/ada-0066.md) |
| ada-0067 | Space and order buttons as in the other games                                   | [ada-0067.md](../work/ada-0067.md) |
| ada-0068 | Lay story pages out as Art's light spread                                       | [ada-0068.md](../work/ada-0068.md) |
| ada-0070 | Mark off-screen enemies, heavies and stations at the edge                       | [ada-0070.md](../work/ada-0070.md) |
| ada-0073 | Select galaxies on the galaxy map                                               | [ada-0073.md](../work/ada-0073.md) |
| ada-0074 | Present the Ship inventory in equal columns                                     | [ada-0074.md](../work/ada-0074.md) |
| ada-0083 | Greet each docking with the station keeper                                      | [ada-0083.md](../work/ada-0083.md) |
| ada-0084 | Apply approved copy reviews to the game's strings                               | [ada-0084.md](../work/ada-0084.md) |
| ada-0086 | Compose the HTML UI through game-kit's typed layout tree                        | [ada-0086.md](../work/ada-0086.md) |
| ada-0087 | Present Use conversations and station views as fullscreen cards                 | [ada-0087.md](../work/ada-0087.md) |
| ada-0089 | Show quest details on the Map and Quests card                                   | [ada-0089.md](../work/ada-0089.md) |
| ada-0091 | Bound local map fog rendering                                                   | [ada-0091.md](../work/ada-0091.md) |
| ada-0093 | Fit modals and Settings to shared width presets                                 | [ada-0093.md](../work/ada-0093.md) |
| ada-0095 | Add weapon, resource and shield detail cards                                    | [ada-0095.md](../work/ada-0095.md) |
| ada-0098 | Expose Pause throughout gameplay with Map permission                            | [ada-0098.md](../work/ada-0098.md) |
| ada-0105 | Lay out the map header and survey outline                                       | [ada-0105.md](../work/ada-0105.md) |
| ada-0106 | Lay out the game across the full viewport                                       | [ada-0106.md](../work/ada-0106.md) |
| ada-0107 | Add desktop mouse and keyboard flight controls                                  | [ada-0107.md](../work/ada-0107.md) |
| ada-0116 | Share completion indicators across achievements and objectives                  | [ada-0116.md](../work/ada-0116.md) |
| ada-0117 | Add the compact Menu                                                            | [ada-0117.md](../work/ada-0117.md) |
| ada-0122 | Replace click actions with the published hold dispatcher                        | [ada-0122.md](../work/ada-0122.md) |
| ada-0125 | Gate game entry on required resources with shared retry                         | [ada-0125.md](../work/ada-0125.md) |
| ada-0127 | Present scan receipts behind dialogue                                           | [ada-0127.md](../work/ada-0127.md) |
| ada-0128 | Place Close and Back footers by return context                                  | [ada-0128.md](../work/ada-0128.md) |
| ada-0132 | Keep covered parents and paint beneath the active modal                         | [ada-0132.md](../work/ada-0132.md) |
| ada-0277 | Read the galaxy map's destination and Earth panel strings from content          | [ada-0277.md](../work/ada-0277.md) |
| ada-0287 | Centre the Quests line disc in its 28 chip slot                                 | [ada-0287.md](../work/ada-0287.md) |
| ada-0309 | Fix scan receipt timing, order and placement                                    | [ada-0309.md](../work/ada-0309.md) |
| ada-0310 | Centre the bands and anchor the shield to the game area                         | [ada-0310.md](../work/ada-0310.md) |
| ada-0300 | Order Pause and Menu by label and show Exit only in a closable installed app    | [ada-0300.md](../work/ada-0300.md) |
| ada-0318 | Measure DOM boxes in the turned frame's own axes                                | [ada-0318.md](../work/ada-0318.md) |
| ada-0321 | Place scan receipts by Art's start and rise rules                               | [ada-0321.md](../work/ada-0321.md) |
| ada-0326 | Show the final ore cost tick when shield recharge stops                         | [ada-0326.md](../work/ada-0326.md) |
| ada-0333 | Inset Ada's touch sticks 80 pixels from the screen sides                        | [ada-0333.md](../work/ada-0333.md) |
| ada-0334 | Complete Map tap and hold routing and verify discrete action coverage           | [ada-0334.md](../work/ada-0334.md) |
| ada-0340 | Use game-styled keyboard focus indicators                                       | [ada-0340.md](../work/ada-0340.md) |
| ada-0341 | Share task categories across lists, maps, and edge markers                      | [ada-0341.md](../work/ada-0341.md) |
| ada-0342 | Render standard game buttons through Game Kit                                   | [ada-0342.md](../work/ada-0342.md) |
| ada-0343 | Move game UI icons to source-driven SVGs                                        | [ada-0343.md](../work/ada-0343.md) |
| ada-0346 | Remove Exit from the Start Menu                                                 | [ada-0346.md](../work/ada-0346.md) |
| ada-0335 | Match Exit chrome to Pause and Menu                                             | [ada-0335.md](../work/ada-0335.md) |
| ada-0336 | Fade notices after discovering points of interest                               | [ada-0336.md](../work/ada-0336.md) |
| ada-0338 | Verify Back, Close, and Resume navigation                                       | [ada-0338.md](../work/ada-0338.md) |
| ada-0350 | Use fill, text or icon cues for button states                                   | [ada-0350.md](../work/ada-0350.md) |
| ada-0352 | Standardize rectangular action button sizing                                    | [ada-0352.md](../work/ada-0352.md) |
