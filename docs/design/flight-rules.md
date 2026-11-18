# Flight rules

Version one runs six galaxies in route order, each paired with a home lesson on Earth told as a
storybook. Ada flies with drifting movement and a damped aim stick, docks and uses objects through
one contextual Use action, and fights with a weapon roster, ammunition and an ore-fuelled shield.
Maps, markers and Penny's sensing point her at targets; currents, asteroid fields and fixed galaxy
geography shape each flight. The Pause, Menu and map screens share Back and Close rules, and flights
persist across launches. Difficulty, rewards and prices follow route position, and numeric values
are provisional tuning.

Reference: [rules](../../gameplay/rules.md), [unified target markers](../../gameplay/marker-design.md), [scan feedback](../../gameplay/scan-feedback.md).

## Work items

| ID       | Title                                                                                                      | Link                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| ada-0015 | Specify tap-to-dismiss chatter, hit feedback, stick placement and map leaving                              | [ada-0015.md](../work/ada-0015.md)                                                                     |
| TBD      | Record the initial design and the prototype stories                                                        | [pending-record-initial-design.md](../work/pending-record-initial-design.md)                           |
| TBD      | Specify flight persistence and fresh exploration history                                                   | [pending-specify-flight-persistence.md](../work/pending-specify-flight-persistence.md)                 |
| TBD      | Define movement drift, aim damping and stick deflection                                                    | [pending-define-movement-and-aim.md](../work/pending-define-movement-and-aim.md)                       |
| TBD      | Scale Ada's top speed and turn rate by engine level                                                        | [pending-scale-speed-by-engine-level.md](../work/pending-scale-speed-by-engine-level.md)               |
| TBD      | Define the on-screen controls and Settings rows                                                            | [pending-define-touch-controls-and-settings.md](../work/pending-define-touch-controls-and-settings.md) |
| TBD      | Place the touch sticks and set move reach                                                                  | [pending-place-touch-sticks.md](../work/pending-place-touch-sticks.md)                                 |
| TBD      | Define back navigation and the pause card                                                                  | [pending-define-back-navigation.md](../work/pending-define-back-navigation.md)                         |
| TBD      | Align the shared Pause and Menu actions                                                                    | [pending-align-pause-actions.md](../work/pending-align-pause-actions.md)                               |
| TBD      | Define Start, Continue, Restart and the title flow                                                         | [pending-define-start-continue-restart.md](../work/pending-define-start-continue-restart.md)           |
| TBD      | Define the galaxy route map and launch selection                                                           | [pending-define-galaxy-route-map.md](../work/pending-define-galaxy-route-map.md)                       |
| TBD      | Add the local Map, its tools and the Quests modal                                                          | [pending-define-pause-map.md](../work/pending-define-pause-map.md)                                     |
| TBD      | Dock and talk with Use within Talk range                                                                   | [pending-define-docking-and-use.md](../work/pending-define-docking-and-use.md)                         |
| TBD      | Define the status pill, item notices and shield bar                                                        | [pending-define-hud-status-pill.md](../work/pending-define-hud-status-pill.md)                         |
| TBD      | Mark off-screen targets at the game area's edge                                                            | [pending-define-direction-and-edge-markers.md](../work/pending-define-direction-and-edge-markers.md)   |
| TBD      | Unify target markers and Penny sensing                                                                     | [pending-unify-target-markers.md](../work/pending-unify-target-markers.md)                             |
| TBD      | Collide, hit and place every flight object where it is drawn                                               | [pending-draw-objects-where-drawn.md](../work/pending-draw-objects-where-drawn.md)                     |
| TBD      | Define space currents and the whales' current                                                              | [pending-define-currents.md](../work/pending-define-currents.md)                                       |
| TBD      | Keep asteroids stationary and define ore field patterns                                                    | [pending-define-asteroid-fields.md](../work/pending-define-asteroid-fields.md)                         |
| TBD      | Show yellow reverse thrust forward of the wingtips                                                         | [pending-add-reverse-thrust.md](../work/pending-add-reverse-thrust.md)                                 |
| TBD      | Keep galaxy geography and reset enemies on fresh entry                                                     | [pending-keep-galaxy-geography.md](../work/pending-keep-galaxy-geography.md)                           |
| TBD      | Rename the prototype docs to the version one rules                                                         | [pending-consolidate-version-one-rules.md](../work/pending-consolidate-version-one-rules.md)           |
| TBD      | Define the weapon roster and shield depletion                                                              | [pending-define-weapon-roster.md](../work/pending-define-weapon-roster.md)                             |
| TBD      | Give weapons and shield three levels and add the Phaser                                                    | [pending-add-weapon-levels-and-phaser.md](../work/pending-add-weapon-levels-and-phaser.md)             |
| TBD      | Tune weapon speed, reach, damage and cadence                                                               | [pending-tune-weapon-ladder.md](../work/pending-tune-weapon-ladder.md)                                 |
| TBD      | Apply the approved weapon tuning and contact-edge impacts                                                  | [pending-apply-weapon-tuning.md](../work/pending-apply-weapon-tuning.md)                               |
| TBD      | Recharge the shield 30 s after the last damage                                                             | [pending-define-shield-recharge.md](../work/pending-define-shield-recharge.md)                         |
| TBD      | Collect pickups within 20 and set the tractor beam                                                         | [pending-define-pickups-and-tractor.md](../work/pending-define-pickups-and-tractor.md)                 |
| TBD      | Define the jump home, overnight recharge and ore on failure                                                | [pending-define-jump-home.md](../work/pending-define-jump-home.md)                                     |
| TBD      | List cargo and equipment on the Ship card                                                                  | [pending-define-ship-card.md](../work/pending-define-ship-card.md)                                     |
| TBD      | Offer updates on start-screen arrival and stage complete builds                                            | [pending-define-updates.md](../work/pending-define-updates.md)                                         |
| TBD      | Specify the Use conversation view, full-screen cards, ore-fuelled recharge feedback and in-view enemy fire | [pending-specify-use-conversation-view.md](../work/pending-specify-use-conversation-view.md)           |
| TBD      | Align Penny sensing and undiscovered station markers with the 5000 marker range                            | [pending-align-marker-and-sensing-ranges.md](../work/pending-align-marker-and-sensing-ranges.md)       |
| TBD      | Reset incompatible saves before version 1                                                                  | [pending-reset-saves-before-version-one.md](../work/pending-reset-saves-before-version-one.md)         |
| TBD      | Use Back to title above Close in Menus, and Back or Close by parent in quest lists                         | [pending-use-back-and-close-in-menus.md](../work/pending-use-back-and-close-in-menus.md)               |
| TBD      | Move the scan notice continuously upward behind dialogue                                                   | [pending-move-scan-notice-upward.md](../work/pending-move-scan-notice-upward.md)                       |
| TBD      | Describe the Earth marker panel and its single destination action                                          | [pending-describe-earth-map-panel.md](../work/pending-describe-earth-map-panel.md)                     |
| TBD      | Adopt the shared modal widths and the 500 ms detail-card hold                                              | [pending-adopt-shared-modal-widths-and-hold.md](../work/pending-adopt-shared-modal-widths-and-hold.md) |
