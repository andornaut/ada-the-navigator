# Runtime

The game model in `src/model/` holds game state, flight, combat, economy, stories and saves,
free of Phaser; `src/data/` holds the content and tuning contract Gameplay values feed. Galaxies
wrap as tori with periodic world queries; required encounters are planned before optional
generation, and geography persists per playthrough while encounters reset on fresh entry. The
Phaser scene in `src/game/` is split into modules with one job each and draws Art's assets from
per-galaxy manifests. Saves restore only the current version and reset rather than migrate
before version one.

Reference: [Architecture](../../src/README.md#architecture),
[Save data](../../src/README.md#save-data), [rules](../../gameplay/rules.md).

## Work items

| ID       | Title                                                                    | Link                                                                           |
| -------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| ada-0019 | Build the minimal playable prototype                                     | [ada-0019.md](../work/ada-0019.md)                                             |
| ada-0021 | Integrate enemy combat and guarded routes                                | [ada-0021.md](../work/ada-0021.md)                                             |
| ada-0025 | Persist dormant flight state in bounded chunk pages                      | [ada-0025.md](../work/ada-0025.md)                                             |
| ada-0027 | Draw the approved palette and Art's flight objects                       | [ada-0027.md](../work/ada-0027.md)                                             |
| ada-0029 | Generate bounded chunk templates and retain notable world state          | [ada-0029.md](../work/ada-0029.md)                                             |
| ada-0030 | Fire data-driven weapon volleys with projected fan angles                | [ada-0030.md](../work/ada-0030.md)                                             |
| ada-0032 | Draw Ada's ship from authored heading views and speed jets               | [ada-0032.md](../work/ada-0032.md)                                             |
| ada-0033 | Damp movement and aim direction changes                                  | [ada-0033.md](../work/ada-0033.md)                                             |
| ada-0037 | Apply per-ship physics and rotating enemy hulls                          | [ada-0037.md](../work/ada-0037.md)                                             |
| ada-0038 | Add Stardust, stations, the shop and the quantum jump home               | [ada-0038.md](../work/ada-0038.md)                                             |
| ada-0039 | Gate galaxies on holodisks and key lines to holodisks held               | [ada-0039.md](../work/ada-0039.md)                                             |
| ada-0041 | Bounce ships off scenery and vary asteroids                              | [ada-0041.md](../work/ada-0041.md)                                             |
| ada-0045 | Drive enemies with the no-kiting behaviour library                       | [ada-0045.md](../work/ada-0045.md)                                             |
| ada-0047 | Give weapons and the shield three levels and add the Phaser              | [ada-0047.md](../work/ada-0047.md)                                             |
| ada-0048 | Draw Art's storybook, aboard pages and quantum jump                      | [ada-0048.md](../work/ada-0048.md)                                             |
| ada-0052 | Cost the jump home only the flight with an overnight recharge            | [ada-0052.md](../work/ada-0052.md)                                             |
| ada-0054 | Draw Sunflower's light field and layered parallax backdrops              | [ada-0054.md](../work/ada-0054.md)                                             |
| ada-0055 | Build the Cartwheel and Whirlpool galaxies                               | [ada-0055.md](../work/ada-0055.md)                                             |
| ada-0056 | Fund community projects from station Projects tabs                       | [ada-0056.md](../work/ada-0056.md)                                             |
| ada-0058 | Give each upgrade weapon its own ammunition                              | [ada-0058.md](../work/ada-0058.md)                                             |
| ada-0059 | Add station job boards and survey landmarks                              | [ada-0059.md](../work/ada-0059.md)                                             |
| ada-0061 | Rasterise SVGs at device size and render at device pixels                | [ada-0061.md](../work/ada-0061.md)                                             |
| ada-0062 | Load art manifests per galaxy                                            | [ada-0062.md](../work/ada-0062.md)                                             |
| ada-0065 | Add the repeatable activities                                            | [ada-0065.md](../work/ada-0065.md)                                             |
| ada-0069 | Collide, hit and collect where objects are drawn                         | [ada-0069.md](../work/ada-0069.md)                                             |
| ada-0072 | Fly the six-galaxy route with placeholder galaxies                       | [ada-0072.md](../work/ada-0072.md)                                             |
| ada-0076 | Load saves from disk and restore only the current version                | [ada-0076.md](../work/ada-0076.md)                                             |
| ada-0077 | Rework enemy difficulty, salvage and speeds                              | [ada-0077.md](../work/ada-0077.md)                                             |
| ada-0078 | Dock at stations with Use within Talk range                              | [ada-0078.md](../work/ada-0078.md)                                             |
| ada-0079 | Rebalance weapon speeds, reach, prices and ammunition                    | [ada-0079.md](../work/ada-0079.md)                                             |
| ada-0080 | Retune prices, incomes, job pay and paint                                | [ada-0080.md](../work/ada-0080.md)                                             |
| ada-0081 | Drop single-step upgrade pickups and show upgrade levels                 | [ada-0081.md](../work/ada-0081.md)                                             |
| ada-0082 | Refuse travel while carrying and keep what each event keeps              | [ada-0082.md](../work/ada-0082.md)                                             |
| ada-0085 | Rename the code to version-one names and split the game scene            | [ada-0085.md](../work/ada-0085.md)                                             |
| ada-0088 | Derive tuned values from one source of truth                             | [ada-0088.md](../work/ada-0088.md)                                             |
| ada-0090 | Stage galaxy encounters and budget new engagements                       | [ada-0090.md](../work/ada-0090.md)                                             |
| ada-0092 | Keep bedroom framing and lighting through story transitions              | [ada-0092.md](../work/ada-0092.md)                                             |
| ada-0094 | Guarantee asteroid ore and bound combined loot                           | [ada-0094.md](../work/ada-0094.md)                                             |
| ada-0096 | Warn before the emergency return jump                                    | [ada-0096.md](../work/ada-0096.md)                                             |
| ada-0097 | Integrate Art's player ship jets and heading package                     | [ada-0097.md](../work/ada-0097.md)                                             |
| ada-0099 | Add station Exchange previews and confirmed ore trades                   | [ada-0099.md](../work/ada-0099.md)                                             |
| ada-0100 | Mount the Phantom chapter                                                | [ada-0100.md](../work/ada-0100.md)                                             |
| ada-0101 | Mount the Andromeda chapter                                              | [ada-0101.md](../work/ada-0101.md)                                             |
| ada-0102 | Mount the Needle chapter                                                 | [ada-0102.md](../work/ada-0102.md)                                             |
| ada-0103 | Adopt canonical save storage with crash fencing                          | [ada-0103.md](../work/ada-0103.md)                                             |
| ada-0104 | Wrap each galaxy as a torus with periodic world queries                  | [ada-0104.md](../work/ada-0104.md)                                             |
| ada-0108 | Resume held story pages and choices through title and reload             | [ada-0108.md](../work/ada-0108.md)                                             |
| ada-0109 | Give stations services, identities and doubled density                   | [ada-0109.md](../work/ada-0109.md)                                             |
| ada-0110 | Track Penny hints with identified markers                                | [ada-0110.md](../work/ada-0110.md)                                             |
| ada-0111 | Expand landmarks and require an explicit Scan                            | [ada-0111.md](../work/ada-0111.md)                                             |
| ada-0112 | Bound collision, navigation and simulation cost                          | [ada-0112.md](../work/ada-0112.md)                                             |
| ada-0113 | Use geographic encounter regions with approved enemy bodies and loadouts | [ada-0113.md](../work/ada-0113.md)                                             |
| ada-0114 | Inherit launch velocity and resolve impacts at contact edges             | [ada-0114.md](../work/ada-0114.md)                                             |
| ada-0115 | Plan, persist and map hostile stations                                   | [ada-0115.md](../work/ada-0115.md)                                             |
| ada-0119 | Equip enemies with weapon levels                                         | [ada-0119.md](../work/ada-0119.md)                                             |
| ada-0120 | Persist per-playthrough geography                                        | [ada-0120.md](../work/ada-0120.md)                                             |
| ada-0121 | Navigate enemies by hull clearance                                       | [ada-0121.md](../work/ada-0121.md)                                             |
| ada-0123 | Unify target markers through one registry                                | [ada-0123.md](../work/ada-0123.md)                                             |
| ada-0124 | Plan required encounters before optional world generation                | [ada-0124.md](../work/ada-0124.md)                                             |
| ada-0129 | Reset invalid pre-v1 saves                                               | [ada-0129.md](../work/ada-0129.md)                                             |
| ada-0130 | Stock stations stably and exchange fixed quantities immediately          | [ada-0130.md](../work/ada-0130.md)                                             |
| ada-0322 | Stop each resize from leaking WebGL textures and canvases                | [ada-0322.md](../work/ada-0322.md)                                             |
| ada-0323 | Re-rasterise only the SVGs in use on resize                              | [ada-0323.md](../work/ada-0323.md)                                             |
| TBD      | Investigate the story-page main-thread load                              | [pending-story-page-load.md](../work/pending-story-page-load.md)               |
| TBD      | Skip the flight scene's drawing and rendering behind storybook pages     | [pending-story-page-render-skip.md](../work/pending-story-page-render-skip.md) |
| TBD      | Stop rebuilding the restart card every frame                             | [pending-restart-card-per-frame.md](../work/pending-restart-card-per-frame.md) |
