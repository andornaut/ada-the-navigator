# Economy

Stardust is the game's one currency. It is shimmering dust released by destroyed
ships and asteroids, and every station trades in it. Stardust and purchases persist
across flights with story progress. All amounts, prices and rates are provisional
tuning.

## Earning Stardust

Destroyed enemy ships and asteroids release Stardust as small glinting pickups.
Ada's ship has a tractor beam, with no visual of its own, that draws Stardust
within its pull radius toward her at its pull speed; Stardust collects on contact
within the existing pickup reach. The beam pulls only Stardust. Base pull radius
is 100 world units and base pull speed is 150 world units per second. Enemy ships are
destroyed, not teleported: a defeated ship breaks apart in a short effect and drops
its Stardust. A multipart ship is defeated when all its required parts are disabled.

| Source             | Stardust |
| ------------------ | -------: |
| Asteroid           |      1–3 |
| `swarm`            |        2 |
| `fighter`          |        5 |
| `interceptor`      |        6 |
| `retaliator`       |       15 |
| `frigate`          |       40 |
| `capital`          |      150 |
| `oversizedCapital` |      400 |

Weapons are sold at stations and are also rare drops: 2% of destroyed small ships,
10% of frigates and 25% of capitals drop a random upgrade weapon. A dropped weapon
Ada already owns becomes 25 Stardust instead. Story mining deposits keep their
existing cargo role and do not drop Stardust.

## Stations

Stations are rare points of interest, each with a shop. They are placed by the
sector's seed, so a sector's stations stay in the same places on every flight, at
least 8000 world units apart and away from story destinations. A discovered
station becomes a travel destination like other destinations. A station is a safe
area. Flying into its dock opens the station card, which pauses action like a
conversation. The card shows the Stardust balance, a welcome line, Undock and Shop.
Like Archie's modals it has a close X; the X, an outside tap, back and Escape all
undock. Station quests are part of the station concept; their content is
not yet designed, so the station card shows no quest board until it is.

## Shop

| Item            | Effect                                                                       | Prices        |
| --------------- | ---------------------------------------------------------------------------- | ------------- |
| Missiles        | Owned upgrade weapon                                                         | 150           |
| Triple Laser    | Owned upgrade weapon                                                         | 250           |
| Scattershot     | Owned upgrade weapon                                                         | 350           |
| Weapon upgrade  | Per weapon, Basic included, three levels: each +10% damage, −10% interval    | 100, 200, 400 |
| Shield          | Three levels: each +20% shield capacity                                      | 100, 200, 400 |
| Shield recharge | Three levels: each −15% recharge delay, +20% recharge rate                   | 100, 200, 400 |
| Engine tuning   | Three levels: each +5% top speed, −10% acceleration and braking seconds      | 120, 240, 480 |
| Tractor beam    | Two levels: pull radius 150, then 200; pull speed 220, then 300              | 80, 160       |
| Ship paint      | Cosmetic colour schemes for Ada's ship; the white and blue scheme stays free | 50 each       |

Enemy speed ratios stay relative to Ada's base speed, so engine tuning lets Ada
outrun the fastest enemies. The shop follows Archie's Pet shop pattern: tabs, owned
items marked Owned, and a purchase confirm with Buy and Cancel. An item Ada cannot
afford stays visible with a flat disabled face and refuses with Archie's shared
refusal feedback; reduced motion shows the red tint without shaking. A levelled
row shows Ada's current level ("Level 0 of 3" before the first purchase) and the
price of the next level; a maxed row shows Owned. The buy confirm shows a weapon's
one-line description.

Ship paint schemes are Classic (the free white and blue default), Cobalt,
Seafoam, Graphite and Iris. Tapping an owned scheme puts it in use at once, with
no confirm; the scheme in use has the selection ring and shows In use instead of
Owned.

## Weapons in combat

Weapons cannot be changed during combat or for 5 seconds after it ends; the lock
and its icon treatment last through those 5 seconds. Combat is
the existing danger state that also blocks travel. While weapon changes are
locked, the other weapon icons are visibly disabled and refuse with the shared
refusal feedback. The selected weapon's icon has a treatment like Chibi's
power-ups.

## Quantum warp home

When the shield is depleted, Ada's ship uses its quantum warp to escape to Toronto
so it can recharge. The flight ends and story progress is saved. The warp
permanently loses the equipped weapon and its upgrade levels unless it is Basic,
so a weapon bought or found again starts at level 0. Recharging costs a flat 10
Stardust, never taking Stardust below zero.

## Player strings

The shield shop row reuses the existing `shield` label. `warpHome` replaces
`shieldDepleted`.

| Key                | Text                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `stardust`         | Stardust                                                             |
| `stardustAmount`   | {amount} Stardust                                                    |
| `station`          | Station                                                              |
| `shop`             | Shop                                                                 |
| `shopWeapons`      | Weapons                                                              |
| `shopShip`         | Ship                                                                 |
| `owned`            | Owned                                                                |
| `level`            | Level {level} of {max}                                               |
| `confirmTitle`     | Buy {name}?                                                          |
| `confirmLeft`      | {amount} left after                                                  |
| `confirmBuy`       | Buy                                                                  |
| `confirmCancel`    | Cancel                                                               |
| `undock`           | Undock                                                               |
| `stationWelcome`   | Welcome aboard. Trade your Stardust for weapons and ship upgrades.   |
| `inUse`            | In use                                                               |
| `paintClassic`     | Classic                                                              |
| `paintCobalt`      | Cobalt                                                               |
| `paintSeafoam`     | Seafoam                                                              |
| `paintGraphite`    | Graphite                                                             |
| `paintIris`        | Iris                                                                 |
| `aboutMissiles`    | One slow, strong missile.                                            |
| `aboutTripleLaser` | Three bolts in a fan.                                                |
| `aboutScattershot` | Seven short-range shots in a wide spread.                            |
| `weaponLocked`     | Weapons can't be changed in combat.                                  |
| `warpHome`         | Your ship warped you home to recharge. Your story progress is saved. |
| `warpWeaponLost`   | Your {weapon} was lost.                                              |
| `warpRecharge`     | Recharging cost {amount} Stardust.                                   |
| `shieldRecharge`   | Shield recharge                                                      |
| `engineTuning`     | Engine tuning                                                        |
| `tractorBeam`      | Tractor beam                                                         |
| `weaponUpgrade`    | {weapon} upgrade                                                     |
| `shipPaint`        | Ship paint                                                           |
