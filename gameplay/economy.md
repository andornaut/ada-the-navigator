# Economy

Stardust is the game's one currency. It is shimmering dust released by destroyed
ships and asteroids, and every station trades in it. Stardust and purchases persist
across flights with story progress. All amounts, prices and rates are provisional
tuning toward these pacing targets: affording the first weapon (150) takes about
20 minutes of play, saving 300 for Cartwheel's holodisk takes about 40 minutes,
and exploring finds a station every few minutes.

## Earning Stardust

Destroyed enemy ships and asteroids release Stardust as small glinting pickups.
Ada's ship has a tractor beam, with no visual of its own, that draws Stardust
within its pull radius toward her at its pull speed; Stardust collects on contact
within the existing pickup reach. The beam pulls only Stardust. Base pull radius
is 100 world units and base pull speed is 150 world units per second. Enemy ships are
destroyed, not teleported: a defeated ship breaks apart in a short effect and drops
its Stardust. A multipart ship is defeated when all its required parts are disabled.

| Source          | Stardust |
| --------------- | -------: |
| Asteroid        |      0–1 |
| Discovery cache |        5 |
| `swarm`         |        1 |
| `fighter`       |        2 |
| `interceptor`   |        1 |
| `retaliator`    |        4 |
| `frigate`       |        5 |
| `capital`       |        9 |

An enemy's Stardust is half its hit points, rounded down, and at least 1.
Discovery caches are rare. These values come from a pacing simulation of typical
play against the targets above; rerun it after changing any earning value.

A drop splits its Stardust into whole-Stardust pickups, as evenly as possible with
the larger pieces first, so one pickup can carry more than 1 Stardust. The number
of pickups is the drop's value, capped at 8 for small craft, 16 for frigates and
24 for capital ships: swarm 2, fighter 5, interceptor 6, retaliator 8, frigate 16,
capital 24, and one per Stardust for asteroids. With the values above, every
drop is below its cap, so each pickup carries 1 Stardust.

Weapons are sold at stations and are also rare drops: 0.5% of destroyed small
ships, 5% of frigates and 10% of capitals drop a random upgrade weapon. A dropped weapon
Ada already owns becomes 25 Stardust instead. Story mining deposits keep their
existing cargo role and do not drop Stardust.

## Stations

Stations are rare points of interest, each with a shop. They are placed by the
galaxy's seed, so a galaxy's stations stay in the same places on every flight, at
least 8000 world units apart and away from story destinations. A discovered
station becomes a travel destination like other destinations. An undiscovered station
within 1500 world units of Ada is marked by the direction indicator, so stations
stay rare but findable. A station is a safe
area. The dock is the station sprite's visible entrance. Ada docks when her
hull circle overlaps the mouth circle: half the drawn mouth width in world units,
scaled by a forgiving `dockForgiveness` of 3.
Undocking places Ada at rest just outside the dock, so flying back in docks again. Flying into its dock opens the station card, which pauses action like a
conversation. The card shows the Stardust balance, a welcome line, Undock and Shop.
Like Archie's modals it has a close X; the X, an outside tap, back and Escape all
undock. Station quests are part of the station concept; their content is
not yet designed, so the station card shows no quest board until it is.

## Shop

| Item            | Effect                                                                       | Prices   |
| --------------- | ---------------------------------------------------------------------------- | -------- |
| Rapid Missile   | Owned weapon                                                                 | 150      |
| Multi-Laser     | Owned weapon                                                                 | 250      |
| Heavy Missile   | Owned weapon                                                                 | 300      |
| Scattershot     | Owned weapon                                                                 | 350      |
| Phaser          | Owned weapon                                                                 | 400      |
| Weapon upgrade  | Per weapon, Basic included: levels 2 and 3, each about ×1.5 effective output | 150, 300 |
| Shield          | Levels 2 and 3: capacity 150, then 225                                       | 150, 300 |
| Shield recharge | Levels 2 and 3: each about ×1.5 recharge (shorter delay, faster rate)        | 150, 300 |
| Engine tuning   | Levels 2 and 3: each +5% top speed, −10% acceleration and braking seconds    | 120, 240 |
| Tractor beam    | Levels 2 and 3: pull radius 150, then 200; pull speed 220, then 300          | 80, 160  |
| Ship paint      | Cosmetic colour schemes for Ada's ship; the white and blue scheme stays free | 50 each  |

Enemy speed ratios stay relative to Ada's base speed, so engine tuning lets Ada
outrun the fastest enemies. The shop follows Archie's Pet shop pattern: tabs, owned
items marked Owned, and a purchase confirm with Buy and Cancel. The shop's close X, an
outside tap, back and Escape return to the station card. An item Ada cannot
afford stays visible with a flat disabled face, stays focusable and tappable,
and refuses with Archie's shared
refusal feedback; reduced motion shows the red tint without shaking. A levelled
row shows Ada's current level ("Level 1 of 3" before the first upgrade) and the
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

## Quantum jump home

When the shield is depleted, Astra quantum jumps the ship home to Earth so it can
recharge. The flight ends and story progress is saved. The jump
permanently loses the equipped weapon and its upgrade levels unless it is Basic,
so a weapon bought or found again starts at level 0. Recharging costs a flat 10
Stardust, never taking Stardust below zero.

## Player strings

The shield shop row reuses the existing `shield` label. `jumpHome` replaces
`shieldDepleted`.

| Key                 | Text                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `stardust`          | Stardust                                                           |
| `stardustAmount`    | {amount} Stardust                                                  |
| `station`           | Station                                                            |
| `shop`              | Shop                                                               |
| `shopWeapons`       | Weapons                                                            |
| `shopShip`          | Ship                                                               |
| `owned`             | Owned                                                              |
| `level`             | Level {level} of {max}                                             |
| `confirmTitle`      | Buy {name}?                                                        |
| `confirmLeft`       | {amount} left after                                                |
| `confirmBuy`        | Buy                                                                |
| `confirmCancel`     | Cancel                                                             |
| `undock`            | Undock                                                             |
| `stationWelcome`    | Welcome aboard. Trade your Stardust for weapons and ship upgrades. |
| `inUse`             | In use                                                             |
| `paintClassic`      | Classic                                                            |
| `paintCobalt`       | Cobalt                                                             |
| `paintSeafoam`      | Seafoam                                                            |
| `paintGraphite`     | Graphite                                                           |
| `paintIris`         | Iris                                                               |
| `aboutHeavyMissile` | One slow missile with a big blast.                                 |
| `aboutRapidMissile` | Quick missiles with a small blast.                                 |
| `aboutMultiLaser`   | A fan of laser bolts that grows with each level.                   |
| `aboutScattershot`  | A shotgun spread, strongest up close.                              |
| `aboutPhaser`       | An instant beam that hits everything in its path.                  |
| `weaponLocked`      | Weapons can't be changed in combat.                                |
| `jumpHome`          | Astra jumped you home to recharge. Your story progress is saved.   |
| `jumpWeaponLost`    | Your {weapon} was lost.                                            |
| `jumpRecharge`      | Recharging cost {amount} Stardust.                                 |
| `shieldRecharge`    | Shield recharge                                                    |
| `engineTuning`      | Engine tuning                                                      |
| `tractorBeam`       | Tractor beam                                                       |
| `weaponUpgrade`     | {weapon} upgrade                                                   |
| `shipPaint`         | Ship paint                                                         |
