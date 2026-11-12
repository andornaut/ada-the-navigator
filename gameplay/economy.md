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
within its pull radius toward her at its pull speed; Stardust collects within 4 world
units of Ada's drawn ship; other pickups reach farther (see [Rules](rules.md)). The beam pulls only Stardust. Base pull radius
is 65 world units and base pull speed is 150 world units per second. Enemy ships are
destroyed, not teleported: a defeated ship breaks apart in a short effect and drops
its Stardust. A heavy is destroyed when its hull HP reaches 0; a disabled heavy
drops the same Stardust when salvaged (see [Ships](ships.md#heavy-hull-and-disabling)).

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
| `frigate`        |        6 |
| `capital`        |       14 |

An enemy's Stardust is half its hit points, rounded down, and at least 1; a
heavy counts all its hardpoints' hit points, not its hull. The table shows
position 1; values follow each position's hit points.
Discovery caches are rare. These values come from a pacing simulation of typical
play against the targets above; rerun it after changing any earning value.

A drop splits its Stardust into whole-Stardust pickups, as evenly as possible with
the larger pieces first, so one pickup can carry more than 1 Stardust. The number
of pickups is the drop's value, capped at 8 for small craft, 16 for frigates and
24 for capital ships, and one per Stardust for asteroids. With the values above, every
drop is below its cap, so each pickup carries 1 Stardust.

Weapons are sold at stations and are also rare drops: 0.5% of destroyed small
ships, 5% of frigates and 5% of capitals drop a random upgrade weapon; in galaxy
one, small ships drop one 0.25% of the time and frigates 2%. A dropped weapon
Ada already owns gives one pack of its ammunition instead. Salvaging a disabled
heavy multiplies its weapon chance by 5. Story mining deposits keep their
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
Use offers Dock again at once. Docking opens the station card, which pauses action like a
conversation. The card shows the Stardust balance, a welcome line (the keeper's greeting; see [Species and greeters](rules.md#species-and-greeters)), Undock, Shop and Jobs; Jobs
opens the station's job board (see [Quests](quests.md)).
Like Archie's modals it has a close X; the X, an outside tap, back and Escape all
undock. Station quests are part of the station concept; their content is
not yet designed, so the station card shows no quest board until it is.

## Shop

| Item           | Effect                                                                                          | Prices   |
| -------------- | ----------------------------------------------------------------------------------------------- | -------- |
| Multi-Laser    | Owned weapon                                                                                    | 250      |
| Rapid Missile  | Owned weapon                                                                                    | 150      |
| Heavy Missile  | Owned weapon                                                                                    | 300      |
| Scattershot    | Owned weapon                                                                                    | 350      |
| Phaser         | Owned weapon                                                                                    | 400      |
| Weapon upgrade | Per weapon, Laser included: levels 2 and 3, each about ×1.5 effective output                    | 150, 300 |
| Shield         | Levels 2 and 3: capacity 15, then 20; recharge delay 15, then 10 s; empty to full 45, then 30 s | 300, 600 |
| Engine tuning  | Levels 2 and 3: top speed 190, then 220; each −10% acceleration and braking seconds             | 120, 240 |
| Tractor beam   | Levels 2 and 3: pull radius 100, then 135; pull speed 220, then 300                             | 80, 160  |
| Ship paint     | Cosmetic colour schemes for Ada's ship; the white and blue scheme stays free                    | 50 each  |

Enemy speeds are fixed, so engine tuning lets Ada outrun the swarm at level 2 and
match the interceptor at level 3. The shop follows Archie's Pet shop pattern: tabs, owned
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

## Ammunition

Laser fire is unlimited. Every other weapon has its own ammunition count with no
capacity limit: Rapid Missile and Heavy Missile use missiles, Multi-Laser and
Phaser use energy packs, and Scattershot uses shells. Each weapon tracks its own
count, so Phaser energy is separate from Multi-Laser energy. Each volley uses
one, so a Multi-Laser fan or a Scattershot spread costs one.

Ammunition comes from the shop, sold per weapon in packs of about a minute of
steady fire at level 1: Rapid Missile 200, Heavy Missile 50, Multi-Laser 200,
Scattershot 130 and Phaser 55. Buying or finding a weapon includes three packs. A
dropped weapon Ada already owns gives one pack of that weapon's ammunition. There
are no separate ammunition pickups. A pack's shop row shows its name, such as "Rapid Missile
ammo", with the pack size, such as "×200", on a second line, as levelled rows
show their level. Prices are light: typical use of the stronger
weapons costs about a sixth of Stardust income, provisionally 6 Stardust per
pack, tuned by the pacing simulation. Ammunition persists across flights and the
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

## Donations

Once a galaxy's chapter is complete (its space story and its home page), every
station in that galaxy offers its community projects, which Ada funds with
Stardust. A funded project visibly changes the galaxy, plays its thank-you line,
counts toward achievements and makes one ally who joins the Black Eye finale.
Projects give no combat power outside the finale. Prices follow route position: the first galaxy's three projects are 300, 250 and
175; the second's two are 300 and 250, the third's 350 and 250, the fourth's 350
and 300, and the fifth's 400 and 300. Prices target funding all of a galaxy's projects about an hour after its
story ends, measured in the pacing simulation by Stardust earned without jobs,
purchases not subtracted.

| Project            | Galaxy    | Price | Speaker      | Thank-you line                                                             | World change                                                 | Ally in the finale                                  |
| ------------------ | --------- | ----: | ------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| Greenhouse ring    | Sunflower |   300 | Grower       | "A whole ring of greenhouses! Now we can grow enough to share."            | A ring of greenhouse domes around the growers' outpost       | A grower ship using `escort`                        |
| Workshop crane     | Sunflower |   250 | Workshop     | "With this crane we can lift whole ships. Thank you for building with us." | A crane arm on the workshop outpost                          | A crane ship using `chase` against turrets          |
| Salvage beacons    | Sunflower |   175 | Salvager     | "Lost things will shine now. Nothing out here stays lost for long."        | Small blinking beacons beside the salvagers' outpost         | A salvager ship using `escort`                      |
| Nursery beacon     | Whirlpool |   300 | Whale family | "The young ones can rest by its light. Thank you for looking after them."  | A soft-light beacon by the whale family, with calves resting | Another whale, widening the whales' current by half |
| Current-map buoys  | Whirlpool |   250 | Whale family | "The buoys hum the currents back to us. No one will drift off course now." | A chain of buoys along the whales' current                   | A buoy tender using `escort`                        |
| Channel lights     | Needle    |   350 | Elder Loom   | "Young pilots can practise even in the dark now. Patience needs light."    | Soft lamps along the practice channel                        | An Avi glider using `escort`                        |
| Loom hall          | Needle    |   250 | Avi          | "A hall for teaching. Every pilot here started with a wobbly first gate."  | A new hall on the Avi station                                | A loom ship using `chase` against turrets           |
| Courier school     | Andromeda |   350 | Pip          | "Now every new courier learns to slow down and speak up. Thanks, Ada."     | A small training dock beside the settlers' station           | A courier ship using `escort`                       |
| Spare beacon       | Andromeda |   300 | Settler      | "If a beacon ever goes dark again, this one will light the way."           | A spare guide beacon beside the relit one                    | A beacon tender using `escort`                      |
| Second docking bay | Cartwheel |   400 | Miner        | "A second bay. Nobody has to wait alone anymore."                          | A second docking bay on the mining hub                       | A miner ship using `chase` against turrets          |
| Hub repairs        | Cartwheel |   300 | Station      | "The hub is good as new. There is room for everyone, and now it shows."    | The mining hub shown repaired, with its lights on            | A hub tug using `escort`                            |

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
carried cargo and a towed pod are lost. Accepted quests stay open to retry. Ada
keeps every weapon, upgrade level, Stardust, purchase, charted landmark and story
progress.

## Player strings

The status pill shows the Stardust and ore counts in at most four characters, as
weapon counts do: the exact number up to 9,999 without a separator ("9999"), then
whole thousands as "10k" to "999k", then whole millions as "1m" to "999m". Their
accessible labels give the exact count, en-US grouped; Stardust's is
`stardustAmount`. The Ship card shows exact counts, en-US grouped ("12,500"). Pickup ticks read "+N".

The shield shop row reuses the existing `shield` label.

| Key                 | Text                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `stardust`          | Stardust                                                                  |
| `stardustAmount`    | {amount} Stardust                                                         |
| `station`           | Station                                                                   |
| `shop`              | Shop                                                                      |
| `shopWeapons`       | Weapons                                                                   |
| `shopShip`          | Ship                                                                      |
| `owned`             | Owned                                                                     |
| `level`             | Level {level} of {max}                                                    |
| `confirmTitle`      | Buy {name}?                                                               |
| `confirmLeft`       | {amount} left after                                                       |
| `confirmBuy`        | Buy                                                                       |
| `confirmCancel`     | Cancel                                                                    |
| `projects`          | Projects                                                                  |
| `donate`            | Donate                                                                    |
| `projectFunded`     | Funded                                                                    |
| `ammoPack`          | {weapon} ammo                                                             |
| `ammoPackCount`     | ×{count}                                                                  |
| `outOfAmmo`         | Out of ammo.                                                              |
| `weaponAmmoLabel`   | {weapon}, {count} left                                                    |
| `projectProgress`   | {paid} of {price}                                                         |
| `donateTitle`       | Donate to {name}?                                                         |
| `donateStillNeeded` | {amount} still needed after                                               |
| `undock`            | Undock                                                                    |
| `stationWelcome`    | Welcome aboard. Trade your Stardust, or take a job.                       |
| `inUse`             | In use                                                                    |
| `paintClassic`      | Classic                                                                   |
| `paintCobalt`       | Cobalt                                                                    |
| `paintSeafoam`      | Seafoam                                                                   |
| `paintGraphite`     | Graphite                                                                  |
| `paintIris`         | Iris                                                                      |
| `aboutHeavyMissile` | One slow missile with a big blast.                                        |
| `aboutRapidMissile` | Quick missiles with a small blast.                                        |
| `aboutMultiLaser`   | A fan of laser bolts that grows with each level.                          |
| `aboutScattershot`  | A shotgun spread, strongest up close.                                     |
| `aboutPhaser`       | An instant beam that strikes the first thing in its path.                 |
| `jumpHome`          | Astra jumped you back to Earth to recharge. Your story progress is saved. |
| `engineTuning`      | Engine tuning                                                             |
| `tractorBeam`       | Tractor beam                                                              |
| `weaponUpgrade`     | {weapon} upgrade                                                          |
| `shipPaint`         | Ship paint                                                                |
