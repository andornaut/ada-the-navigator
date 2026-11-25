# Economy

Stardust is the game's one currency. It is shimmering dust released by destroyed
ships and asteroids, and friendly stations trade in it. Hostile stations offer
no Dock, shop or jump action. Stardust and purchases persist
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

Without jobs, a price divided by that income gives its pacing estimate: the
first weapon (400) takes about 50 minutes of Sunflower play, saving 500 for
Cartwheel's holodisk about 30 minutes of Cartwheel play, and a galaxy's projects
the time their total takes at its income after its story ends. With jobs taken
back to back at the approved completion rewards, the first weapon takes about 14
minutes in Sunflower and in Cartwheel, Cartwheel's holodisk about 16 and all three
Sunflower projects about 22, and jobs supply about three quarters of income or
more; this job-assisted pacing is approved. Pacing, kill-time and ore-income
simulations remain deferred.
Exploring finds a station every few minutes.

## Earning Stardust

A hostile station pays 100 Stardust in Andromeda, 150 in Cartwheel and 200 in
Phantom, once on its first disable or destruction in that encounter. Destruction
after disable pays nothing further, and Continue must not duplicate the payout.
Defenders retain their ordinary drops; no other reward override is approved.
This station-specific reward policy is approved and its constants are present in
the inspected source; production payout acceptance remains unverified. Site and
encounter lifetimes follow
[Rules](rules.md#hostile-station-sites-and-map-knowledge) and
[Ships](ships.md#hostile-station-defenders-and-encounter-lifetime).

Destroyed enemy ships release Stardust as small glinting pickups. Destroyed
asteroids release either an eligible ammo pack alone or a size-weighted resource
yield. Small asteroids may release nothing; medium, large and huge asteroids
guarantee at least one reward, which may be an ammo pack.
Ada's ship has a tractor beam, with no visual of its own, that draws every
pickup (Stardust, ore nuggets, discovery caches, weapons, ammo packs, a floating holodisk and
a hunt job's lost item) within its pull radius toward her at its pull speed,
all kinds alike. A pickup collects within 20 world units of Ada's drawn ship, the
one pickup rule (see [Rules](rules.md)). Base pull radius is 60 world units and
base pull speed is 120 world units per second; levels 2 and 3 raise them to 90
and 160, then 120 and 200. Enemy ships are
destroyed, not teleported: a defeated ship breaks apart in a short effect and drops
its Stardust. A heavy is destroyed when its hull HP reaches 0.
Each whole-number payout in the listed destruction range is equally likely.
The range is the same in every galaxy. Fighter escorts use the fighter range.

| Enemy           | Destruction range | Average |
| --------------- | ----------------: | ------: |
| Swarm ship      |               1–3 |       2 |
| Fighter         |               2–5 |     3.5 |
| Interceptor     |               2–5 |     3.5 |
| Retaliator      |               2–5 |     3.5 |
| Frigate         |              4–10 |       7 |
| Capital ship    |             10–20 |      15 |
| Turret platform |              4–10 |       7 |

For a frigate, capital ship or turret platform, salvage pays half the rolled
value, rounded down, and retains the existing upgrade chance. Destroying the
hull pays the full roll. The finale flagship pays 44 on salvage. Hostile
stations use their separate encounter rewards above. A discovery cache pays 4.

Disabling a heavy does not destroy it. Fleeing, unloading,
despawning or restoring a survivor does not grant defeat loot, and a released
wreck never pays again.
Discovery caches are rare. Resource-yield asteroids first roll a total using
these relative weights. Each array follows the listed total-unit range in
ascending order and sums to 100. The maximum chances in this table describe
only that initial roll, before ore quantity reduction.

| Size   | Initial resource units | Relative weights                 | Initial chance of maximum |
| ------ | ---------------------- | -------------------------------- | ------------------------- |
| Small  | 0 to 4                 | 15, 10, 37, 36, 2                | 2%                        |
| Medium | 1 to 6                 | 15, 20, 30, 24, 7, 4             | 4%                        |
| Large  | 1 to 8                 | 10, 14, 19, 20, 16, 10, 3, 8     | 8%                        |
| Huge   | 1 to 10                | 5, 8, 12, 36, 14, 2, 2, 2, 3, 16 | 16%                       |

Each initial resource unit independently becomes ore with probability 0.75 or
Stardust with probability 0.25. `ASTEROID_LOOT.oreChance` defines that split.
Ore quantity is then reduced by 25% in expectation for every size class.
`ASTEROID_LOOT.oreQuantityMultiplier` is 0.75, independent of the initial split.
Expected units per resource outcome are:

| Size   | Ore    | Stardust | Total  |
| ------ | ------ | -------- | ------ |
| Small  | 1.125  | 0.5      | 1.625  |
| Medium | 1.6875 | 0.75     | 2.4375 |
| Large  | 2.25   | 1        | 3.25   |
| Huge   | 2.8125 | 1.25     | 4.0625 |

A non-small raw ore-only-one payout stays one. For each size, let Y be the
expected raw ore and p the probability of that protected payout. Derive the
remaining ore scale as `(0.75 * Y - p) / (Y - p)`; small rocks have p = 0.
Otherwise multiply the raw ore by that scale and round to an integer without
bias, using the last unit's conditional uniform residual without another random
draw. The derived scales are 3/4, 14/19, 29/39 and 74/99 from small to huge.
Stardust is unchanged on every event. All non-small scales exceed one half, so
ore-only payouts of at least two cannot round to zero. Size caps and the
non-small minimum remain unchanged. Five-unit pickups have no selection bias.
Ammo remains an exclusive outcome under its own rules.

Group the resulting ore into pickups worth 5 ore each, with any remainder as
one-unit pickups. A five-ore chunk replaces five single ore pickups; it is the
same fungible ore, collected by normal contact and the tractor beam. The size
cap counts resource units, not pickup sprites. There is no additive ore bonus
or extra Stardust burst. Enemy loot, discovery caches and job rewards keep
their own rules.

A drop splits its Stardust into whole-Stardust pickups, as evenly as possible with
the larger pieces first, so one pickup can carry more than 1 Stardust. The number
of pickups is the drop's value, capped at 8 for small craft, 16 for frigates and
24 for capital ships, and one per Stardust for asteroids. A drop above its cap, such as a
destroyed capital's, splits into pickups worth more than 1 Stardust.

Upgrades are sold at stations and are also rare drops, at the same rates in every
galaxy: 0.25% of destroyed small ships and 10% of salvaged frigates, platforms and
capitals drop an upgrade pickup. Rocks never drop one. A destroyed heavy drops none. An upgrade drop
gives one level, as buying the next level does, and only something Ada can still
use. The game picks a category, then an item within it. Weapons, Shield, Engine
tuning and Tractor beam have equal relative weight. Paint is shop-only and
never enters the upgrade pool. Removing only Paint renormalizes the remaining
category weights without changing their ratios; this does not select new
absolute weight values:

- Weapons: one weapon's next step, the weapon itself with its starting
  ammunition if Ada does not own it, otherwise its next level. Each weapon is
  half as likely as the one before it: Laser 64, Multi-Laser 32, Rapid Missile
  16, Heavy Missile 8, Scattershot 4 and Phaser 2. Only the weapons unlocked in
  the galaxy Ada is in take part (see [Weapon unlocks](#weapon-unlocks)).
- Shield: its next level.
- Engine tuning: its next level.
- Tractor beam: its next level.

A category or weapon with nothing left to give leaves the pool, and the rest keep
their relative weights. Once nothing is left, the drop gives one pack of
world ammunition for an owned weapon other than Laser, chosen by the ammo pack weights below, or nothing when there is none. The pickup is one shared upgrade pickup,
and its contents are chosen when Ada collects it, so they fit her upgrades at that
moment. Its notice names what it gave:

| Gift          | Notice                   |
| ------------- | ------------------------ |
| New weapon    | + {weapon}               |
| Weapon level  | + {weapon} level {n}     |
| Shield        | + Shield level {n}       |
| Engine tuning | + Engine level {n}       |
| Tractor beam  | + Tractor beam level {n} |
| Ammunition    | + {weapon} ammo          |

Each destroyed fighter, fighter escort, swarm ship, interceptor and retaliator
rolls a 10% chance to drop an ammo pack in addition to its Stardust.
Destroyed asteroids other than ore-field rocks roll by size: 0.5% for small, 1%
for medium, 2% for large and 4% for huge. Ammo drops require owning a weapon
other than Laser. The pack's contents are chosen when Ada collects it, using the
weights Multi-Laser 16, Rapid Missile 12, Heavy Missile 9, Scattershot 7 and
Phaser 5 among eligible weapons. A world pickup gives exactly one third of its
shop pack: 100 Multi-Laser bolts, 60 Rapid Missiles, 25 Heavy Missiles, 40
Scattershot volleys or 25 Phaser shots. The HUD shows +N by the weapon icon
using the actual ammunition added.

Every destroyed asteroid uses the size-based yields above when it does not
release ammunition. An asteroid that drops an ammo pack drops nothing else:
no ore, Stardust or other loot. The ammo outcome satisfies
the medium, large and huge asteroid minimum-reward guarantee. Without ammo,
small asteroids may yield zero resources; the other sizes yield at least one
combined resource unit, but neither ore nor Stardust is individually guaranteed.
Loot is released once on destruction, never for an intact or indestructible rock.
A destroyed asteroid's drops release 240 ms after destruction, spread up to 7.68
world units from its centre, at every motion setting. This timing is the
asteroids' own and does not follow enemy destruction timing.

Every static rock is an ordinary asteroid. Its contents are decided by this
roll when it is destroyed: ore and Stardust, an ammo pack or nothing. Ore comes
from destroyed asteroids in every galaxy. Cartwheel's ore fields are clusters of
ordinary rocks, which makes Cartwheel richest in ore. A destroyed ore-field rock
skips the ammo roll and gives at least 1 ore; any further ore and Stardust roll
as usual. Ore aboard fuels
shield recharge starting 25 seconds after the last hit, at 4% of maximum
shield capacity per second. Each ore funds restoration of 1% of maximum shield capacity,
so fewer than 10 ore are useful: 10 ore funds 10%, and an empty-to-full recharge
costs 100 ore at every Shield level. Carried ore stays integer-valued; unused
fractions of paid recharge credit survive damage and save interruptions without
being billed again. The HUD shows −10 for each cumulative 10 ore actually paid,
not for credit consumed; this adds no resource or player-facing counter.
Without ore, free recharge stops at 10% capacity; it does not
reduce a shield already above that threshold. Ore deposited at the mining hub
still counts toward its story goal and an accepted Mining contract. Deposited
ore is no longer aboard to fuel recharge.

All existing Stardust quest-completion payouts use
`questReward(base) = ceil(2 * base / 25) * 25`, including station jobs and
repeatable activities. Use the same final amount in offers, details, completion
notices and payment, preserving saved base values and already paid balances.
This does not change ordinary drops, discovery caches, prices, Exchange,
donations or nonquest achievement bonuses. See [Quests](quests.md#rewards).

## Stations

The stock and service decisions are recorded in
[Station, Shop and Exchange](../docs/work/ada-0339.md).

Station density is doubled in every galaxy. Station placement remains seeded
and stable across flights; existing known station ids and positions must survive
adoption. The minimum station spacing is 8000 / sqrt(2), approximately
5656.854249 world units. Andromeda's existing settlements stay at their legacy
station positions plus (6000, 6000), with 1200 world units of station clearance.
New candidates avoid existing destinations; validation must not apply the denser
placement rules retroactively to remove or move legacy sites. Tech owns the
placement algorithm and must measure accepted station density after candidate
rejections against the approximately doubled target, rather than counting layers. A discovered
station becomes a travel destination like other destinations. An undiscovered station
within 5000 world units of Ada is marked by the direction indicator, so stations
remain findable. A station is a safe
area. Ada docks with Use (Dock) within Talk range, 160 world units from the
station's centre, like any other destination; the station has no dock mouth and
flying over it does nothing. Undocking leaves Ada at rest where she docked, so
Use offers Dock again at once. A normal docking opens the Station welcome with
the keeper's paragraph and the available service actions (see
[Species and greeters](rules.md#species-and-greeters)). Jobs is offered only at a
station with jobs. Every station offers Exchange. Jobs-only stations retain
Jobs & Projects and Exchange. Retail stations have two distinct stock panes
selected from Weapons, Equipment and Ammo. Equipment includes ship upgrades
and paint. Reachable shops in a galaxy collectively offer all three categories.
Select offer identities from stable station identity and the galaxy catalogue,
independently of balance, ownership, ammunition counts and visits. Each pane
shows two to four distinct eligible offers, or all eligible offers if fewer
than two exist. Sunflower's Ammo pane only offers Multi-Laser ammunition.
The Cartwheel mining hub reserves one Equipment slot for its mandatory
holodisk whenever the story allows that purchase. Every station has an
individual keeper identity and galaxy-specific welcome variants.
The card's close X, an outside tap, back and Escape all undock.

## Shop

Shop, Jobs and Projects use Large cards; buy and donation confirms and detail
cards are Small cards over their parent. Their existing contents, actions and
dismissal rules apply.
Pause, Settings and the Map keep their layout.

### Weapon unlocks

Weapons unlock along the route, one per galaxy. The galaxy Ada is in sets what
its shops sell and what its upgrade drops give: the weapons unlocked there,
their levels and their ammunition at stations with the weapons-and-ammunition
specialty. Laser and its levels are available through that specialty in every
galaxy. Back in an earlier galaxy, only that galaxy's weapons,
levels and ammunition are sold, and only its weapons and levels drop. Ammo packs
are the exception: they drop for every weapon Ada owns, in any galaxy (see
[Ammunition](#ammunition)).

| Position | Galaxy    | Unlocks       |
| -------: | --------- | ------------- |
|        1 | Sunflower | Multi-Laser   |
|        2 | Whirlpool | Rapid Missile |
|        3 | Needle    | Heavy Missile |
|        4 | Andromeda | Scattershot   |
|        5 | Cartwheel | Phaser        |
|        6 | Phantom   | Nothing new   |

### Prices

| Item           | Effect                                                                                                                                               | Prices            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Multi-Laser    | Owned weapon                                                                                                                                         | 400               |
| Rapid Missile  | Owned weapon                                                                                                                                         | 500               |
| Heavy Missile  | Owned weapon                                                                                                                                         | 600               |
| Scattershot    | Owned weapon                                                                                                                                         | 800               |
| Phaser         | Owned weapon                                                                                                                                         | 1000              |
| Weapon upgrade | Per weapon, Laser included: levels 2 and 3, each about ×1.5 effective output (×1.2 to 1.33 for Rapid Missile and Multi-Laser)                        | See below         |
| Shield         | Levels 2 and 3: capacity 15, then 20. Full recharge takes 25 s at every level with enough ore.                                                       | 450, 900          |
| Engine tuning  | Levels 2 and 3: top speeds 200 and 225. Reach 90% speed in 0.80 and 0.65 s. Both coast about 120 units from top speed. See [Ships](ships.md#values). | 180, 360          |
| Tractor beam   | Levels 2 and 3: pull radius 90, then 120; pull speed 160, then 200                                                                                   | 120, 240          |
| Ship paint     | Cosmetic colour schemes for Ada's ship; the white and blue scheme stays free                                                                         | By purchase order |

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

Engine tuning raises Ada's top speed. See [ship speeds](ships.md#values) for
how it compares with enemy craft. Owned weapons retain upgrade rows, and maxed
items remain visible.
Unowned ammunition stays visible with “Requires {weapon}” and its purchase
guard. Names, prices and unlocks follow the canonical catalogue.

Shop displays both stock panes at once. Each purchase opens a small Buy or
Cancel confirmation with the item, icon and price. On return, restore focus
to the same offer or the nearest available one. An unaffordable offer stays
visible and reports refusal if activated. The Cartwheel hub's story offer
uses “Holodisk” and “Restores part of Astra's memory.” while available.

Ship paint schemes are Classic (the free white and blue default), Cobalt,
Seafoam, Crimson, Iris and Amber. Tapping an owned scheme puts it in use at once, with
no confirm. The current scheme shows In use instead of Owned. The five paid schemes cost 1500, 2000, 2500, 3000 and 3500 Stardust by
purchase order, whichever scheme Ada chooses next. Classic stays free and does
not advance that order. Buy new paints at shops. From Paused → Ship, open
Paint to see swatches for every owned scheme, including Classic. Apply equips
a paint immediately for free and keeps the card open. The selected scheme
shows In use. Close returns to Ship. The selected paint is saved with the
loadout. Each scheme has a main colour and a wing-tip accent colour. Shop
swatches, Paint swatches and the paint notice show both.

## Ammunition

Laser fire is unlimited. Each finite-ammunition weapon holds at most 9,999 shots.
Rapid Missile and Heavy Missile use missiles, Multi-Laser and
Phaser use energy packs, and Scattershot uses shells. Each weapon tracks its own
count, so Phaser energy is separate from Multi-Laser energy. Multi-Laser spends
one unit per bolt, so a full fan costs 3, 4 or 5 units by level. If the count
is lower, it fires only the affordable bolts, taking the angles closest to aim
first. This higher ammo cost balances the fan's easier aiming. Other weapons
spend one unit per volley, including a full Scattershot spread.

Ammunition is sold per weapon in the shop. Every pack costs 25 Stardust and
gives three world pickups' worth: Multi-Laser 300 bolts, Rapid Missile 180
missiles, Heavy Missile 75 missiles, Scattershot 120 volleys and Phaser 75
shots. A new weapon includes its own starting ammo: 900, 780, 120, 180 and
120 units respectively. The shop shows the ammo name and its pack size on
separate lines, for example "Rapid Missile ammo" and "×180". Ammunition
persists across flights and the jump home.

When the selected weapon runs out, Ada switches to Laser at once and Astra's
notice says "Out of ammo." An empty weapon's icon shows
its empty state and refuses selection until ammunition is bought.

Each weapon icon shows its remaining count below it in at most four characters:
the exact number up to 9,999 without a separator, then whole thousands as "10k" to
"999k", then whole millions as "1m" to "999m". Laser shows no count. A weapon
button's accessible label is `weaponAmmoLabel` with the exact count, en-US
grouped; Laser's label is its name.

## Weapon switching

In flight, tapping Laser or an owned weapon with ammo equips it immediately,
including while moving, aiming or fighting. Consecutive switches have no delay.
Switching preserves the regular firing cooldown. A newly collected weapon equips
immediately. The selected weapon's icon has a treatment like Chibi's power-ups.

## Detail cards

Pressing and holding a weapon or upgrade opens its detail card: a short,
plain description with no exact figures. Holding 500 ms, the shared hold
duration for discrete controls in every game, opens the card instead of acting; a shorter tap acts as before.

- In flight, holding a top-right weapon icon pauses play and opens that
  weapon's card without selecting it. The card's
  Close button, close X, an outside tap, back and Escape close it and resume
  play.
- In the shop, holding a weapon row or an upgrade row (weapon upgrades, Shield,
  Engine tuning and Tractor beam) opens its card over the shop instead of the
  buy confirm. Back and the other dismissals return to the same Shop pane with
  that row focused. Ammunition, paint, holodisk and project rows have no card.

A weapon card's header shows its canonical weapon glyph and existing compact
name: level 1 has no suffix, and levels 2 and 3 use `[2]` and `[3]`. The body
contains only the description lines below, with no separate level or ammunition
text. Below the description, a separate quantity row shows the weapon's actual
ammunition icon beside its current count. Laser uses its own canonical glyph
beside the exact text "Unlimited". An unowned shop weapon shows
`detailIncludesAmmo` separately below the description instead of a fabricated
current count. Multi-Laser and Scattershot descriptions use the counts at Ada's
level, or level 1 when unowned.

Ore and Stardust detail cards have a text-only title and their description. A
separate quantity row below shows the single canonical resource icon beside the
actual quantity. The header has no resource icon, so the icon appears only once.

A quest item in the HUD opens its matching quest details, with no generic
quantity row. A nonquest fallback shows only known item details and never
fabricates a count.

The contextual dismissal is Close or Back. A sole Close button is centered.
Multi-action rows place the secondary action on the left and the primary action
on the right. Close returns from flight details to flight; Back returns to the
originating parent view. The close X, Escape and other supported dismissals return to that same
origin, preserving the Shop pane and focused row where applicable.

| Weapon        | Card lines                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Laser         | "Fires one laser bolt at a time." "Each level fires faster and hits harder."                                                |
| Multi-Laser   | "Fires a fan of {count} laser bolts." "Each level adds a bolt."                                                             |
| Rapid Missile | "Fires small missiles quickly." "Explodes on impact or after a short distance." "Each level fires faster."                  |
| Heavy Missile | "Fires slowly but hits hard." "Explodes on impact or after a short distance, with a large blast." "Each level hits harder." |
| Scattershot   | "Fires a wide spread of {count} short-range shots." "Each level adds shots that hit harder."                                |
| Phaser        | "Fires an instant beam that nothing can dodge." "Fires slowly but hits hard." "Each level hits harder."                     |

An upgrade card shows the upgrade's shop name (`weaponUpgrade`, `shield`,
`engineTuning` or `tractorBeam`), Ada's current level as `level`, then
`detailNextLevel` and what the next level adds, from the table below. At level 3
it shows `detailMaxed` instead.

| Upgrade       | Level 2 adds                           | Level 3 adds    |
| ------------- | -------------------------------------- | --------------- |
| Laser         | "Fires faster and hits harder."        | Same as level 2 |
| Multi-Laser   | "One more bolt, and faster bolts."     | Same as level 2 |
| Rapid Missile | "Fires faster."                        | Same as level 2 |
| Heavy Missile | "Hits harder."                         | Same as level 2 |
| Scattershot   | "Two more shots that hit harder."      | Same as level 2 |
| Phaser        | "Hits harder."                         | Same as level 2 |
| Shield        | "A bigger shield that refills faster." | Same as level 2 |
| Engine tuning | "Fly faster and turn more quickly."    | Same as level 2 |
| Tractor beam  | "Pulls from farther away, and faster." | Same as level 2 |

## Donations

Sunflower, Whirlpool, Needle, Andromeda and Cartwheel offer community
projects. Once the galaxy's space story and Earth resolution are complete,
every station in that galaxy offers its projects, which Ada funds with
Stardust. Phantom has no community projects. Show the project pane only when
the galaxy has an unlocked, nonempty project catalog. Jobs and held-task access
follow their existing rules. A funded project visibly changes the galaxy, plays its thank-you line,
counts toward achievements and makes one ally who joins the Phantom finale
(see [Ships](ships.md#finale-allies)).
Projects give no combat power outside the finale. Sunflower, Whirlpool,
Needle and Andromeda each offer three projects. Cartwheel offers two.
Phantom has none. The table lists the total cost of each individual project.

| Project            | Galaxy    | Price | Speaker      | Thank-you line                                                                             | World change                                                 | Ally in the finale                           |
| ------------------ | --------- | ----: | ------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------- |
| Greenhouse ring    | Sunflower |   300 | Grower       | "A whole ring of greenhouses! Now we can grow enough to share."                            | A ring of greenhouse domes around the growers' outpost       | A grower ship using `escort`                 |
| Workshop crane     | Sunflower |   265 | Workshop     | "With this crane we can lift whole ships. Thank you for building with us."                 | A crane arm on the workshop outpost                          | A crane ship using `chase` against turrets   |
| Salvage beacons    | Sunflower |   225 | Salvager     | "These beacons will help us find lost things. Nothing out here stays lost for long."       | Small blinking beacons beside the salvagers' outpost         | A salvager ship using `escort`               |
| Nursery beacon     | Whirlpool |   450 | Whale family | "The young ones can rest by its light. Thank you for looking after them."                  | A soft-light beacon by the whale family, with calves resting | Another whale, widening Marlo's song by half |
| Current-map buoys  | Whirlpool |   375 | Whale family | "The buoys hum the currents back to us. No one will drift off course now."                 | A chain of buoys along the whales' current                   | A buoy tender using `escort`                 |
| Quiet crossing     | Whirlpool |   300 | Whale family | "The ships wait here now. The little ones can cross without hurrying."                     | Waiting lights outside the whale family route                | Voron guide craft using `escort`             |
| Channel lights     | Needle    |   525 | Elder Loom   | "Young pilots can practise even in the dark now. Patience needs light."                    | Soft lamps along the practice channel                        | A young Avi pilot's glider using `escort`    |
| Loom hall          | Needle    |   375 | Avi          | "A hall for teaching. Every pilot here started with a wobbly first gate."                  | A new hall on the Avi station                                | A loom ship using `chase` against turrets    |
| Practice berth     | Needle    |   350 | Elder Loom   | "A young pilot sat here all morning. By afternoon, they were ready to try the turn again." | Observation berth beside the practice-channel entrance       | Avi practice glider using `escort`           |
| Courier school     | Andromeda |   525 | Pip          | "Now every new courier learns to slow down and speak up. Thanks, Ada."                     | A small training dock beside the settlers' station           | A courier ship using `escort`                |
| Spare beacon       | Andromeda |   450 | Settler      | "If a beacon ever goes dark again, this one will light the way."                           | A spare guide beacon beside the relit one                    | A beacon tender using `escort`               |
| Route exchange     | Andromeda |   400 | Pip          | "Someone left a note about a turn they missed. It saved the next pilot the same trip."     | Lit route-note rack at the courier settlement                | Courier runner using `escort`                |
| Second docking bay | Cartwheel |   600 | Miner        | "A second bay. Nobody has to wait alone anymore."                                          | A second docking bay on the mining hub                       | A miner ship using `chase` against turrets   |
| Hub repairs        | Cartwheel |   450 | Station      | "The hub is good as new. There is room for everyone, and now it shows."                    | The mining hub shown repaired, with its lights on            | A hub tug using `escort`                     |

Unlocked projects appear in the right Community projects pane of
Jobs & Projects, with Jobs on the left. The page opens at every eligible
station, including those with projects and no ordinary jobs. The project pane
lists only this galaxy's projects in table order. It shows the effect until
Ada contributes, then `{paid} of {price}` and the remaining cost. Completed
projects show Funded.

Activating a row opens a donation confirmation with the project's description
and the contribution amount. The donation pays
`min(balance, remaining)`, so a short balance makes a part payment that
persists across flights. A row is unaffordable only at a balance of 0, and then
refuses with the shared refusal feedback. Funding the last part closes the card
and plays the thank-you line in the conversation card. A world change is Art's
sprite placed at its site and shows on every later flight; until its art lands,
funding changes nothing in the world. World changes are passable decoration:
they never block Ada or shots, Ada is drawn in front of them while she overlaps
one, and the local map shows none of them. The nursery beacon's calves are the
family's calves in their usual idle, gathered in its light. The current-map
buoys line both edges of the whales' current (see
[Whirlpool](rules.md#galaxy-two-whirlpool-whale-family)), one every 128 world
units along it, 20 world units outside each edge. The spare guide beacon stands 96 world
units beside the relit beacon, on the side away from the chain. The channel
lamps line both edges of Needle's practice channel the same way, one every 128
world units along it, 20 world units outside each edge, alternating their two
looks.

| Project            | Id               | Effect line                    | Description                                                               |
| ------------------ | ---------------- | ------------------------------ | ------------------------------------------------------------------------- |
| Greenhouse ring    | `greenhouseRing` | Domes for more crops           | A ring of greenhouse domes around the growers.                            |
| Workshop crane     | `workshopCrane`  | A crane for heavy lifts        | A big gantry crane for the workshop.                                      |
| Salvage beacons    | `salvageBeacons` | Helps find lost things         | Bright beacons so lost things are easy to find.                           |
| Nursery beacon     | `nurseryBeacon`  | A light for resting calves     | A soft light where whale calves can rest.                                 |
| Current-map buoys  | `currentBuoys`   | Marks the currents             | Humming buoys that map the whales' current.                               |
| Quiet crossing     | `quietCrossing`  | Give the whales room to pass   | Waiting lights give pilots a place to pause while families pass.          |
| Channel lights     | `channelLights`  | Lights the practice channel    | Soft lamps so young pilots can practise any time.                         |
| Loom hall          | `loomHall`       | A place to teach pilots        | A teaching hall for young Avi pilots.                                     |
| Practice berth     | `practiceBerth`  | A place to watch and try again | Learners can rest and watch how another pilot takes the first turn.       |
| Courier school     | `courierSchool`  | Trains careful couriers        | A training dock where new couriers learn to fly safely.                   |
| Spare beacon       | `spareBeacon`    | A backup guide light           | A spare beacon, ready if the chain ever goes dark.                        |
| Route exchange     | `routeExchange`  | Share notes between couriers   | A lit board for route notes, warnings and corrections from passing crews. |
| Second docking bay | `dockingBay`     | No miner waits alone           | A second docking bay at the mining hub.                                   |
| Hub repairs        | `hubRepairs`     | Repairs the mining hub         | Patches and new lights for the mining hub.                                |

Effect lines use the keys `projectEffectGreenhouse`, `projectEffectCrane`,
`projectEffectBeacons`, `projectEffectDockingBay`, `projectEffectHubRepairs`,
`projectEffectNursery`, `projectEffectCurrentBuoys`, `projectEffectCourierSchool`,
`projectEffectSpareBeacon`, `projectEffectChannelLights` `projectEffectLoomHall`, `projectEffectQuietCrossing`, `projectEffectPracticeBerth` and
`projectEffectRouteExchange`; descriptions use the
same suffixes after `projectAbout`.

## Quantum jump home

When the shield is depleted, Astra quantum jumps the ship home to Earth so it can
recharge overnight. The cost is only the inconvenience: the flight ends, the
galaxy's layout regenerates on the next flight, and open-space enemies, pickups,
all undeposited ore and a towed pod are lost. The jump-home page says when ore was lost.
Going home or jumping to another galaxy by choice keeps all ore. Accepted jobs stay open, each with its carried item (see [Rules](rules.md)). Ada
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
| `undock`             | Undock                                                                    |
| `stationWelcome`     | Welcome aboard. Trade your Stardust, or take a job.                       |
| `inUse`              | In use                                                                    |
| `paintClassic`       | Classic                                                                   |
| `paintCobalt`        | Cobalt                                                                    |
| `paintSeafoam`       | Seafoam                                                                   |
| `paintGraphite`      | Crimson                                                                   |
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
| `detailUnlimited`    | Unlimited                                                                 |
| `detailIncludesAmmo` | Comes with 3 ammo packs.                                                  |
| `detailClose`        | Close                                                                     |

## Exchange

Exchange is a Station section with Buy Stardust and Buy ore. Each offers
1, 10 and 100 units received. A purchase costs twice the received amount in
the other resource. Each action checks the current balances and applies both
updates atomically, or refuses without change. Exchange takes effect
immediately and has no amount input or confirmation.

Ore is one fungible balance regardless of origin. Buying ore is an exchange,
not a pickup or mining event. All carried ore follows the existing shield-fuel,
sale, loss and deposit rules, including ordinary deposit progress.
