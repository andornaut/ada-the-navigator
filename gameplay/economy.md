# Economy

Stardust is the game's one currency. It is shimmering dust released by destroyed
ships and asteroids, and every station trades in it. Stardust and purchases persist
across flights with story progress. All amounts, prices and rates are provisional
tuning toward one typical income per route position, Stardust per minute
without jobs as the pacing simulation measures it:

| Position | Galaxy    |      Typical income |
| -------: | --------- | ------------------: |
|        1 | Sunflower |             about 8 |
|        2 | Whirlpool |            about 10 |
|        3 | Needle    |             about 9 |
|        4 | Andromeda | measured once built |
|        5 | Cartwheel |            about 15 |
|        6 | Phantom   | measured once built |

Every pacing target is a price divided by that income: the first weapon (400)
takes about 50 minutes of Sunflower play, saving 500 for Cartwheel's holodisk
about 30 minutes of Cartwheel play, and a galaxy's projects the time their total
takes at its income after its story ends. Exploring finds a station every few
minutes.

## Earning Stardust

Destroyed enemy ships and asteroids release Stardust as small glinting pickups.
Ada's ship has a tractor beam, with no visual of its own, that draws every
pickup (Stardust, ore nuggets, discovery caches, weapons, ammo packs, a floating holodisk and
a hunt job's lost item) within its pull radius toward her at its pull speed,
all kinds alike. A pickup collects within 20 world units of Ada's drawn ship, the
one pickup rule (see [Rules](rules.md)). Base pull radius is 60 world units and
base pull speed is 120 world units per second; levels 2 and 3 raise them to 90
and 160, then 120 and 200. Enemy ships are
destroyed, not teleported: a defeated ship breaks apart in a short effect and drops
its Stardust. A heavy is destroyed when its hull HP reaches 0. Destroying or salvaging a heavy
is a trade-off: destroying it drops twice its Stardust and no upgrade, and
salvaging it drops its Stardust and has the heavy upgrade chance (see
[Ships](ships.md#heavy-hull-and-disabling)).

| Source           | Stardust |
| ---------------- | -------: |
| Asteroid, small  |      0–1 |
| Asteroid, medium |        1 |
| Asteroid, large  |        2 |
| Asteroid, huge   |        3 |
| Discovery cache  |        5 |
| `swarm`          |        1 |
| `fighter`        |        2 |
| `interceptor`    |        1 |
| `retaliator`     |        4 |
| `frigate`        |  12 or 6 |
| `capital`        | 28 or 14 |
| `platform`       |   8 or 4 |

An enemy's Stardust is half its hit points, rounded down, and at least 1; a
heavy counts all its hardpoints' hit points, not its hull, and a destroyed heavy
drops twice that; a heavy's row shows destroyed, then salvaged. The table shows
position 1; values follow each position's hit points.
Discovery caches are rare. These values come from a pacing simulation of typical
play against the targets above; rerun it after changing any earning value.

A drop splits its Stardust into whole-Stardust pickups, as evenly as possible with
the larger pieces first, so one pickup can carry more than 1 Stardust. The number
of pickups is the drop's value, capped at 8 for small craft, 16 for frigates and
24 for capital ships, and one per Stardust for asteroids. A drop above its cap, such as a
destroyed capital's, splits into pickups worth more than 1 Stardust.

Upgrades are sold at stations and are also rare drops, at the same rates in every
galaxy: 0.25% of destroyed small ships and 10% of salvaged frigates, platforms and
capitals drop an upgrade pickup. A destroyed heavy drops none. An upgrade drop
gives one level, as buying the next level does, and only something Ada can still
use. The game picks a category, then an item within it. Weapons, Shield, Engine
tuning and Tractor beam have equal weight, and Paint 1/20 of that weight:

- Weapons: one weapon's next step, the weapon itself with three packs of its
  ammunition if Ada does not own it, otherwise its next level. Each weapon is
  half as likely as the one before it: Laser 64, Multi-Laser 32, Rapid Missile
  16, Heavy Missile 8, Scattershot 4 and Phaser 2. Only the weapons unlocked in
  the galaxy Ada is in take part (see [Weapon unlocks](#weapon-unlocks)).
- Shield: its next level.
- Engine tuning: its next level.
- Tractor beam: its next level.
- Paint: a paint scheme Ada does not own, owned but not put in use.

A category or weapon with nothing left to give leaves the pool, and the rest keep
their relative weights. Once nothing is left, the drop gives one pack of
ammunition for an owned weapon other than Laser that is unlocked in this galaxy,
chosen by the ammo pack weights below, or nothing when there is none. The pickup is one shared upgrade pickup,
and its contents are chosen when Ada collects it, so they fit her upgrades at that
moment. Its notice names what it gave:

| Gift          | Notice                   |
| ------------- | ------------------------ |
| New weapon    | + {weapon}               |
| Weapon level  | + {weapon} level {n}     |
| Shield        | + Shield level {n}       |
| Engine tuning | + Engine level {n}       |
| Tractor beam  | + Tractor beam level {n} |
| Paint scheme  | + {paint} paint          |
| Ammunition    | + {weapon} ammo          |

Destroyed small craft also drop an ammo pack 7.5% of the time, separately from
upgrades, while Ada owns a weapon other than Laser that is unlocked in this
galaxy. Like the upgrade pickup, its contents are chosen when Ada collects it:
one pack for such a weapon, each weapon about three quarters as likely as the one before it in
weapon order (Multi-Laser 16, Rapid Missile 12, Heavy Missile 9, Scattershot 7, Phaser 5, among
those weapons). Its notice is "+ {weapon} ammo".

Story mining deposits keep their
existing cargo role and do not drop Stardust.

Station jobs also pay Stardust; see [Quests](quests.md#rewards).

## Stations

Stations are rare points of interest, each with a shop. They are placed by the
galaxy's seed, so a galaxy's stations stay in the same places on every flight, at
least 8000 world units apart and away from story destinations. A discovered
station becomes a travel destination like other destinations. An undiscovered station
within 2000 world units of Ada is marked by the direction indicator, so stations
stay rare but findable. A station is a safe
area. Ada docks with Use (Dock) within Talk range, 160 world units from the
station's centre, like any other destination; the station has no dock mouth and
flying over it does nothing. Undocking leaves Ada at rest where she docked, so
Use offers Dock again at once. Docking opens the station card, which pauses play like other cards. The card shows the Stardust balance, a welcome line (the keeper's greeting; see [Species and greeters](rules.md#species-and-greeters)), Undock, Shop and Jobs; Jobs
opens the station's job board (see [Quests](quests.md)).
Like Archie's modals it has a close X; the X, an outside tap, back and Escape all
undock.

## Shop

### Weapon unlocks

Weapons unlock along the route, one per galaxy. The galaxy Ada is in sets what
its shops sell and what its drops give: the weapons unlocked there, their
levels and their ammunition. Laser and its levels are available everywhere. Back
in an earlier galaxy, only that galaxy's weapons, levels and ammunition drop or
are sold; a later weapon Ada owns keeps the ammunition she carries, with no more
until she returns to a galaxy that unlocks it.

| Position | Galaxy    | Unlocks       |
| -------: | --------- | ------------- |
|        1 | Sunflower | Multi-Laser   |
|        2 | Whirlpool | Rapid Missile |
|        3 | Needle    | Heavy Missile |
|        4 | Andromeda | Scattershot   |
|        5 | Cartwheel | Phaser        |
|        6 | Phantom   | Nothing new   |

### Prices

| Item           | Effect                                                                                                                                              | Prices    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Multi-Laser    | Owned weapon                                                                                                                                        | 400       |
| Rapid Missile  | Owned weapon                                                                                                                                        | 500       |
| Heavy Missile  | Owned weapon                                                                                                                                        | 600       |
| Scattershot    | Owned weapon                                                                                                                                        | 800       |
| Phaser         | Owned weapon                                                                                                                                        | 1000      |
| Weapon upgrade | Per weapon, Laser included: levels 2 and 3, each about ×1.5 effective output (×1.2 to 1.33 for Rapid Missile and Multi-Laser)                       | See below |
| Shield         | Levels 2 and 3: capacity 15, then 20; empty to full 45, then 30 s                                                                                   | 450, 900  |
| Engine tuning  | Levels 2 and 3: top speed 200, then 225; each −10% acceleration and braking seconds; aim turn 0.07, then 0.06 s and movement turn 0.14, then 0.12 s | 180, 360  |
| Tractor beam   | Levels 2 and 3: pull radius 90, then 120; pull speed 160, then 200                                                                                  | 120, 240  |
| Ship paint     | Cosmetic colour schemes for Ada's ship; the white and blue scheme stays free                                                                        | 75 each   |

Weapon upgrades cost 25% more for each later weapon in weapon order, compounded
from Laser's and rounded up to the next 100. Each weapon's purchase price
matches its level 2 upgrade:

| Weapon        | Level 2 | Level 3 |
| ------------- | ------: | ------: |
| Laser         |     300 |     600 |
| Multi-Laser   |     400 |     800 |
| Rapid Missile |     500 |    1000 |
| Heavy Missile |     600 |    1200 |
| Scattershot   |     800 |    1500 |
| Phaser        |    1000 |    1900 |

Enemy speeds are fixed, so engine tuning lets Ada keep pace with the
interceptor and outrun every other enemy at level 2, and outrun all of them at
level 3. The shop follows Archie's Pet shop pattern: tabs, owned
items marked Owned, and a purchase confirm with Buy and Cancel. The shop's close X, an
outside tap, back and Escape return to the station card. An item Ada cannot
afford stays visible with a flat disabled face, stays focusable and tappable,
and refuses with Archie's shared
refusal feedback; reduced motion shows the red tint without shaking. A levelled
row shows Ada's current level ("Level 1 of 3" before the first upgrade) and the
price of the next level; a maxed row shows Owned. The buy confirm shows a weapon's
one-line description.

The mining hub's shop also lists the galaxy's holodisk as the first row of its
Ship tab once Cartwheel's space quest is complete: "Holodisk", the detail
"Restores part of Astra's memory." and its price. Buying it asks "Buy Holodisk?"
and the row then shows Owned.

Ship paint schemes are Classic (the free white and blue default), Cobalt,
Seafoam, Graphite and Iris. Tapping an owned scheme puts it in use at once, with
no confirm; the scheme in use has the selection ring and shows In use instead of
Owned.

## Ammunition

Laser fire is unlimited. Every other weapon has its own ammunition count with no
capacity limit: Rapid Missile and Heavy Missile use missiles, Multi-Laser and
Phaser use energy packs, and Scattershot uses shells. Each weapon tracks its own
count, so Phaser energy is separate from Multi-Laser energy. Each volley uses
one, so a Multi-Laser fan or a Scattershot spread costs one.

Ammunition is sold per weapon in the shop. Every pack costs 10 Stardust, and
later weapons in weapon order get fewer seconds of level 1 fire per pack:
Multi-Laser 300 (90 seconds), Rapid Missile 265 (80), Heavy Missile 35 (70),
Scattershot 60 (60) and Phaser 50 (50). Buying or finding a weapon includes
three packs. A pack's shop row shows its name, such as "Rapid Missile
ammo", with the pack size, such as "×300", on a second line, as levelled rows
show their level. Typical use of the stronger weapons costs about 15 to 35% of Stardust income,
depending on the galaxy's fighting, checked by the pacing simulation. Ammunition persists across flights and the
jump home.

When the selected weapon runs out, Ada switches to Laser at once, ignoring the
switch wait, and Astra's notice says "Out of ammo." An empty weapon's icon shows
its empty state and refuses selection until ammunition is bought.

Each weapon icon shows its remaining count below it in at most four characters:
the exact number up to 9,999 without a separator, then whole thousands as "10k" to
"999k", then whole millions as "1m" to "999m". Laser shows no count. A weapon
button's accessible label is `weaponAmmoLabel` with the exact count, en-US
grouped; Laser's label is its name.

## Weapon switching

Ada can switch weapons at any time, including in combat. After a switch, the next
switch waits 1 second (provisional); during that wait the other weapon icons
refuse with the shared refusal feedback. Equipping a picked-up weapon counts as a
switch and starts the wait; the out-of-ammo switch to Laser does not. The selected weapon's icon has a treatment
like Chibi's power-ups.

## Detail cards

Pressing and holding a weapon or upgrade opens its detail card: a short,
plain description with no exact figures. Holding about 0.5 seconds
(provisional) opens the card instead of acting; a shorter tap acts as before.

- In flight, holding a top-right weapon icon pauses play and opens that
  weapon's card without selecting it or starting the switch wait. The card's
  Close button, close X, an outside tap, back and Escape close it and resume
  play.
- In the shop, holding a weapon row or an upgrade row (weapon upgrades, Shield,
  Engine tuning and Tractor beam) opens its card over the shop instead of the
  buy confirm. Close and the other dismissals return to the same shop tab with
  that row focused. Ammunition, paint, holodisk and project rows have no card.

A weapon card shows the weapon's name, then its lines from the table below,
then its level as `level` when owned. Below that, Laser shows `detailUnlimited`;
another owned weapon shows `detailAmmoLeft` with its count; an unowned weapon
in the shop shows `detailIncludesAmmo` instead. Multi-Laser and Scattershot
lines name the counts at Ada's level, or level 1 when unowned.

| Weapon        | Card lines                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Laser         | "Fires one laser bolt at a time." "Each level fires faster and hits harder."                                             |
| Multi-Laser   | "Fires a fan of {count} laser bolts." "Hits several drones at once." "Each level adds a bolt."                           |
| Rapid Missile | "Fires small missiles quickly." "Explodes on a hit or after a short distance." "Each level fires faster."                |
| Heavy Missile | "Fires slowly but hits hard." "Explodes on a hit or after a short distance, with a big blast." "Each level hits harder." |
| Scattershot   | "Fires a wide spread of {count} shots." "Only reaches close to your ship." "Each level adds shots that hit harder."      |
| Phaser        | "Fires an instant beam that nothing can dodge." "Fires slowly but hits hard." "Each level hits harder."                  |

An upgrade card shows the upgrade's shop name (`weaponUpgrade`, `shield`,
`engineTuning` or `tractorBeam`), Ada's current level as `level`, then
`detailNextLevel` and what the next level adds, from the table below. At level 3
it shows `detailMaxed` instead.

| Upgrade       | Level 2 adds                                              | Level 3 adds                                     |
| ------------- | --------------------------------------------------------- | ------------------------------------------------ |
| Laser         | "Fires faster and hits harder."                           | Same as level 2                                  |
| Multi-Laser   | "One more bolt, and faster bolts."                        | Same as level 2                                  |
| Rapid Missile | "Fires faster."                                           | Same as level 2                                  |
| Heavy Missile | "Hits harder."                                            | Same as level 2                                  |
| Scattershot   | "Two more shots that hit harder."                         | Same as level 2                                  |
| Phaser        | "Hits harder."                                            | Same as level 2                                  |
| Shield        | "A bigger shield that refills faster."                    | Same as level 2                                  |
| Engine tuning | "Faster, and turns quicker. Keep pace with interceptors." | "Faster, and turns quicker. Outrun every drone." |
| Tractor beam  | "Pulls from farther away, and faster."                    | Same as level 2                                  |

## Donations

Once a galaxy's chapter is complete (its space story and its home page), every
station in that galaxy offers its community projects, which Ada funds with
Stardust. A funded project visibly changes the galaxy, plays its thank-you line,
counts toward achievements and makes one ally who joins the Phantom finale
(see [Ships](ships.md#finale-allies)).
Projects give no combat power outside the finale. Prices follow route position: the first galaxy's three projects are 300, 265 and
225; the second's two are 450 and 375, the third's 525 and 375, the fourth's 525
and 450, and the fifth's 600 and 450. At the typical income above, funding all
of a galaxy's projects takes about 95 minutes after its story in Sunflower,
about 85 in Whirlpool, about 100 in Needle and about 70 in Cartwheel, purchases
not subtracted.

| Project            | Galaxy    | Price | Speaker      | Thank-you line                                                             | World change                                                 | Ally in the finale                                  |
| ------------------ | --------- | ----: | ------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| Greenhouse ring    | Sunflower |   300 | Grower       | "A whole ring of greenhouses! Now we can grow enough to share."            | A ring of greenhouse domes around the growers' outpost       | A grower ship using `escort`                        |
| Workshop crane     | Sunflower |   265 | Workshop     | "With this crane we can lift whole ships. Thank you for building with us." | A crane arm on the workshop outpost                          | A crane ship using `chase` against turrets          |
| Salvage beacons    | Sunflower |   225 | Salvager     | "Lost things will shine now. Nothing out here stays lost for long."        | Small blinking beacons beside the salvagers' outpost         | A salvager ship using `escort`                      |
| Nursery beacon     | Whirlpool |   450 | Whale family | "The young ones can rest by its light. Thank you for looking after them."  | A soft-light beacon by the whale family, with calves resting | Another whale, widening the whales' current by half |
| Current-map buoys  | Whirlpool |   375 | Whale family | "The buoys hum the currents back to us. No one will drift off course now." | A chain of buoys along the whales' current                   | A buoy tender using `escort`                        |
| Channel lights     | Needle    |   525 | Elder Loom   | "Young pilots can practise even in the dark now. Patience needs light."    | Soft lamps along the practice channel                        | A young Avi pilot's glider using `escort`           |
| Loom hall          | Needle    |   375 | Avi          | "A hall for teaching. Every pilot here started with a wobbly first gate."  | A new hall on the Avi station                                | A loom ship using `chase` against turrets           |
| Courier school     | Andromeda |   525 | Pip          | "Now every new courier learns to slow down and speak up. Thanks, Ada."     | A small training dock beside the settlers' station           | A courier ship using `escort`                       |
| Spare beacon       | Andromeda |   450 | Settler      | "If a beacon ever goes dark again, this one will light the way."           | A spare guide beacon beside the relit one                    | A beacon tender using `escort`                      |
| Second docking bay | Cartwheel |   600 | Miner        | "A second bay. Nobody has to wait alone anymore."                          | A second docking bay on the mining hub                       | A miner ship using `chase` against turrets          |
| Hub repairs        | Cartwheel |   450 | Station      | "The hub is good as new. There is room for everyone, and now it shows."    | The mining hub shown repaired, with its lights on            | A hub tug using `escort`                            |

Projects is the third shop tab, after Weapons and Ship, shown once the galaxy's
projects are offered. It lists only that galaxy's projects, in table order, so a
station never funds another galaxy's projects. A row shows the project name, its
effect line until something is paid and then its progress as `{paid} of
{price}`, and a price showing what remains; a funded row shows Funded.

Activating a row opens a donation confirm in the shop's buy confirm pattern: the
project's description, the amount this donation pays, the balance left after
and, when part stays unpaid, the amount still needed after. The donation pays
`min(balance, remaining)`, so a short balance makes a part payment that
persists across flights. A row is unaffordable only at a balance of 0, and then
refuses with the shared refusal feedback. Funding the last part closes the card
and plays the thank-you line as a space conversation. A world change is Art's
sprite placed at its site and shows on every later flight; until its art lands,
funding changes nothing in the world. World changes are passable decoration:
they never block Ada or shots, Ada is drawn in front of them while she overlaps
one, and the local map shows none of them. The nursery beacon's calves are the
family's calves in their usual idle, gathered in its light. The current-map
buoys line both edges of the whales' current (see
[Whirlpool](rules.md#galaxy-two-whirlpool-whale-family)), one every 128 world
units along it, 20 world units outside each edge.

| Project            | Id               | Effect line                 | Description                                             |
| ------------------ | ---------------- | --------------------------- | ------------------------------------------------------- |
| Greenhouse ring    | `greenhouseRing` | Domes for more crops        | A ring of greenhouse domes around the growers.          |
| Workshop crane     | `workshopCrane`  | A crane for heavy lifts     | A big gantry crane for the workshop.                    |
| Salvage beacons    | `salvageBeacons` | Helps find lost things      | Bright beacons so lost things are easy to find.         |
| Nursery beacon     | `nurseryBeacon`  | A light for resting calves  | A soft light where whale calves can rest.               |
| Current-map buoys  | `currentBuoys`   | Marks the currents          | Humming buoys that map the whales' current.             |
| Channel lights     | `channelLights`  | Lights the practice channel | Soft lamps so young pilots can practise any time.       |
| Loom hall          | `loomHall`       | A place to teach pilots     | A teaching hall for young Avi pilots.                   |
| Courier school     | `courierSchool`  | Trains careful couriers     | A training dock where new couriers learn to fly safely. |
| Spare beacon       | `spareBeacon`    | A backup guide light        | A spare beacon, ready if the chain ever goes dark.      |
| Second docking bay | `dockingBay`     | No miner waits alone        | A second docking bay at the mining hub.                 |
| Hub repairs        | `hubRepairs`     | Repairs the mining hub      | Patches and new lights for the mining hub.              |

Effect lines use the keys `projectEffectGreenhouse`, `projectEffectCrane`,
`projectEffectBeacons`, `projectEffectDockingBay`, `projectEffectHubRepairs`,
`projectEffectNursery`, `projectEffectCurrentBuoys`, `projectEffectCourierSchool`,
`projectEffectSpareBeacon`, `projectEffectChannelLights` and `projectEffectLoomHall`; descriptions use the
same suffixes after `projectAbout`.

## Quantum jump home

When the shield is depleted, Astra quantum jumps the ship home to Earth so it can
recharge overnight. The cost is only the inconvenience: the flight ends, the
galaxy's layout regenerates on the next flight, and open-space enemies, pickups,
half the undeposited ore (the smaller half on an odd load) and a towed pod are
lost; the jump-home page says when ore was lost. Going home or jumping to
another galaxy by choice keeps all ore. Accepted jobs stay open, each with its carried item (see [Rules](rules.md)). Ada
keeps every weapon, upgrade level, Stardust, purchase, charted landmark and story
progress.

## Player strings

The status pill shows the Stardust and ore counts in at most five characters:
the exact number below 10,000 without a separator ("9999"); from 10,000 to
99,999, thousands with one decimal, rounded to the nearest tenth ("44.4k"), and
a value that rounds to 100.0k shows "100k"; from 100,000, whole thousands,
rounded ("100k" to "9999k"); from 10,000,000, whole millions ("10m"). Their
accessible labels give the exact count, en-US grouped; Stardust's is
`stardustAmount`. The Ship card shows exact counts, en-US grouped ("12,500"). Pickup gain ticks read
"+" then the gain in the same format as the count ("+9999", "+44.4k", "+100k").

The shield shop row reuses the existing `shield` label.

| Key                  | Text                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| `stardust`           | Stardust                                                                  |
| `stardustAmount`     | {amount} Stardust                                                         |
| `station`            | Station                                                                   |
| `shop`               | Shop                                                                      |
| `shopWeapons`        | Weapons                                                                   |
| `shopShip`           | Ship                                                                      |
| `owned`              | Owned                                                                     |
| `level`              | Level {level} of {max}                                                    |
| `confirmTitle`       | Buy {name}?                                                               |
| `confirmLeft`        | {amount} left after                                                       |
| `confirmBuy`         | Buy                                                                       |
| `confirmCancel`      | Cancel                                                                    |
| `projects`           | Projects                                                                  |
| `donate`             | Donate                                                                    |
| `projectFunded`      | Funded                                                                    |
| `ammoPack`           | {weapon} ammo                                                             |
| `ammoPackCount`      | ×{count}                                                                  |
| `outOfAmmo`          | Out of ammo.                                                              |
| `weaponAmmoLabel`    | {weapon}, {count} left                                                    |
| `projectProgress`    | {paid} of {price}                                                         |
| `donateTitle`        | Donate to {name}?                                                         |
| `donateStillNeeded`  | {amount} still needed after                                               |
| `undock`             | Undock                                                                    |
| `stationWelcome`     | Welcome aboard. Trade your Stardust, or take a job.                       |
| `inUse`              | In use                                                                    |
| `paintClassic`       | Classic                                                                   |
| `paintCobalt`        | Cobalt                                                                    |
| `paintSeafoam`       | Seafoam                                                                   |
| `paintGraphite`      | Graphite                                                                  |
| `paintIris`          | Iris                                                                      |
| `aboutHeavyMissile`  | One slow missile with a big blast.                                        |
| `aboutRapidMissile`  | Quick missiles with a small blast.                                        |
| `aboutMultiLaser`    | A fan of laser bolts that grows with each level.                          |
| `aboutScattershot`   | A wide spread, strongest up close.                                        |
| `aboutPhaser`        | An instant beam that strikes the first thing in its path.                 |
| `jumpHome`           | Astra jumped you back to Earth to recharge. Your story progress is saved. |
| `engineTuning`       | Engine tuning                                                             |
| `tractorBeam`        | Tractor beam                                                              |
| `weaponUpgrade`      | {weapon} upgrade                                                          |
| `shipPaint`          | Ship paint                                                                |
| `detailNextLevel`    | Next level                                                                |
| `detailMaxed`        | Fully upgraded.                                                           |
| `detailUnlimited`    | Never runs out.                                                           |
| `detailAmmoLeft`     | Ammo: {count} left                                                        |
| `detailIncludesAmmo` | Comes with 3 ammo packs.                                                  |
| `detailClose`        | Close                                                                     |
