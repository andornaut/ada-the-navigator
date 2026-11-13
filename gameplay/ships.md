# Ships

Every ship, Ada's and each enemy archetype, has physics defined in data with the
same fields and the same movement model. All values are provisional tuning.

## Physics

| Field                 | Meaning                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `maxSpeed`            | Maximum speed in world units per second                                    |
| `accelerationSeconds` | Exponential time constant for velocity to approach a non-zero target       |
| `brakingSeconds`      | Exponential time constant for velocity to approach zero with no target     |
| `turnSeconds`         | Exponential time constant for the movement heading to turn toward a target |
| `aimTurnSeconds`      | Exponential time constant for the aim direction to turn toward a target    |

Movement is the same for every ship. The requested direction (Ada's stick, or an
enemy's steering result) sets a target heading. While moving, the heading turns
toward it along the shorter arc with `turnSeconds`. From rest, Ada's heading
starts on the target directly; an enemy's heading starts from its hull facing, so
it turns into motion instead of sliding sideways. Velocity approaches `heading * speed` with `accelerationSeconds`,
or approaches zero with `brakingSeconds` when there is no target. A ship with no
target comes to rest once it is below 1% of its maximum speed. The aim direction
turns toward its target with `aimTurnSeconds`, and shots leave along the current
aim direction at the weapon's normal cadence. Thrust jets scale with current speed
as a fraction of the ship's maximum speed.

Ada's ship faces its aim while aiming and its movement otherwise. Enemy hulls
face their velocity direction, turning toward it with the shared
`hullTurnSeconds` of 0.08 so collision slides do not snap, and keep their last
facing when stopped. Because an enemy's heading starts from its hull and turns with
`turnSeconds`, its velocity and hull swing round together. Most mobile enemies
patrol when unengaged, investigate a fixed last-seen position after losing actual
line of sight, and resume patrol there. Returning craft investigate home and
patrol instead of stopping within five world units. Patrol and investigation use
smooth seeded routes, with tuning relative to each ship's existing combat speed
([Enemy navigation](enemies.md#patrol-and-investigation)). Platforms remain
stationary; disabled or salvaged ships do not navigate, and ships with no working
engines coast to rest. Each weapon's aim starts on its first target and then turns with
`aimTurnSeconds`. Hardpoint hit areas and fire origins rotate with the
hull. Hardpoint and hull weapons aim independently of the hull with
`aimTurnSeconds`. An enemy's facing is saved with its other state.

## Values

| Ship          | Size (Ada widths) | `maxSpeed` | `accelerationSeconds` | `brakingSeconds` | `turnSeconds` | `aimTurnSeconds` |
| ------------- | ----------------: | ---------: | --------------------: | ---------------: | ------------: | ---------------: |
| Ada           |                 1 |        175 |                  0.36 |             0.55 |          0.16 |             0.08 |
| `swarm`       |              0.65 |        160 |                  0.20 |             0.25 |          0.12 |             0.10 |
| `fighter`     |                 1 |        140 |                  0.40 |             0.50 |          0.30 |             0.15 |
| `interceptor` |              0.75 |        200 |                  0.90 |             1.20 |          0.60 |             0.12 |
| `retaliator`  |                 2 |         90 |                  1.20 |             1.50 |          0.90 |             0.35 |
| `frigate`     |                 4 |         80 |                   1.5 |              2.0 |           1.2 |             0.40 |
| `capital`     |                 5 |         40 |                   2.5 |              3.0 |           2.0 |             0.50 |
| `platform`    |                 3 |          0 |                     – |                – |             – |             0.30 |

Ada's 175 is her base engine; engine levels 2 and 3 raise it to 200 and 225.
Her aim turns with `aimTurnSeconds` 0.08, 0.07 and 0.06 at engine levels 1, 2
and 3, and her movement heading turns twice as slowly, with `turnSeconds` 0.16,
0.14 and 0.12.
Enemy speeds are fixed and the same in every galaxy: a new Ada outruns the swarm
and the interceptor outruns her, engine level 2 keeps pace with the interceptor
and outruns every other enemy, and level 3 outruns them all. Ada's ship has noticeable momentum: it takes about a second to reach full speed,
coasts for about a second and a half when the stick is released, and swings wide on sharp
turns. Small enemies are nimble, the interceptor is fast but carries its momentum
through overshooting passes, and larger ships are progressively heavier.
The `platform` is fixed in place and only turns its turrets.

## Behaviours

Enemy movement comes from a data-driven behaviour library, so each archetype
mixes and matches behaviours and their parameters. Small craft fight with their
weapons, not their hulls: each holds a standoff band from Ada, strafing sideways
and firing, and backs off when she comes inside it. They never press in to ram.

| Archetype     | Standoff band (world units)                                                             |
| ------------- | --------------------------------------------------------------------------------------- |
| `swarm`       | 200–300                                                                                 |
| `fighter`     | 250–350                                                                                 |
| `retaliator`  | 250–350                                                                                 |
| `interceptor` | 150–250 with `chase` or `hitAndRun`; with `strafe`, firing passes never closer than 150 |

| Behaviour   | Movement                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------- |
| `chase`     | Closes to its standoff band, then holds there, strafing sideways and firing.                 |
| `hitAndRun` | Rushes to the near edge of its band, fires a burst, pulls out past the far edge, comes back. |
| `strafe`    | Makes firing passes beside Ada, carried by momentum, then loops back for another pass.       |
| `swarm`     | Holds its band with erratic wobble and peer separation, so a pack rings Ada at range.        |
| `flee`      | Bounded morale retreat after low hull or pack losses, followed by gated recovery.            |
| `retaliate` | Patrols without attacking Ada until hit, then switches to its attack behaviour.              |
| `escort`    | Stays near its capital and intercepts Ada when she comes close to it.                        |
| `siege`     | Advances slowly on Ada while its hardpoint turrets fire; used by frigates and capitals.      |

Provisional parameters: `hitAndRun` retreats after 3 volleys or a hit, using
its independent bounded retreat policy. Morale and `hitAndRun` share initial
limits of 1.6 seconds or 200 world units of displacement, up to 0.5 radians of
seeded curvature and a six-second cooldown, with per-policy overrides. These are
approved follow-up values pending source integration, not a release claim.
Recovery requires actual line of sight, perception, engagement admission and the
home leash; otherwise fixed last-seen investigation gives way to home patrol
([Retreat policy](enemies.md#bounded-retreat-follow-up)). `strafe` passes no closer
than 150 world units and loops back beyond 420; `siege`
advances at half top speed; `escort` holds station 60 beyond its capital's hull,
intercepts Ada within 600 and falls back to `hitAndRun` without its capital.
A ship that touches Ada still bounces off without damage. Finite pursuit and
return home still apply.
When an encounter regenerates, its survivors are restored by role, so a destroyed
capital never returns as an escort or the reverse. The first galaxy is mildly
more aggressive than the base catalog, and difficulty rises along the route (see
[Difficulty](#difficulty)). Escorts also fall back when their capital is disabled.

## Difficulty

Difficulty rises from the first galaxy to the sixth along six levers: tougher
enemies, stronger enemy weapons, better aim, denser encounters, more and
better-armed heavies, and more aggressive behaviour. Each galaxy's roster sets its encounters and
behaviours. Everything in this section follows route position, so a galaxy moved
along the route keeps its roster and takes its new position's difficulty. Ada keeps
pace by buying shield, weapon and engine upgrades, and by flying better. The
target is that a fully upgraded Ada at position 6 meets about the same pressure as
a new Ada at position 1.

One tuning value, `difficultyScale` (1), multiplies every enemy hit point, the
fire rate and the encounter rate at every position, so the whole curve can be
tuned at once. Stardust drops use the unscaled hit points, so tuning it leaves
the economy unchanged. It is not a player setting: there is one forgiving difficulty.

Damage and hit points share one unit: 1 damage removes 1 HP. A level 1 Laser shot
deals 1 damage.

Small craft:

| Position | `swarm` | `fighter` | `interceptor` | `retaliator` | Group bonus | Lead | Notice |  Fire | Encounters |
| -------: | ------: | --------: | ------------: | -----------: | ----------: | ---: | -----: | ----: | ---------: |
|        1 |       2 |         4 |             3 |            8 |          +1 |  20% |   +20% |  +44% |       +50% |
|        2 |       2 |         5 |             3 |            9 |          +1 |  40% |   +30% |  +63% |       +63% |
|        3 |       3 |         5 |             4 |           10 |          +2 |  60% |   +40% |  +81% |       +69% |
|        4 |       3 |         6 |             4 |           11 |          +2 |  80% |   +45% |  +88% |       +75% |
|        5 |       3 |         6 |             5 |           11 |          +3 |  90% |   +50% |  +94% |       +75% |
|        6 |       3 |         6 |             5 |           12 |          +3 | 100% |   +50% | +100% |       +75% |

Heavies:

| Position | Hardpoint | `frigate` hull | Frigate weapons | `capital` hull | Capital weapons | Heavy share |
| -------: | --------: | -------------: | --------------: | -------------: | --------------: | ----------: |
|        1 |         4 |             20 |               2 |             40 |               4 |          ×1 |
|        2 |         4 |             22 |               2 |             44 |               4 |          ×1 |
|        3 |         5 |             30 |               3 |             60 |               6 |        ×1.2 |
|        4 |         5 |             32 |               3 |             64 |               6 |        ×1.3 |
|        5 |         6 |             44 |               4 |             88 |               8 |        ×1.4 |
|        6 |         6 |             48 |               4 |             96 |               8 |        ×1.5 |

- Small-craft columns are hull HP. Outside Sunflower's staged ambient roster,
  the group bonus adds to both ends of each `swarm` and `fighter` group range. Lead is how much of Ada's movement enemy
  aim allows for (see [Enemy aim](#enemy-aim)). Notice, fire and encounter rates are
  relative to the base catalog.
- Every heavy hardpoint (weapon, engine, command and platform turret) has the
  position's hardpoint HP. A `platform` hull has half the frigate hull.
- Heavy share multiplies the roster's `frigate` and `capital` weights; the weights
  then renormalize. Placed platforms are not weighted.

### Enemy aim

Enemy aim is natural rather than perfect, and every aimed enemy weapon follows it:

- **Lead skill:** each enemy keeps one lead skill for its life: its position's
  Lead, varied by about 10% either way per ship.
- **Prediction:** it aims at where Ada will be when the shot arrives, from her
  velocity averaged over about the last 0.3 seconds, scaled by its lead skill;
  50% aims halfway between where she is and where she will be. A sudden jink
  makes its shots trail briefly before they catch up.
- **Drift:** a slow sideways drift, up to about 4 degrees either side of the line
  of fire, changing smoothly over a second or two, never random per shot.
- **Limits:** a shot never aims behind Ada's current position, and the lead never
  exceeds about 1 second of her movement.
- **Direct aim:** hitscan beams and the lance's tracking line aim at Ada directly.

### Enemy weapons

Enemies fire the same weapons Ada does, plus three weapons only they carry. Every
enemy weapon is level 1, with Ada's level 1 damage, blast, spread and reach (see
[Flight and combat](rules.md#flight-and-combat)), so no enemy hit grows with the
route. Each enemy's fire cadence stays its own and its projectiles fly at 0.6 times
Ada's level 1 speed, so attacks
stay readable and dodgeable. Enemies carry no ammunition. Enemy pressure rises
with position through fire rate, aim lead, group sizes, encounter rates and heavy
weapon mounts, not weapon levels. Enemy damage has no cap; the pacing simulation
reports each weapon's kill times against frigates and capitals.

| Archetype     | Positions 1–2 | Positions 3–4 | Positions 5–6 |
| ------------- | ------------- | ------------- | ------------- |
| `swarm`       | Laser         | Laser         | Laser         |
| `fighter`     | Laser         | Rapid Missile | Rapid Missile |
| `interceptor` | Laser         | Multi-Laser   | Multi-Laser   |
| `retaliator`  | Multi-Laser   | Multi-Laser   | Multi-Laser   |
| `platform`    | 2 × Laser     | 2 × Laser     | 2 × Laser     |

Small craft carry only Laser, Multi-Laser and Rapid Missile. Heavy Missile,
Phaser and Scattershot are reserved for frigates and capitals; a heavy's
Scattershot is point defense against craft that come close, and Ada avoids it
by keeping her distance.

Each frigate and capital carries at most three weapon types, picked from its
position's pool and seeded by the ship, so a ship keeps its weapons across save
and resume. The enemy-only weapons count as types. Its weapon mounts (the
Heavies table's weapon count) are shared out in turn among its types, with at
most one mount each of Heavy Missile, Phaser, ring burst, mine layer and charged
lance; extra mounts go to its other types. A pool smaller than three gives every
type in it.

| Heavy     | Positions 1–2                     | Positions 3–4                                                 | Positions 5–6                                                                    |
| --------- | --------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `frigate` | Laser, Multi-Laser, Rapid Missile | Laser, Multi-Laser, Rapid Missile, Scattershot                | Laser, Rapid Missile, Scattershot, Heavy Missile, charged lance                  |
| `capital` | Laser, Multi-Laser, Rapid Missile | Laser, Multi-Laser, Rapid Missile, Heavy Missile, Scattershot | Laser, Rapid Missile, Heavy Missile, Phaser, Scattershot, ring burst, mine layer |

Heavy Missile and Phaser hits are large, so an
enemy Heavy Missile flies slowly and its Phaser shows a thin aim line for 0.4
seconds before the beam fires. The aim line stays where it started, so Ada can
move off it.

| Enemy weapon  | Interval | Projectile speed | Notes                                                |
| ------------- | -------: | ---------------: | ---------------------------------------------------- |
| Laser         |    1.4 s |              300 | `swarm` 1.8 s; platform two-shot bursts 0.15 s apart |
| Multi-Laser   |    2.2 s |              240 | The level's fan                                      |
| Rapid Missile |    2.0 s |              300 | Its blast damages Ada                                |
| Heavy Missile |    4.0 s |              240 | Its blast damages Ada                                |
| Scattershot   |    2.4 s |              360 | Ada's dot count, range and fade                      |
| Phaser        |    3.0 s |          Hitscan | 0.4 s aim line first                                 |

Intervals are before the position's fire rate. An enemy projectile flies at 0.6 times
Ada's level 1 speed for that weapon, in world units per second, with no cap. Damage is Ada's level 1
damage for that weapon. The three enemy-only weapons:

- **Ring burst:** 8 bolts outward in a ring, 1.5 damage each, every 3.5 seconds,
  at 240 world units per second.
- **Mine layer:** drops a stationary mine behind the ship every 5 seconds, at most
  4 at a time. A mine deals 3 damage when Ada's drawn ship touches its drawn
  silhouette, then is gone; Ada's shots
  destroy mines (1 HP), and mines vanish after 20 seconds.
- **Charged lance:** every 6 seconds, a beam as long as the game area is wide.
  A thin line tracks Ada for 0.7 seconds, then holds still for 0.3 seconds, then
  the beam fires along it for 3 damage. It stops at the first obstacle, like the Phaser.

Tell lines (the lance's tracking and locked lines and the Phaser's aim line) stop
at the first obstacle, as their beams do, so cover reads. The ring burst has no
warning; its emission shows only as it fires.

### Heavy hull and disabling

Frigates, capitals and platforms have hull HP and hardpoints.

- **Damage:** every hit on a heavy reduces its hull HP, including hits on a
  hardpoint, which also damage that hardpoint.
- **Destroyed:** at 0 hull HP the ship breaks apart and drops twice its Stardust
  and no upgrade (see [Economy](economy.md#earning-stardust)).
- **Disabled:** when every weapon hardpoint is destroyed, the ship is disabled,
  whatever its hull HP. It stops attacking and steering, coasts to rest, no longer
  counts for battle, and shows a red "Disabled" banner above its hull.
- **Salvage:** within Talk range of a disabled heavy, Use offers Salvage. Salvaging drops the
  ship's Stardust, half what destroying it gives, and has the heavy upgrade chance, and
  spares the ship: it powers down, its banner goes, it is drawn dimmed,
  and shots and Ada pass through it. Ada can instead keep shooting a disabled ship
  until its hull breaks, for more Stardust and no upgrade.
- **Engines and command:** each engine still provides an equal share of thrust.
  A heavy that loses all its engines coasts to rest like a disabled heavy,
  keeping its momentum and slowing to a stop. Command parts never fire and do not count toward disabling.
- **Mounts:** Art draws each heavy class once, with every weapon mount it can
  carry, and a turret for each weapon a mount can hold. A mount the position
  leaves unused is drawn as a capped plate with no hardpoint. General Gadget's flagship has its own, more threatening design.
- **State:** hull HP, hardpoints, disabled and salvaged states are retained like
  other heavy state until the galaxy regenerates. A salvaged heavy stays where
  Ada left it: like a destroyed one, it no longer holds the spacing kept between
  capital ships, and nothing moves it.

## Ambient admission

Ambient encounters use a 900-world-unit local admission radius. Whole groups,
including every escort and hull, must fit the budget and archetype limit, with
at most one nearby capital. Admission conservatively counts live neighbouring
hulls whose footprints could share that neighbourhood, including required
guards, old packs and pursuing ships. Disabled hulls still count; salvaged ships
do not. Only complete groups that fit are eligible for weighted selection.

| Galaxy    | Local budget | Archetype limit |
| --------- | -----------: | --------------: |
| Whirlpool |            6 |               2 |
| Needle    |            7 |               3 |
| Andromeda |            8 |               4 |
| Cartwheel |            9 |               4 |
| Phantom   |           10 |               4 |

Later galaxies use their encounter tables, including route-position group bonuses
and heavy weights. Spawn-cell frequency remains independent of admission.
These budgets are not strict physical population caps: subsequent movement can
bring ships together. They do not freeze or despawn existing enemies.

New sight-triggered engagement is admitted separately, reserving required and
persistent enemies and already engaged enemies first. Only the new sighted
engagement term is gated; existing engaged AI, damage and summons, and returning
ships' rearm behaviour remain unchanged. Speeds and damage are unchanged.

## Sunflower roster

Fresh exploration distance selects Sunflower's ambient stage. These exact group
ranges receive no route-position group bonus. Weights are relative among eligible
complete groups; a type absent from a stage cannot spawn ambiently.

| Fresh distance (world units) | Local budget | Archetype limit | Swarm group / weight | Fighter group / weight | Retaliator group / weight | Interceptor group / weight |
| ---------------------------: | -----------: | --------------: | -------------------- | ---------------------- | ------------------------- | -------------------------- |
|                            0 |            3 |               1 | 1–2 / 0.55           | 1 / 0.45               | None                      | None                       |
|                         1800 |            4 |               2 | 2–3 / 0.45           | 1–2 / 0.40             | 1 / 0.15                  | None                       |
|                         4200 |            5 |               2 | 2–3 / 0.40           | 1–2 / 0.35             | 1 / 0.15                  | 1 / 0.10                   |

No stage admits ambient frigates or capital battles. Required guards remain.
Swarm packs use `swarm` and flee after losses; fighters use `hitAndRun` and share
pack morale; retaliators use `retaliate`, then `chase`, with a three-bolt spread;
interceptors use `strafe`. Values not listed keep their catalog values. Each
galaxy below has its own roster. All values are provisional playtest tuning.

## Whirlpool roster

Whirlpool's drones are hunters tracking the whale family, which knows where the
holodisk drifted. They chase rather than hit and run.

| Archetype      | Encounter    | Group | Weight | Behaviours                                   |
| -------------- | ------------ | ----: | -----: | -------------------------------------------- |
| `swarm`        | Pack         |   5–8 |   0.25 | `swarm`; packs `flee` after losses           |
| `fighter`      | Hunting pack |   3–4 |   0.30 | `chase`; a group shares pack morale          |
| `interceptor`  | Solo or pair |   1–2 |   0.15 | `chase`                                      |
| `retaliator`   | Solo         |     1 |   0.10 | `retaliate`, then `chase`; three-bolt spread |
| `frigate`      | Solo         |     1 |   0.15 | `siege`; size 4 Ada widths                   |
| Capital battle | Group        |     1 |   0.05 | A `capital` with 4 `escort` fighters         |

Hunting packs are placed near whale destinations and along the calf-guiding
route. Hunters never target or damage whales; their shots pass through them.
Space currents push small craft and leave frigates and capitals unaffected (see
[the version one rules](rules.md#galaxy-two-whirlpool-whale-family)). Whirlpool adds no new
archetype: currents change how the existing ones fight.

## Needle roster

Needle's drones gather at the mouths of its narrow channels and fly fast passes.

| Archetype      | Encounter | Group | Weight | Behaviours                                   |
| -------------- | --------- | ----: | -----: | -------------------------------------------- |
| `swarm`        | Pack      |   6–8 |   0.20 | `swarm`; packs `flee` after losses           |
| `fighter`      | Patrol    |   3–4 |   0.25 | `chase`; a group shares pack morale          |
| `interceptor`  | Pair      |     2 |   0.25 | `strafe`                                     |
| `retaliator`   | Solo      |     1 |   0.08 | `retaliate`, then `chase`; three-bolt spread |
| `frigate`      | Solo      |     1 |   0.15 | `siege`; size 4 Ada widths                   |
| Capital battle | Group     |     1 |   0.07 | A `capital` with 5 `escort` fighters         |

No encounter is placed
inside a gate run's channel; a pack waits at the Eye's exit.

## Andromeda roster

Andromeda's drones hunt in the open, in larger patrols with more frigates.

| Archetype      | Encounter    | Group | Weight | Behaviours                                   |
| -------------- | ------------ | ----: | -----: | -------------------------------------------- |
| `swarm`        | Pack         |   6–8 |   0.20 | `swarm`; packs `flee` after losses           |
| `fighter`      | Patrol       |   3–4 |   0.30 | `hitAndRun`; a group shares pack morale      |
| `interceptor`  | Pair         |     2 |   0.15 | `strafe`                                     |
| `retaliator`   | Solo         |     1 |   0.10 | `retaliate`, then `chase`; three-bolt spread |
| `frigate`      | Solo or pair |   1–2 |   0.18 | `siege`; size 4 Ada widths                   |
| Capital battle | Group        |     1 |   0.07 | A `capital` with 4 `escort` fighters         |

Drones never target
the courier Pip or the settlers' ships.

## Cartwheel roster

Cartwheel's drones are claim jumpers: they gather at ore fields and hit and run
any miner who comes near, Ada included. Fixed turret platforms guard ore fields.

| Archetype      | Encounter       | Group | Weight | Behaviours                                                     |
| -------------- | --------------- | ----: | -----: | -------------------------------------------------------------- |
| `swarm`        | Pack            |   5–7 |   0.25 | `swarm`; packs `flee` after losses                             |
| `fighter`      | Claim jumpers   |   2–4 |   0.40 | `hitAndRun`; a group shares pack morale                        |
| `interceptor`  | Solo or pair    |   1–2 |   0.12 | `hitAndRun`                                                    |
| `retaliator`   | Solo            |     1 |   0.10 | `retaliate`, then `chase`; three-bolt spread                   |
| `frigate`      | Solo            |     1 |   0.10 | `siege`; size 4 Ada widths                                     |
| Capital battle | Group           |     1 |   0.03 | A `capital` with 4 `escort` fighters                           |
| `platform`     | Ore-field guard |     1 |      – | `siege` at speed 0: two required turrets; placed, not weighted |

An ore field is a seeded cluster of 6 to 10 resource-bearing rocks about 900
world units across, placed like stations: at least 3000 world units apart and
1500 from the hub, stations and quantum jump arrivals. A field holds only its
resource rocks: chunk generation keeps ordinary asteroids out of a 600 world
unit radius around its centre, its 450 radius plus a 150 margin. Half of claim-jumper
groups are placed at ore fields.

The `platform` is Cartwheel's one new archetype: fixed guards need a ship that
holds its position, and every existing archetype moves. It reuses `siege`, whose
turrets fire while it advances, with no speed to advance.

- **Placement:** one platform stands at the edge of at most half of the ore
  fields, chosen by the seed, so unguarded ore is always available. Its hull is one drawn frame
  that never rotates and has no thrust jets.
- **Parts:** two turrets, each with the position's hardpoint HP, and a hull with
  half the frigate hull ([Heavy hull and disabling](#heavy-hull-and-disabling)).
  Hit areas, turret mounts and muzzles come from Art's drawn hardpoints, as for
  the frigate and capital, and the hull's hit circle follows the size column.
- **Fire:** each live turret aims independently with `aimTurnSeconds` and fires
  a two-shot burst of the position's Laser, 0.15 seconds between shots, every 1.4
  seconds before the position's fire rate while Ada is within 520 world units.
  It stops firing beyond 520 and never pursues.
- **State:** retained like a frigate, so destroyed turrets and a disabled,
  salvaged or destroyed platform persist until the galaxy regenerates. Ada
  bounces off it on contact until it is salvaged. It drops Stardust by the heavy
  rule and has the heavy upgrade chance.

## Phantom roster

Phantom's drones are Gadget's home guard: heavier, and they chase.

| Archetype      | Encounter    | Group | Weight | Behaviours                                   |
| -------------- | ------------ | ----: | -----: | -------------------------------------------- |
| `swarm`        | Pack         |   6–8 |   0.18 | `swarm`; packs `flee` after losses           |
| `fighter`      | Home guard   |   3–5 |   0.25 | `chase`; a group shares pack morale          |
| `interceptor`  | Pair         |     2 |   0.15 | `strafe`                                     |
| `retaliator`   | Solo         |     1 |   0.07 | `retaliate`, then `chase`; three-bolt spread |
| `frigate`      | Solo or pair |   1–2 |   0.25 | `siege`; size 4 Ada widths                   |
| Capital battle | Group        |     1 |   0.10 | A `capital` with 6 `escort` fighters         |

Blockades and the finale's waves draw from this roster (see
[the version one rules](rules.md#galaxy-six-phantom-the-finale)). Once the
chapter is complete, Phantom places no new encounters.

## Gadget's flagship

General Gadget's flagship is a `capital` in his own design, the only crewed ship in
his fleet.

- **Hull and parts:** 160 hull HP; command, two engines and 8 weapon mounts, each
  hardpoint 8 HP. Its weapons come from the position 6 capital pool, as for any
  capital ([Enemy weapons](#enemy-weapons)). Its hull never drops below 1 HP, so
  it is beaten only by disabling.
- **Movement:** `siege` at a quarter of its top speed, staying within 800 world
  units of the waypoint.
- **Escorts:** 8 `escort` fighters, which hold back with it until the third wave
  is gone.
- **Salvage:** salvaging it gives the last holodisk and its Stardust by the heavy
  rule, then the story scene plays. It never regenerates.

## Finale allies

Allies join only the Phantom fleet battle and flagship fight. Each funded
community project makes one project ally ([Economy](economy.md#donations)), and
completing a galaxy's repeatable activity at least once makes its quest ally:

| Galaxy    | Quest ally         | Behaviour               |
| --------- | ------------------ | ----------------------- |
| Sunflower | Clover's barge     | `escort`                |
| Whirlpool | Marlo, the whale   | Whale, with song        |
| Needle    | Reed's glider      | `escort`                |
| Andromeda | Pip's courier ship | `escort`                |
| Cartwheel | Mica's mining ship | `chase` against turrets |

- **Arrival:** the allies Ada has made jump in beside her with the usual jump
  effect when the battle begins, and jump out when the flagship is salvaged or
  the flight ends. At most 8 allies are on screen at once. The rest rotate in: at the
  start of each later wave and of the flagship fight, allies that have not yet
  flown jump in and replace ones that have, so every ally takes part.
- **Look:** allies show thrust jets like every ship and get no edge markers,
  like other friendly objects Ada flies through.
- **Safety:** drones never target allies, allies take no damage, and Ada and shots
  pass through them, with Ada drawn in front.
- **Fire:** an ally that fires uses level 2 Laser every 1.4 seconds at the drone
  its behaviour picks.
- **`escort`:** escorts share a ring around Ada, at least 60 world units beyond
  her drawn ship and wider as more escorts join, so neighbouring escorts' drawn
  ships stay at least 16 world units apart. Their slots sit at equal angles
  starting behind her and turn with her heading. Each escort leaves its slot to
  intercept a drone within 600 of her and returns to it.
- **`chase` against turrets:** chases the nearest heavy and aims at its weapon
  hardpoints.
- **Whale:** a whale never fires and follows 250 world units behind Ada, side by
  side with any other whale, moving like the calf.
- **Song:** drones within 300 world units of Marlo move at three quarters of
  their top speed. A faint rim marks the song's reach, and a slowed drone shows
  a ring beneath it; both hold steady under reduced motion.

## Presentation

All art is one shared asset bank. Each galaxy's data references shared asset ids
rather than owning its art, so an asset can move between galaxies where it suits
that galaxy's field; story-bound content such as Sunflower's three outposts stays
with its galaxy. Each galaxy still gives its enemy ships one coherent visual
family. Placement: Sunflower keeps the coral drones and its three
outposts; the current trading station, discovery cache, frigate and capital art is
tuned for Cartwheel. Sunflower's gameplay still has stations, caches, frigates and
its capital battle, drawn with pastel-tuned versions that read on its yellow field,
and reusing the shared Cartwheel-tuned assets until those exist. Asteroid sprites
match the collision radii: small 12 to 18, medium 24 to 34, large 52 to 70 and huge
84 to 104 world units; large and huge rocks keep their silhouette radius plus 160 clear
of stations, destinations and launch points. Shapes stay simple and
readable at display size, with distinct silhouettes by role: a small darting
swarm craft, a baseline fighter, a long narrow interceptor and a broad heavy
retaliator. Enemy ships read as hostile and stay distinct from Ada's white and
blue ship. Sunflower craft are drawn with 16 heading frames: the model facing
stays continuous and the nearest frame is drawn. A ship drawn with frames and
hardpoints uses the drawn frame's facing for its hardpoint hit areas and muzzles. The size column sets the hit circle's diameter: the mean of the drawn sprite's
length and width, so hits match what is drawn. Sprites keep their drawn sizes.
