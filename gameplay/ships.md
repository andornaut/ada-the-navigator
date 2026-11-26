# Ships

Every ship, Ada's and each enemy archetype, has physics defined in data with the
same fields and the same movement model. All values are provisional tuning.

## Physics

| Field                 | Meaning                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `maxSpeed`            | Maximum speed in world units per second                                                              |
| `accelerationSeconds` | Exponential time constant for velocity to approach a non-zero target                                 |
| `brakingSeconds`      | Exponential time constant for velocity to approach zero with no target                               |
| `turnSeconds`         | Exponential time constant for the movement heading to turn toward a target                           |
| `aimTurnSeconds`      | Exponential time constant for the aim, or a nose-on forward-gun ship's hull, to turn toward a target |

Movement is the same for every ship. The requested direction (Ada's stick, or an
enemy's steering result) sets a target heading. While moving, the heading turns
toward it along the shorter arc with `turnSeconds`. From rest, Ada's heading
starts on the target directly, as does a forward-gun ship's while its nose is on Ada;
any other enemy's heading starts from its hull facing, so it turns into motion
instead of sliding sideways. Velocity approaches `heading * speed` with `accelerationSeconds`,
or approaches zero with `brakingSeconds` when there is no target. A ship with no
target comes to rest once it is below 1% of its maximum speed. The aim direction
turns toward its target with `aimTurnSeconds`, and shots leave along the current
aim direction at the weapon's normal cadence. Thrust jets scale with current speed
as a fraction of the ship's maximum speed.

Ada's ship faces its aim while aiming and its movement otherwise. Enemy facing
depends on how a ship mounts its weapons:

- **Forward-gun ships:** the swarm, fighter, interceptor and retaliator carry
  fixed forward hull weapons and no turrets, and fire only from the nose, like
  Ada. While engaged and seeing Ada within its engagement range, a forward-gun
  ship keeps its nose on her: its hull turns toward its aim point
  ([Enemy aim](#enemy-aim)) with its class's `aimTurnSeconds`, and it strafes,
  sliding sideways or backing off. Its movement heading still turns toward the
  steering request with `turnSeconds`, and its requested speed is capped by
  direction relative to the facing ([Nose fire](#nose-fire)); momentum above the
  cap decays with `accelerationSeconds`. It fires along its facing, and only
  while its aim point lies inside its nose arc; its weapon cooldown keeps running
  meanwhile, so it fires as soon as Ada enters the arc.
- **Breaking off and travel:** a forward-gun ship that is not keeping its nose on
  Ada faces its velocity like a turret ship and holds fire until it faces Ada
  again. It breaks off in a `hitAndRun` pull-out, a morale retreat, a return
  home and an interceptor's `strafe` pass after closest approach, and travels
  when closing from beyond its engagement range, investigating or patrolling.
- **Turret ships:** frigates and capitals always face their velocity direction,
  turning toward it with the shared `hullTurnSeconds` of 0.08 so collision
  slides do not snap, and keep their last facing when stopped. Because the
  heading starts from the hull and turns with `turnSeconds`, velocity and hull
  swing round together, so a turret ship turns around to leave. Its turrets
  track Ada independently of the hull with `aimTurnSeconds` and fire in any
  direction, astern included. Their fixed front Lasers fire only along the
  facing, while their aim point is within the 20-degree nose arc, so they never
  turn the hull toward Ada. Platforms and hostile stations never move and keep a
  fixed facing; their turrets track the same way.

Most mobile enemies patrol when unengaged, investigate a fixed last-seen position
after losing actual line of sight, and resume patrol there. Returning craft investigate home and
patrol instead of stopping within five world units. Patrol and investigation use
smooth seeded routes, with tuning relative to each ship's existing combat speed
([Enemy navigation](#patrol-and-investigation)). Platforms remain
stationary; disabled or salvaged ships do not navigate, and ships with no working
engines coast to rest. Each turret's aim starts on its first target and then
turns with `aimTurnSeconds`. Hardpoint hit areas and fire origins rotate with the
hull. An enemy's facing is saved with its other state.

## Values

| Ship          | Span (Ada widths) | `maxSpeed` | `accelerationSeconds` | `brakingSeconds` | `turnSeconds` | `aimTurnSeconds` |
| ------------- | ----------------: | ---------: | --------------------: | ---------------: | ------------: | ---------------: |
| Ada           |                 1 |        175 |                 0.413 |            0.693 |          0.16 |             0.08 |
| `swarm`       |               0.8 |        175 |                  0.20 |             0.25 |          0.12 |             0.10 |
| `fighter`     |                 1 |        160 |                  0.40 |             0.50 |          0.30 |             0.15 |
| `interceptor` |                 1 |        240 |                  0.90 |             1.20 |          0.60 |             0.12 |
| `retaliator`  |    3 (Hauler 2.5) |        120 |                  1.20 |             1.50 |          0.90 |             0.35 |
| `frigate`     |                 5 |        100 |                   1.5 |              2.0 |           1.2 |             0.40 |
| `capital`     |                 6 |         50 |                   2.5 |              3.0 |           2.0 |             0.50 |
| `platform`    |                 4 |          0 |                     – |                – |             – |             0.30 |

Ada's top speeds are 175, 200 and 225 world units per second. From rest with
full throttle in a straight line, she reaches 90% speed in 0.95, 0.80 and
0.65 seconds. Releasing movement from full speed coasts about 120 world units
at every level in clear space, taking about 3.19, 2.79 or 2.48 seconds to
reach the existing 1% rest threshold. The time constants derive from
`timeTo90 / ln(10)` for acceleration and `120 / (0.99 * topSpeed)` for braking.
Her aim turns with `aimTurnSeconds` 0.08, 0.07 and 0.06 at engine levels 1, 2
and 3, and her movement heading turns twice as slowly, with `turnSeconds` 0.16,
0.14 and 0.12.
A forward-gun ship's `aimTurnSeconds` turns its hull while its nose is on Ada; a
turret ship's turns its turrets.
Enemy base top speeds are the same in every galaxy. A swarm matches Ada's
level-one top speed. The interceptor's top speed exceeds Ada's at every engine
level. The finale flagship shares the capital's 50-unit top speed and moves at
its existing siege fraction. Ada swings wide on sharp turns. Small enemies are
nimble, interceptors carry momentum through passes, and larger ships are
progressively heavier.
The `platform` is fixed in place and only turns its turrets.

### Nose fire

| Ship          | Nose arc (degrees either side) | Sideways strafe | Backing off |
| ------------- | -----------------------------: | --------------: | ----------: |
| `swarm`       |                             20 |             0.8 |         0.6 |
| `fighter`     |                             20 |             0.8 |         0.6 |
| `interceptor` |                             20 |             0.8 |         0.6 |
| `retaliator`  |                             20 |             0.8 |         0.6 |

These authored values apply while a forward-gun ship keeps its nose on Ada
([Physics](#physics)). Its aim point is inside the nose arc when the line to it
lies within the arc either side of the facing. The strafe limits are fractions of
the class's `maxSpeed` and cap its requested speed by direction: full `maxSpeed`
straight ahead, the sideways limit straight sideways and the backing-off limit
straight back. Between them the cap follows two half-ellipses: for a request at
angle `a` from the facing, the cap is
`maxSpeed / sqrt((cos a / f)^2 + (sin a / s)^2)`, where `s` is the sideways limit
and `f` is 1 ahead and the backing-off limit behind.

## Hulls

The span column in [Values](#values) is each class's drawn width, set by
`src/data/enemyDimensions.ts`. Every hull keeps its class width except the
retaliator bodies, which have per-hull spans: the Manta gunship and Mining
Freighter keep the class's 3 Ada widths, and the Cargo Hauler spans 2.5. Each
hull's drawn length follows its design. Sizes are display px at 1x. World units
are display px times 20 / 18.76, since Ada's 18.76 px span is her 20-unit
diameter.

| Class         | Hull                          | Length x width | Spacing radius (world units) |
| ------------- | ----------------------------- | -------------: | ---------------------------: |
| `swarm`       | Pincer drone                  |        14 x 15 |                            8 |
| `fighter`     | Arrowhead                     |        24 x 19 |                           13 |
| `interceptor` | Spear                         |        42 x 19 |                           22 |
| `retaliator`  | Manta gunship                 |        34 x 56 |                           30 |
| `retaliator`  | Cargo Hauler                  |      84 x 46.9 |                           45 |
| `retaliator`  | Mining Freighter              |        50 x 56 |                           30 |
| `frigate`     | Shoulder frigate              |     119 x 93.8 |                           63 |
| `frigate`     | Twin hull                     |     108 x 93.8 |                           58 |
| `capital`     | Hammer (Sunflower)            |  158.9 x 112.6 |                           85 |
| `capital`     | Manta dreadnought (Whirlpool) |  152.9 x 112.6 |                           82 |
| `capital`     | Crossbow (Needle)             |  165.9 x 112.6 |                           88 |
| `capital`     | Broad wing (Andromeda)        |  139.9 x 112.6 |                           75 |
| `capital`     | Outrigger carrier (Cartwheel) |  151.9 x 112.6 |                           81 |
| `capital`     | Forked fortress (Phantom)     |  169.9 x 112.6 |                           91 |
| Flagship      | Admiral Archie's own design   |  122.5 x 112.6 |                           65 |
| `platform`    | Ore-field platform            |    69.3 x 69.3 |                           37 |
| Station       | Hostile station (Andromeda)   |  131.3 x 113.7 |                           70 |
| Station       | Hostile station (Cartwheel)   |  131.3 x 131.3 |                           70 |
| Station       | Hostile station (Phantom)     |  131.3 x 131.3 |                           70 |

- **Hits:** shots, beams, blasts, mines and contacts test the drawn convex
  outline of the hull's current heading frame, plus a heavy's hardpoint bases
  and tops. Hit area follows the drawn outline; HP and speeds are unchanged.
- **Spacing radius:** the larger of half the drawn length and half the drawn
  width, in world units. It sets spawn footprints, group member spacing, escort
  rings and capital spacing, never hits.
- **Frigates:** the Shoulder frigate in Sunflower, Cartwheel and Phantom; the Twin hull
  in Whirlpool, Andromeda and Needle. Each galaxy has one capital, listed above.
  Every frigate and capital in a galaxy uses that galaxy's hull. The Twin hull's
  length includes its engines.
- **Capital mounts:** each capital's mount positions come from its hull's
  design; the mount IDs and fill order are unchanged. A mount the hull hides at
  some headings still fires and takes hits as usual.
- **Retaliators:** each rolls the Manta gunship, Cargo Hauler or Mining Freighter
  with equal weight in every galaxy, from its ship ID. All three keep the
  `retaliator` values and Rapid Missile from one fixed forward hull launcher; a
  retaliator has no turret.
- **Small craft weapons:** the swarm, fighter and interceptor fire from flush
  hull ports along the hull's facing ([Physics](#physics)). The ports mark where
  shots leave the hull. The fighter's Multi-Laser fan leaves from one origin,
  centred on the facing.
- **Flagship:** Admiral Archie's flagship keeps its own design.

## Behaviours

Enemy movement comes from a data-driven behaviour library, so each archetype
mixes and matches behaviours and their parameters. Forward-gun ships fight with
their weapons, not their hulls: in range, each keeps its nose on Ada and holds a
standoff band from her, strafing sideways and firing, and backs off when she
comes inside it. They never press in to ram.

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
| `escort`    | Stays near its leader and intercepts Ada when she comes close to it.                         |
| `siege`     | Advances slowly on Ada while its hardpoint turrets fire; used by frigates and capitals.      |

Every engaged behaviour of a forward-gun ship keeps its nose on Ada while she is
visible within its engagement range, and its movement is strafing under the
[Nose fire](#nose-fire) limits: the `chase` and `swarm` holds, including the
swarm's wobble and circling, the `hitAndRun` attack, the `strafe` approach up
to closest approach, and an `escort`'s station and intercept. A `hitAndRun`
pull-out, `flee`, a `strafe` pass after closest approach and the return home are
breaking off: the ship turns to its travel direction and holds fire until it
faces Ada again. After closest approach, an interceptor keeps its speed, without
the strafe limits, through its loop until its next approach begins.

A retaliator keeps its nose on Ada in `chase`, closing to its band and holding it,
once Ada is within its engagement range. It breaks off in a morale retreat and on
its return home, and travels while patrolling unprovoked under `retaliate`,
investigating, or closing from beyond its engagement range. `siege` heavies and
platforms follow the turret-ship rule in every behaviour.

Provisional parameters: `hitAndRun` retreats after 3 volleys or a hit, using
its independent bounded retreat policy. Morale and `hitAndRun` share initial
limits of 1.6 seconds or 200 world units of displacement, up to 0.5 radians of
seeded curvature and a six-second cooldown, with per-policy overrides. These are
the shared retreat defaults in source.
Recovery requires actual line of sight, perception, engagement admission and the
home leash; otherwise fixed last-seen investigation gives way to home patrol
([Retreat policy](#bounded-retreat-follow-up)). `strafe` passes no closer
than 150 world units and loops back beyond 420; `siege`
advances at half top speed; `escort` circles its leader on a station ring 60
beyond the leader's spacing radius ([Hulls](#hulls), [Keep moving](#keep-moving)),
intercepts Ada within 600 and falls back to `hitAndRun` without its leader.
A ship that touches Ada still bounces off without damage. Finite pursuit and
return home still apply.
When an encounter pages back into the same flight, its survivors are restored by
role, so a destroyed capital never returns as an escort or the reverse. Fresh entry
resets enemy populations; Continue preserves the existing flight. The first galaxy is mildly
more aggressive than the base catalog, and difficulty rises along the route (see
[Difficulty](#difficulty)). Escorts also fall back when their leader is disabled.

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
enemy-only weapon fire rate and the encounter rate at every position, so the whole curve can be
tuned at once. Small-craft Stardust drops use unscaled hull hit points. Heavy rewards are fixed
independently of hull HP, part HP and mount counts, so tuning them leaves
the economy unchanged. It is not a player setting: there is one forgiving difficulty.

Damage and hit points share one unit: 1 damage removes 1 HP. A level 1 Laser shot
deals 1 damage.

Small craft:

| Position | `swarm` | `fighter` | `interceptor` | `retaliator` | Group bonus | Lead | Notice |  Fire |
| -------: | ------: | --------: | ------------: | -----------: | ----------: | ---: | -----: | ----: |
|        1 |       2 |         4 |             3 |            8 |          +1 |  20% |   +20% |  +44% |
|        2 |       2 |         5 |             3 |            9 |          +1 |  40% |   +30% |  +63% |
|        3 |       3 |         5 |             4 |           10 |          +2 |  60% |   +40% |  +81% |
|        4 |       3 |         6 |             4 |           11 |          +2 |  80% |   +45% |  +88% |
|        5 |       3 |         6 |             5 |           11 |          +3 |  90% |   +50% |  +94% |
|        6 |       3 |         6 |             5 |           12 |          +3 | 100% |   +50% | +100% |

Heavies:

| Position | Hardpoint | `frigate` hull | Frigate weapons | `capital` hull | Capital weapons | Heavy share |
| -------: | --------: | -------------: | --------------: | -------------: | --------------: | ----------: |
|        1 |        10 |             40 |               2 |             80 |               4 |          ×1 |
|        2 |        10 |             44 |               2 |             88 |               4 |          ×1 |
|        3 |        12 |             60 |               3 |            120 |               6 |        ×1.2 |
|        4 |        12 |             64 |               3 |            128 |               6 |        ×1.3 |
|        5 |        14 |             88 |               4 |            176 |               8 |        ×1.4 |
|        6 |        14 |             96 |               4 |            192 |               8 |        ×1.5 |

- Small-craft columns are hull HP. Outside Sunflower's staged ambient roster,
  the group bonus adds to both ends of each `swarm` and `fighter` group range. Lead is how much of Ada's movement enemy
  aim allows for (see [Enemy aim](#enemy-aim)). Notice and fire rates are
  relative to the base catalog. The Fire column applies to enemy-only weapons; shared
  weapons use the equipped-level rate shares below. Enemy group densities are in [Spawn targets](rules.md#spawn-targets).
- Frigates carry one fixed front Laser and capitals, the flagship included, carry
  two, in addition to the weapon counts above. Each fires the shared Laser at the
  equipped level, at heavy shot speed and the ship's Laser rate (frigate 1,
  capital 1.5), only along the facing within the 20-degree nose arc. Each is a
  weapon part with hardpoint HP and counts toward disabling the ship. Art places
  them on each hull's prow.
- Every heavy hardpoint (weapon, engine, command and platform turret) has the
  position's hardpoint HP: 10, 10, 12, 12, 14 and 14 along the route. The
  flagship's parts have 18 HP. A `platform` hull has half the frigate hull.
- Heavy share multiplies the ambient roster's `frigate` weights before
  normalization. Placed platforms have no weight.

### Enemy aim

Enemy aim is natural rather than perfect. Every turret and every forward-gun
ship's nose follow it:

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
- **Direct aim:** hitscan beams and the lance's tracking line aim at Ada directly,
  so an interceptor's nose points at Ada herself.
- **Forward-gun ships:** the resulting aim point is where a forward-gun ship
  turns its hull while its nose is on Ada, so lead and drift steer the nose. Its shots follow the
  facing, and it fires only while the aim point is inside its
  [nose arc](#nose-fire).

### Enemy weapons

All enemy types, including swarms, escorts, heavies, hostile stations and the
flagship, roll one equipped weapon level at spawn. All six shared weapons on that
enemy use the same result. Lance, Mine and Ring remain level 1. Save and Continue
retain the result within the flight; a fresh galaxy entry resets enemies and
rolls new loadouts. Rolls use a dedicated stream independent of geography,
encounter composition, ship identity/profile selection and loot.

| Galaxy    | Level 1 | Level 2 | Level 3 | Shared fire-rate share |
| --------- | ------: | ------: | ------: | ---------------------: |
| Sunflower |    100% |      0% |      0% |                    25% |
| Whirlpool |     75% |     25% |      0% |                    25% |
| Needle    |     50% |     50% |      0% |                    30% |
| Andromeda |     25% |     75% |      0% |                    30% |
| Cartwheel |      0% |     75% |     25% |                    35% |
| Phantom   |      0% |     50% |     50% |                    35% |

Shared weapon intervals are the player's interval at the equipped level divided
by the galaxy's fire-rate share and existing ship rate modifiers. A frigate's
Heavy Missile uses 2 and its Laser mounts use 1, capitals including the flagship
use 1.5, and platforms use 1.5; other ships and hostile stations use 1. Swarm Laser retains its 7/9 relative rate and industrial
Rapid Missile its 5/4 relative rate. These shares replace the shared weapons'
absolute enemy intervals and position fire curve; the old values do not stack.
Platform bursts retain two shots 0.15 seconds apart. Warning times are unchanged.
Enemy-only weapons retain their own base intervals and position fire curve.

Frigate and capital weapon clocks initialize on their first eligible firing
step, in stable mount fill order excluding engine, command and capped mounts.
Mount index i of N starts after (i / N) times its own final interval. Ineligible
time pauses cooldowns and burst positions. Disabling a mount never reindexes
the others. Initialized clocks and burst state persist through saves; later
coincident shots are allowed. Platforms and stations do not use these phases.

Shared weapon damage is 100% of the player's damage at the equipped level.
Blast, spread and reach use that level's canonical weapon definition; more fan
bolts do not add physical mounts. Projectiles from forward-gun ships (swarm,
fighter, interceptor, retaliator) fly at 0.6 times the player's level-1 speed
for that weapon; projectiles from heavies (frigates, capitals, the flagship,
platforms and hostile stations) fly at 0.8 times, with no level speed scaling. Enemies
carry no ammunition.

| Archetype       | Weapon signature                                                                  |
| --------------- | --------------------------------------------------------------------------------- |
| `swarm`         | Laser                                                                             |
| `fighter`       | Multi-Laser                                                                       |
| `interceptor`   | One Phaser                                                                        |
| `retaliator`    | Rapid Missile                                                                     |
| `frigate`       | One Heavy Missile on `port`; other active mounts Laser; one fixed front Laser     |
| `capital`       | One charged lance or mine layer; other mounts Scattershot; two fixed front Lasers |
| `platform`      | Laser on every active mount                                                       |
| Hostile station | Ring burst on `weapon-5`; other active mounts Rapid Missile                       |

A capital uses charged lance on `weapon-left` at route positions 1–4. In
Cartwheel and Phantom, an independent stable per-ship profile gives equal weight
to Scattershot plus charged lance and Scattershot plus mine layer. The mine
variant places its single mine layer on `stern-right`. Each capital carries
exactly two weapon types, never both specialized weapons together. Profile
selection uses a dedicated stream keyed by route position and ship ID, separate
from the equipped-level roll.

Platform active mounts are `port` and `starboard` in Cartwheel, plus `aft` in
Phantom. Hostile stations use the first six, seven or eight mounts of the
`weapon-0` through `weapon-7` fill order in Andromeda, Cartwheel and Phantom,
respectively. Mount counts and capped mounts are defined by their position
tiers; extra fan bolts do not add mounts.

An enemy Heavy Missile flies slowly. The interceptor's Phaser shows a thin aim
line along its facing for 0.4 seconds before the beam fires along it. The aim
line stays where it started, so Ada can move off it. The fighter's Multi-Laser fan
is centred on its facing.

| Enemy weapon  | Projectile speed | Notes                                                             |
| ------------- | ---------------: | ----------------------------------------------------------------- |
| Laser         |        300 / 400 | Swarm 300; heavies 400; platform two-shot bursts 0.15 s apart     |
| Multi-Laser   |              240 | The equipped level's fan, centred on the facing                   |
| Rapid Missile |        300 / 400 | Retaliator 300; hostile station 400; its blast damages Ada        |
| Heavy Missile |              320 | Frigate only; equipped-level damage; its blast damages Ada        |
| Scattershot   |              480 | Capital only; equipped-level pellet count, damage, range and fade |
| Phaser        |          Hitscan | 0.4 s fixed aim line along the facing before firing               |

Projectile speeds are world units per second. The three enemy-only weapons:

- **Ring burst:** 8 bolts outward in a ring, 1.5 damage each, every 3.5 seconds,
  at 320 world units per second, raised by the same 0.8 to 0.6 ratio as
  heavies' shared weapons.
- **Mine layer:** drops a stationary mine behind the ship every 5 seconds, at most
  4 at a time. A mine deals 3 damage when Ada's drawn ship touches its drawn
  silhouette, then is gone; Ada's shots
  destroy mines (1 HP), and mines vanish after 20 seconds.
- **Charged lance:** every 6 seconds, a beam as long as the game area is wide.
  A thin line tracks Ada for 0.7 seconds, then holds still for 0.3 seconds, then
  the beam fires along it for 6 damage per hit. It stops at the first obstacle, like the Phaser.

Tell lines (the lance's tracking and locked lines and the Phaser's aim line) stop
at the first obstacle, as their beams do, so cover reads. The ring burst has no
warning; its emission shows only as it fires.

### Heavy hull and disabling

Frigates, capitals and platforms have hull HP and hardpoints.

- **Damage:** a hardpoint hit damages only that part, with no hull damage or
  overflow. A hull hit damages only the hull. The flagship retains its hull floor of 1.
- **Destroyed:** at 0 hull HP the ship breaks apart and drops its full Stardust roll
  and no upgrade (see [Economy](economy.md#earning-stardust)).
- **Disabled:** when every weapon hardpoint is destroyed, the ship is disabled,
  whatever its hull HP. It stops attacking and steering, coasts to rest, no longer
  counts for battle, and shows a red "Disabled" banner above its hull.
- **Salvage:** within Talk range of a disabled heavy, Use offers Salvage. Salvaging drops the
  half the rolled Stardust, rounded down, and can yield a heavy upgrade. The ship
  survives: it powers down, its banner goes, it is drawn dimmed,
  and shots and Ada pass through it. Ada can instead keep shooting a disabled ship
  until its hull breaks, for more Stardust and no upgrade.
- **Engines and command:** each engine still provides an equal share of thrust.
  A heavy that loses all its engines coasts to rest like a disabled heavy,
  keeping its momentum and slowing to a stop. Command parts never fire and do not count toward disabling.
- **Mounts:** Art draws each heavy hull once, with every weapon mount it can
  carry, and a turret for each weapon a mount can hold. A mount the position
  leaves unused is drawn as a capped plate with no hardpoint. Admiral Archie's flagship has its own, more threatening design.
- **State:** hull HP, hardpoints, disabled and salvaged states persist within the
  flight, across paging and Continue. Fresh galaxy entry resets enemy populations
  without reopening resolved story. Within the flight, a salvaged heavy stays where
  Ada left it: like a destroyed one, it no longer holds the spacing kept between
  capital ships, and nothing moves it.

## Hostile station hull

Hostile stations have six active weapon parts in Andromeda, seven in Cartwheel
and eight in Phantom. Their hull HP is twice the active weapon count times the
route part HP: 144, 196 and 224 respectively. Part hits damage only the selected
part, with no hull damage or overflow. Hull hits damage only the hull. A station
has no hull floor: zero hull destroys it, and disabling every weapon disables it.
Friendly stations retain one HP. Existing ship hull HP and the flagship hull floor
remain unchanged.

Each galaxy has one hostile station design: two six-sided decks in Andromeda, an
eight-sided wheel over a deck in Cartwheel and four arms over four in Phantom.
Each design has eight mount bases at its own positions. The armed counts (6, 7
and 8) and the `weapon-0` through `weapon-7` fill order are unchanged.

## Hostile station defenders and encounter lifetime

The approved hostile station formation is one body and two `swarm` defenders.
All three actors count toward existing population, archetype and footprint caps,
using only the existing single nonstacking +2 allowance. Admit the complete
formation atomically or defer it; never trim defenders or raise a cap.

Do not replenish defenders within a flight. Continue retains existing actors,
HP, weapon rolls, clocks and defender casualties. Fresh galaxy entry resets
combat actors and casualties while preserving seeded site geography and known
sites. Site identity and knowledge are separate from encounter-epoch actor state.

Keep the existing size ratio 7, hull HP 72/98/112 in Andromeda/Cartwheel/Phantom,
active weapon parts 6/7/8, and approved part HP, weapon mix and rates unchanged.
See [Rules](rules.md#hostile-station-sites-and-map-knowledge) for geography and
map knowledge, and [Economy](economy.md#earning-stardust) for the station payout.
These policies are approved and their policy primitives are present in the
inspected source. Production checks, delivery and acceptance are not established
by this contract.

## Ambient admission

The ambient roster uses frigates and smaller ships in every galaxy. Capital
bosses, required capital guards and Phantom's flagship use authored encounters.

Spawn admission counts only the group being placed, in its own lattice cell; the
lattice spacing keeps groups apart ([Spawn targets](rules.md#spawn-targets)). The
whole group, including every escort and hull, must fit the local budget and
archetype limit. Fighter groups target four and use the largest size that fits the
budget. Swarms target their configured maximum and fit the budget down to two,
never a singleton. Escorts consume budget slots.

First-sight admission uses a 900-world-unit local radius. It conservatively counts
live neighbouring hulls whose footprints could share that neighbourhood, including
required guards, old packs and pursuing ships. Disabled hulls still count;
salvaged ships do not. One nonstacking local allowance adds two slots near a
capital ship or a hostile station. Multiple qualifying ships and stations never
add more than two slots, and friendly stations do not qualify.

Local admission does not apply to salvage wrecks: no budget, archetype limit or
capital count check. A salvage site's disabled frigate is placed without those
checks and then counts as a disabled hull toward other groups' budgets; its exclusion zone keeps
ambient groups out of its neighbourhood
([Spawn targets](rules.md#spawn-targets)).

Other groups and all mandatory escorts remain atomic: unaffordable groups are
excluded rather than trimmed, and admission never raises the cap.

### Required guard frigates and support fighters

General ambient frigates retain two mandatory fighter escorts. One ambient
formation counts as three hulls; a pair counts as six. Admit the complete
formation within existing population, archetype and footprint caps or wait.
Required story/quest guard frigates are always present; only their support
fighters may number zero to two. Reserve actual required sites, hulls and
exclusion zones before optional rocks/ambient encounters, then fit support
under existing caps. Never turn failed placement into an empty route plan,
raise caps, remotely summon a guard toward Ada or reveal hidden targets.
Guards patrol near their station/objective outside its exclusion zone and block
the route until defeated or disabled. Support is not an independent blocker.
Persistent identities, surviving followers and casualties do not replenish or
duplicate on revisit/Continue. A disabled or destroyed leader retains the
existing escort fallback. Capital formations and legacy compatibility remain
unchanged. Existing required-guard assertions remain required.

Ambient enemy group densities by galaxy and region are in
[Spawn targets](rules.md#spawn-targets). Each galaxy's encounter rate below sets
its encounter spacing (the lattice pitch): the quiet distance of 1800 world units,
rounded up to whole 512-unit chunks (at least three), divided by the square root
of the rate. The minimum group distance is the quiet distance divided by the
square root of the rate, and the anchor box width is the encounter spacing minus
the minimum group distance. The cell occupancy, the share of lattice cells that
hold a group, is 0.75 times the galaxy's density factor. The factor scales enemy
densities only; the encounter rate, spacing and minimum group distance do not
change with it.

Every galaxy uses three geographic regions measured from the galactic center at
the encounter location: inner below 10000 world units, middle from 10000 to below
25000, and outer from 25000 onward. Periodic worlds use the shortest wrapped
center distance. Exploration history, quest intro distance and map progress do
not choose difficulty, and existing enemies keep their composition when crossing.

Composition weights blend linearly across 2000-world-unit bands centered on each
boundary (9000–11000 and 24000–26000). Numeric budgets and archetype limits switch
discretely at 10000 and 25000; they do not interpolate. The fresh-chunk ledger
continues to exclude standing, teleports and revisits for quest pacing.

| Position | Galaxy    | Encounter rate | Encounter spacing (world units) | Minimum group distance | Anchor box width | Density factor | Cell occupancy | Inner / middle / outer budget | Archetype limit |
| -------: | --------- | -------------: | ------------------------------: | ---------------------: | ---------------: | -------------: | -------------: | ----------------------------- | --------------- |
|        1 | Sunflower |          1.725 |                            1559 |                   1370 |              189 |           0.61 |         0.4575 | 3 / 4 / 5                     | 1 / 2 / 2       |
|        2 | Whirlpool |         1.8975 |                            1487 |                   1307 |              180 |           0.50 |          0.375 | 4 / 5 / 6                     | 2               |
|        3 | Needle    |           2.07 |                            1423 |                   1251 |              172 |           0.50 |          0.375 | 4 / 5 / 6                     | 3               |
|        4 | Andromeda |         2.2425 |                            1368 |                   1202 |              166 |           0.52 |           0.39 | 5 / 6 / 7                     | 4               |
|        5 | Cartwheel |          2.415 |                            1318 |                   1158 |              160 |           0.54 |          0.405 | 5 / 6 / 7                     | 4               |
|        6 | Phantom   |         2.5875 |                            1273 |                   1119 |              154 |           0.77 |         0.5775 | 6 / 7 / 8                     | 4               |

Sunflower retains its stage-specific roster and type gates below. Later
galaxies retain their other encounter groups, heavy weights and archetype limits.
Swarm maxima retain their route-position bonus; their ambient minimum stays two.
Ambient fighters target four without a route bonus and downscale to the local budget.
Spawn target densities do not change with admission; admission applies to the
planner's output.
These budgets are not strict physical population caps: subsequent movement can
bring ships together. They do not freeze or despawn existing enemies.

New sight-triggered engagement is admitted separately, reserving required and
persistent enemies and already engaged enemies first. Only the new sighted
engagement term is gated; existing engaged AI, damage and summons, and returning
ships' rearm behaviour remain unchanged.

## Sunflower roster

Encounter location selects Sunflower's region. The table lists unblended base
composition weights; transition bands mix those weights only. These exact group
ranges receive no route-position group bonus. Fighters target four and may
be smaller when the local budget has fewer slots. Weights are relative among
eligible groups; a type absent from a stage cannot spawn ambiently.

| Region base distance (world units) | Archetype limit | Swarm group / weight | Fighter target / weight | Retaliator group / weight | Interceptor group / weight |
| ---------------------------------: | --------------: | -------------------- | ----------------------- | ------------------------- | -------------------------- |
|                                  0 |               1 | 2 / 0.55             | 4 / 0.45                | None                      | None                       |
|                              10000 |               2 | 2–3 / 0.45           | 4 / 0.40                | 1 / 0.15                  | None                       |
|                              25000 |               2 | 2–3 / 0.40           | 4 / 0.35                | 1 / 0.15                  | 1 / 0.10                   |

No stage admits ambient frigates or capital battles. Required guards remain.
Swarm packs use `swarm` and flee after losses; fighters use `hitAndRun` and share
pack morale; retaliators use `retaliate`, then `chase`, with a three-bolt spread;
interceptors use `strafe`. Values not listed keep their catalog values. Each
galaxy below has its own roster. All values are provisional playtest tuning.

## Whirlpool roster

Whirlpool's drones are hunters tracking the whale family, which knows where the
holodisk drifted. They chase rather than hit and run.

| Archetype     | Encounter    | Group | Weight | Behaviours                                   |
| ------------- | ------------ | ----: | -----: | -------------------------------------------- |
| `swarm`       | Pack         |   2–8 |   0.25 | `swarm`; packs `flee` after losses           |
| `fighter`     | Hunting pack |     4 |   0.30 | `chase`; a group shares pack morale          |
| `interceptor` | Solo or pair |   1–2 |   0.15 | `chase`                                      |
| `retaliator`  | Solo         |     1 |   0.10 | `retaliate`, then `chase`; three-bolt spread |
| `frigate`     | Solo         |     1 |   0.15 | `siege`; size 5 Ada widths                   |

The whale and family sites each keep their authored capital guard.
[Sounder](quests.md#captain-sounder) guards the holodisk route after the
reunion. Whirlpool's ambient roster has no capitals. Hunting packs appear near
whale destinations and along the calf-guiding route. Hunters never target or
damage whales. Their shots pass through them.
Space currents push small craft and leave frigates and capitals unaffected (see
[the version one rules](rules.md#galaxy-two-whirlpool-whale-family)). Whirlpool adds no new
archetype: currents change how the existing ones fight.

## Needle roster

Needle's drones gather at the mouths of its narrow channels and fly fast passes.

| Archetype     | Encounter | Group | Weight | Behaviours                                   |
| ------------- | --------- | ----: | -----: | -------------------------------------------- |
| `swarm`       | Pack      |   2–8 |   0.20 | `swarm`; packs `flee` after losses           |
| `fighter`     | Patrol    |     4 |   0.25 | `chase`; a group shares pack morale          |
| `interceptor` | Pair      |     2 |   0.25 | `strafe`                                     |
| `retaliator`  | Solo      |     1 |   0.08 | `retaliate`, then `chase`; three-bolt spread |
| `frigate`     | Solo      |     1 |   0.15 | `siege`; size 5 Ada widths                   |

No encounter is placed
inside a gate run's channel; a pack waits at the Eye's exit.

## Andromeda roster

Andromeda's drones hunt in the open, in larger patrols with more frigates.

| Archetype     | Encounter    | Group | Weight | Behaviours                                   |
| ------------- | ------------ | ----: | -----: | -------------------------------------------- |
| `swarm`       | Pack         |   2–8 |   0.20 | `swarm`; packs `flee` after losses           |
| `fighter`     | Patrol       |     4 |   0.30 | `hitAndRun`; a group shares pack morale      |
| `interceptor` | Pair         |     2 |   0.15 | `strafe`                                     |
| `retaliator`  | Solo         |     1 |   0.10 | `retaliate`, then `chase`; three-bolt spread |
| `frigate`     | Solo or pair |   1–2 |   0.18 | `siege`; size 5 Ada widths                   |

Drones never target
the courier Pip or the settlers' ships.

## Cartwheel roster

Cartwheel's drones are claim jumpers: they gather at ore fields and hit and run
any miner who comes near, Ada included. Fixed turret platforms guard ore fields.

| Archetype     | Encounter       | Group | Weight | Behaviours                                                     |
| ------------- | --------------- | ----: | -----: | -------------------------------------------------------------- |
| `swarm`       | Pack            |   2–7 |   0.25 | `swarm`; packs `flee` after losses                             |
| `fighter`     | Claim jumpers   |     4 |   0.40 | `hitAndRun`; a group shares pack morale                        |
| `interceptor` | Solo or pair    |   1–2 |   0.12 | `hitAndRun`                                                    |
| `retaliator`  | Solo            |     1 |   0.10 | `retaliate`, then `chase`; three-bolt spread                   |
| `frigate`     | Solo            |     1 |   0.10 | `siege`; size 5 Ada widths                                     |
| `platform`    | Ore-field guard |     1 |      – | `siege` at speed 0: two required turrets; placed, not weighted |

An ore field is a seeded cluster of 6 to 10 ordinary rocks about 900 world units
across, placed like stations: at least 3000 world units apart and 1500 from the
hub, stations and quantum jump arrivals. Its rocks are ordinary medium and large
asteroids with ordinary asteroid HP, 5 for medium and 10 for large. Every ore-field rock is a crystal rock: when destroyed it
skips the ammo roll and gives at least 1 ore; any further ore and
Stardust roll as usual ([Economy](economy.md#earning-stardust)). A field holds
only its own rocks: chunk generation keeps other asteroids out of a 600 world
unit radius around its centre, its 450 radius plus a 150 margin. A claim-jumper
group whose seeded anchor lies within half the
[encounter spacing](#ambient-admission) of an ore field gathers there half the time.

The `platform` is Cartwheel's one new archetype: fixed guards need a ship that
holds its position, and every existing archetype moves. It reuses `siege`, whose
turrets fire while it advances, with no speed to advance.

- **Placement:** one platform stands at the edge of at most half of the ore
  fields, chosen by the seed, so unguarded ore is always available. Its hull is one drawn frame
  that never rotates and has no thrust jets.
- **Parts:** two turrets, each with the position's hardpoint HP, and a hull with
  half the frigate hull ([Heavy hull and disabling](#heavy-hull-and-disabling)).
  Hit areas, turret mounts and muzzles come from Art's drawn hardpoints, as for
  the frigate and capital, and hull hits test its drawn outline ([Hulls](#hulls)).
- **Fire:** each live turret aims independently with `aimTurnSeconds` and fires
  a two-shot burst of the position's Laser, 0.15 seconds between shots, every 1.4
  seconds before the position's fire rate while Ada is within 520 world units.
  It stops firing beyond 520 and never pursues.
- **State:** retained like a frigate within one flight and across Continue, so
  destroyed turrets and a disabled, salvaged or destroyed platform remain exact.
  Fresh entry resets the platform with the enemy population while retaining its
  ore-field geography. Ada bounces off it on contact until it is salvaged. It drops Stardust by the heavy
  rule and has the heavy upgrade chance.

## Phantom roster

Phantom's drones are Archie's home guard: heavier, and they chase.

| Archetype     | Encounter    | Group | Weight | Behaviours                                   |
| ------------- | ------------ | ----: | -----: | -------------------------------------------- |
| `swarm`       | Pack         |   2–8 |   0.18 | `swarm`; packs `flee` after losses           |
| `fighter`     | Home guard   |     4 |   0.25 | `chase`; a group shares pack morale          |
| `interceptor` | Pair         |     2 |   0.15 | `strafe`                                     |
| `retaliator`  | Solo         |     1 |   0.07 | `retaliate`, then `chase`; three-bolt spread |
| `frigate`     | Solo or pair |   1–2 |   0.25 | `siege`; size 5 Ada widths                   |

Blockades and the finale's waves draw from this roster (see
[the version one rules](rules.md#galaxy-six-phantom-the-finale)). Once the
chapter is complete, Phantom places no new encounters.

## Archie's flagship

Admiral Archie's flagship is a `capital` in his own design, the only crewed ship in
his fleet.

- **Hull and parts:** 320 hull HP; command, two engines, 8 weapon mounts and two
  fixed front Lasers, each hardpoint 18 HP. Its weapons follow the capital signature at position 6, as for any
  capital ([Enemy weapons](#enemy-weapons)). Its hull never drops below 1 HP, so
  it is beaten only by disabling.
- **Movement:** `siege` at a quarter of its top speed, staying within 1000 world
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
  effect when the battle begins. Incoming craft start in their existing escort
  ring slots, including chasers. Incoming whales start at their follow positions.
  These positions apply to the first arrival and each rotation, in normal and
  reduced motion. Allies jump out when the flagship is salvaged or the flight
  ends. At most 8 allies are on screen at once. The rest rotate in: at the
  start of each later wave and of the flagship fight, allies that have not yet
  flown jump in and replace ones that have, so every ally takes part. Those that
  have flown longest leave first; Marlo never rotates out, so the song never
  stops.
- **Look:** allies show thrust jets like every ship and get no edge markers,
  like other friendly objects Ada flies through.
- **Safety:** drones never target allies, allies take no damage, and Ada and shots
  pass through them, with Ada drawn in front.
- **Fire:** an ally that fires uses level 2 Laser every 1.4 seconds at the drone
  its behaviour picks.
- **`escort`:** escorts share a ring around Ada, their slot centres at least 60
  world units beyond her drawn ship and wider as more escorts join, so neighbouring escorts' drawn
  ships stay at least 16 world units apart. Their slots sit at equal angles
  starting behind her and turn with her heading. Each escort leaves its slot to
  intercept a drone within 600 of her and returns to it.
- **`chase` against turrets:** chases the nearest heavy and aims at its weapon
  hardpoints. With no heavy present, it takes an escort slot and fights as an
  escort.
- **Whale:** a whale never fires and follows 150 world units behind Ada, moving
  like the calf. Two whales fly side by side, their drawn whales at least 16
  world units apart.
- **Song:** drones within 300 world units of Marlo move at three quarters of
  their top speed; while the nursery whale flies, the reach is half again as
  far, 450. A faint rim marks the song's reach, and a slowed drone shows a ring
  beneath it, sized to the drone's drawn reach plus 4; both hold steady under
  reduced motion.

## Presentation

All art is one shared asset bank. Each galaxy's data references shared asset ids
rather than owning its art, so an asset can move between galaxies where it suits
that galaxy's field; story-bound content such as Sunflower's three outposts stays
with its galaxy. Each galaxy still gives its enemy ships one coherent visual
family: coral in Sunflower, Whirlpool and Phantom, claim in Cartwheel, garnet in
Andromeda and crimson in Needle. The small craft and the three retaliator bodies
each have one model in every galaxy, recoloured per family; frigate and capital
hulls follow [Hulls](#hulls). Sunflower keeps its three outposts; the growers'
outpost is drawn as the leaf-petal station hull, with no new destination or
mechanic. The current
trading station and discovery cache art is tuned for Cartwheel; Sunflower draws
its stations and caches with pastel-tuned versions that read on its yellow
field, reusing the shared Cartwheel-tuned assets until those exist. Asteroid sprites
match the collision radii: small 12 to 18, medium 24 to 34, large 52 to 70 and huge
84 to 104 world units; large and huge rocks keep their silhouette radius plus 160 clear
of stations, destinations and launch points. Shapes stay simple and
readable at display size, with distinct silhouettes by role: a small darting
swarm craft, a baseline fighter, a long narrow interceptor and a broad heavy
retaliator. Enemy ships read as hostile and stay distinct from Ada's white and
blue ship. Enemy craft are drawn with 16 heading frames: the model facing
stays continuous and the nearest frame is drawn. A ship drawn with frames and
hardpoints uses the drawn frame's facing for its hardpoint hit areas and muzzles.
Hits test the drawn convex outline at the current heading, so they match what is
drawn; the spacing radius ([Hulls](#hulls)) serves only spacing and placement.
Sprites keep their drawn sizes.

## Enemy rule interface

This module supplies pure observation-to-intent rules. Overall encounter placement,
quiet travel and optional versus required fights belong to the version one rules.
[Spawn targets](rules.md#spawn-targets) sets ambient enemy group densities, and
[Ambient admission](#ambient-admission) defines the three geographic encounter regions. These do not change enemy intent rules.
All numeric catalog values are provisional tuning, not user-selected values.
Each archetype's maximum speed is fixed in world units ([Ships](#values)).
Frigates and capitals may block required quest routes in the first five chapters;
the overall placement contract remains in the version one rules.

### Data and state

The catalog interface defines typed aggression, size, physics ([Ships](#physics)),
perception and engagement radii, behaviours and their parameters, wobble,
separation, firing patterns,
morale, hardpoints and pursuit leashes. [Ships](#physics) lists sizes, physics and
each galaxy's archetypes, and its [Difficulty](#difficulty) section
sets hit points, weapon mounts and enemy weapons by route position. Frigates have
one engine and two to four weapons. Canonical assembled-body size ratios are 5
for frigates and 6 for capitals, relative to Ada's source-model lateral hull
span. Drawn heading metadata supplies their geometry. Capital command parts
never fire. Each weapon carries its own typed fire profile, interval, spread and
projectile speed. Missile profiles travel straight; there is no homing rule.

`createEnemy(definition, identity, position)` creates JSON-serializable state. Identity
includes a stable ID, actor kind, nullable pack ID, seeded phase in radians and
an optional equipped weapon level. The adapter resolves one equipped level at
spawn through its dedicated per-ship stream. An absent saved level means level 1;
reconstructing a saved definition does not reroll it. The rules consume no
randomness and do not mutate supplied state. Serialize phase, age, engagement, flee latch, velocity, hull
HP, hardpoint HP, cooldowns, burst positions, initialized fire phases, home
position, last-seen position and age, pursuit elapsed time, returning latch and
time since return began. The optional retreat record preserves its kind,
origin, fixed away direction, start age and completion age through save/load.
Preserve initial pack sizes separately through losses
and save/load. No functions, maps, clocks or runtime objects belong in saved state.

`damageEnemy(definition, hit, state)` applies finite positive damage to the named
hardpoint or to the hull with a null ID. Unknown part IDs do nothing. A valid hit
latches retaliation even when the target is currently unseen. Individual hull damage
can trigger a bounded morale retreat without killing a craft. Pack losses can
trigger the same retreat for survivors. Active morale retreat suppresses fire, and
a forward-gun ship in either retreat also turns to its travel direction;
recovery can resume aggression under the observation and admission rules below.

`enemyEffects(definition, state)` derives destroyed part IDs, disablement and
destruction. A hit on a heavy's hardpoint damages only that hardpoint, without
spill into the hull. A hull hit damages only the hull. Hull HP at 0 destroys the ship. Destroying every weapon
hardpoint disables it while its hull survives: it emits no intents, steers no
more and coasts to rest. A destroyed weapon emits no further shots. Each engine provides an equal share of thrust: a
ship's top speed scales with the fraction of its engines still working, and
with all of them destroyed it has no thrust and coasts to rest from its current
momentum, like a disabled heavy. Other weapons keep firing independently. No primary hull weapon substitutes for a
lost hardpoint. Disabled entities must leave the adapter's active peer snapshot.

### Observation and intents

Call `stepEnemy(definition, context, state)` on a fixed simulation slice, preferably
1/60 second, using one immutable pre-movement peer snapshot for the entire slice.
Context supplies Ada's maximum speed and width, player position, targeting permission,
explicit visibility and initial pack sizes. Inputs must be finite;
use positive dimensions, nonnegative speeds and stable unique entity/part IDs.
Only positive finite dt advances rules. Unknown or occluded visibility grants no
chase or fire permission. It does not classify space as unreachable.
The adapter must supply actual observation and targeting permission, not infer them
from hidden runtime state. Targeting permission is false exactly while Ada is
protected ([Protection](rules.md#protection)) and never depends on where Ada or
the enemy is. Active peers contain live, nonsalvaged, enabled
actors, including self exactly once for an active actor. Disabled hulls remain
physical and saved but do not influence steering or escort observation.
The adapter supplies transient `loadedPackMembers` counts from the full live,
nonsalvaged pre-movement snapshot, including disabled survivors. Morale adds the
existing dormant survivor counts. If the loaded count field is absent, pure
callers retain the peer-count fallback; a supplied map with no pack entry means
zero loaded survivors. Preserve initial pack counts through unloading and
Continue. Neither unloading nor disablement is a casualty.

The result contains updated state, desired velocity, aim, fire intents and effects.
A forward-gun ship's aim is its hull facing; it keeps no separate weapon aim.
State position is deliberately unchanged. Steering and velocity response are rules;
collision resolution and position integration are runtime responsibilities. Commit
resolved position and velocity back into the next saved state. Separation reads only
the supplied snapshot, avoiding array-order feedback. Authored heading anchors
and turret pivots determine hardpoint and muzzle positions when available.
Their frame offsets use the canonical display scale once, then the existing
inverse projection. Fractional catalog offsets are a fallback when authored
metadata is absent. Turret ships, and forward-gun ships that are breaking off,
rotate to face their movement; a forward-gun ship with its nose on Ada turns its
hull toward its aim point ([Physics](#physics)). Collision and muzzle positions
follow the drawn hull and turret headings.

Sight aggression latches on visible perception. Retaliators patrol without
attacking until hit.
Engaged craft move by their behaviours ([Ships](#behaviours)) and separate from
peers. Smooth seeded variation gives each mobile ship a stable patrol shape
without erratic jitter or query-dependent RNG.
Flee direction is away from the observed or last-seen player position. Movement
into a station's or destination's exclusion zone or the Needle channel is still
rejected. There is no pathfinder or reachability oracle.

Fire intents contain world-space origin, normalized aim, projectile speed, weapon
ID, equipped level, damage ratio, projectile kind and delay within the slice.
Hardpoint ID identifies the emitting weapon; a null ID identifies the hull
weapon. `fireClockPolicy` is `staggered-and-paused` for frigates and capitals:
weapon clocks initialize on first firing eligibility in stable active-mount fill
order, with phase `(i / N) * ownInterval`. Ineligible time preserves cooldowns and
burst positions; disabling a mount never reindexes survivors. Other actors,
including platforms and hostile stations, use `continuous` clocks. Initialized
phases, cooldowns and burst positions survive Continue.

Catch-up shots have explicit delays; advance each new projectile for only
`dt - delay`, or schedule it at that offset. Fixed small slices bound work and
integration error. There is no spawn warning; Astra's drone-arrival line is the
arrival cue. Weapon-specific tells are separate: Phaser uses a fixed 0.4-second
aim line along the interceptor's facing; charged lance tracks for 0.7 seconds
and locks for 0.3 seconds before firing. Tell lines and beams stop at obstacles. Each fired beam damages
Ada at most once. Disabling a weapon prevents future fire and cancels an active
lance tell, but does not delete already emitted projectiles.

`stepDebris(dt, debris)` advances position by constant velocity times dt. Debris has
no AI, pursuit, morale, aim or weapon. The adapter owns seeded region placement and
collision damage. Do not repurpose the stationary quest-debris behavior implicitly.

### Patrol and investigation

Most mobile enemies patrol a seeded offset ellipse through their fixed home
position when unengaged. Investigation uses the same smooth route through the
fixed last-seen position, or home during return. Ship identity and saved phase
set the route variation; frames and observation queries do not reroll it.

`ENEMY_NAVIGATION` sets patrol speed to 0.5 of each ship's existing combat
movement speed. Investigation uses 0.7 far from the ellipse and smoothly blends
down to 0.5 near ellipse arrival over an approach radius of 180 world units.
For `siege`, both ratios apply to its existing combat speed, which already
includes its behaviour speed fraction. Navigation uses
`max(existing turnSeconds, 0.8)` seconds for smooth turns. These ratios do not
change archetype maximum speeds.

Unengaged retaliators keep their body's idle patrol within 2000 world units of
home. The Manta gunship flies the standard patrol. The Cargo Hauler patrols
around home with its patrol radii widened by the 180 approach radius. The Mining
Freighter traces the edges of nearby asteroids ([Miners](#miners)) and patrols
home when no asteroid qualifies.

Platforms have no navigation and remain stationary. Disabled or salvaged ships
do not patrol or investigate. A ship with every engine destroyed has no thrust
and coasts to rest. Every other ship keeps moving ([Keep moving](#keep-moving)).
Patrol changes neither aggression, engagement admission, pursuit leashes nor
targeting permission.

### Keep moving

Every enemy ship that can move keeps moving at all times: patrolling, holding a
band, circling a station, tracing asteroid edges or travelling. Only a destroyed,
disabled or salvaged ship, a ship with every engine destroyed, a fixed `platform`
and a hostile station come to rest. Story ships, allies and whales are not
enemies and keep their own waiting behaviour.

- **Minimum speed:** a ship's requested speed never falls below 0.25 of its
  current top speed: its class `maxSpeed` times its working engine share, slowed
  by Marlo's song where that applies. The floor lies below every directional cap,
  including the forward-gun sideways (0.8) and backing-off (0.6) strafe limits,
  so a request is clamped between the floor and its cap. Patrol and
  investigation paces already exceed the floor, except a `siege` patrol at
  0.5 x 0.5 = 0.25, which meets it, and the flagship's at 0.5 x 0.25 = 0.125,
  which rises to 0.25. The floor applies to the requested speed: actual speed
  can dip below it briefly in a sharp turn, a collision bounce or a contact
  slide, and the ship regains it with `accelerationSeconds`.
- **Idle patrol:** the existing seeded offset ellipse through home
  ([Patrol and investigation](#patrol-and-investigation)), radius 80 to 150 and
  ratio 0.7 to 1, at 0.5 of combat speed. It reaches at most 300 world units
  from home, inside every home leash and the 2000 industrial leash. Station
  guards keep their station-centred circle and the Cargo Hauler its widened
  patrol.
- **Returning:** a returning ship that reaches home joins its idle patrol, or
  for the Mining Freighter its edge tracing, without stopping. No return sets a
  ship's velocity to zero.
- **Lost line of sight:** an engaged ship that cannot see Ada keeps flying: it
  investigates her fixed last-seen position and patrols around it until it sees
  her again or its chase ends. It never waits in place for line of sight.
- **Band holds:** a forward-gun ship (swarm, fighter, interceptor or retaliator)
  holding its standoff band keeps its nose on Ada and strafes along the band on
  its circling side, at least at the minimum speed, moving in or out only to
  regain the band. When peer separation would cancel its request below the
  floor, it strafes on its circling side at the floor.
- **Escort stations:** an escort with a live leader circles it on its station
  ring, 60 beyond the leader's spacing radius, whether engaged or idle. The
  stations of one leader's escorts turn together on the leader's seeded side, so
  the escorts keep their equal angles. The ring's rate moves each escort along
  it at the minimum speed plus its leader's current top pace (its patrol speed,
  or its combat advance while it sieges), so an escort keeps the floor even
  when its leader moves against the ring. An escort on station
  keeps its nose on Ada and strafes while it sees her, even beyond its firing
  range, and faces its travel otherwise.
- **Turret holds:** a frigate or capital that would hold a point instead circles
  it at least at the minimum speed, its centre on a circle of radius 2r around
  the point on its seeded side, r being its spacing radius ([Hulls](#hulls)): 126
  world units for a Shoulder frigate, 170 for a Hammer capital. Its turrets track
  Ada as usual. A `siege` heavy within 4r of Ada circles her at 2r instead of
  pressing straight in. Station guards keep their station-centred circle.
- **Packs:** the members of one pack, two or more live ships sharing a pack ID,
  patrol one shared route instead of their own: the standard seeded ellipse,
  seeded from the pack ID, through the pack anchor, the mean of the live members'
  homes. Members fly it in ship ID order, each at least the pair spacing behind
  the one ahead along the route: the larger of the galaxy's member spacing and
  rA + rB + 20, where each of rA and rB is the larger of that ship's spacing
  radius and its collision radius. When the route
  is shorter than the sum of the pair spacings around it, its radii grow until it
  fits. An engaged pack that loses sight of Ada searches on the same shared route
  through her last-seen position. Escorts with a live leader follow the escort
  rule instead.
- **Peers and obstacles:** patrol, investigation and the holds above apply the
  existing peer separation, as engaged steering does. A ship that a peer still
  blocks never stops: two ships meeting head-on both turn the same way round
  the contact and pass, and a ship wedged between peers leaves along the
  average contact direction. A
  solo ship whose obstacle steering finds no clear course reverses its course,
  and a solo patroller flips its patrol direction, instead of stopping; pack
  members keep their pack's seeded direction. A position limit,
  such as a Phantom blockade's 600 reach, never holds a ship still: at the limit
  it turns along it.
- **Stand-down:** when Phantom's drones stand down after the flagship is
  salvaged, they stop firing and patrol home.

| Value              | Setting                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Minimum speed      | 0.25 of current top speed                                                                                  |
| Turret hold circle | Radius 2r around the held point                                                                            |
| Siege circling     | Radius 2r around Ada once within 4r                                                                        |
| Pack pair spacing  | Larger of the galaxy's member spacing and rA + rB + 20 (each r the larger of spacing and collision radius) |
| Miner edge offset  | r + 20 from the drawn outline to the miner's centre                                                        |
| Miner tracing pace | The minimum speed                                                                                          |
| Miner dwell        | Seeded 6 to 12 seconds per rock, from arrival                                                              |
| Miner recent picks | The last 3 rocks are excluded from the next pick                                                           |
| Miner leash        | The existing 2000 industrial home radius                                                                   |

These values are authored data.

#### Miners

The Mining Freighter retaliator body is the only enemy miner. Cartwheel's claim
jumpers are `fighter` groups that harass miners and patrol like other fighters;
Mica's mining ship is a finale ally and Cartwheel's story miner is a story ship,
neither an enemy. Unengaged and not returning, the Mining Freighter traces
asteroid edges:

- **Edge:** it follows one rock's drawn outline, targeting its centre r + 20
  from the outline, r being its spacing radius (30), so its hull keeps about 20
  world units from the rock. The offset is the target; the Freighter never
  touches the rock. It traces on its seeded side at the minimum speed, 0.25 of
  its current top speed (30 world units per second at its class top speed of
  120), so it holds close to the offset. For the traced rock, obstacle steering
  uses at most half the edge gap (10 world units) as clearance. Every other
  obstacle keeps the usual avoidance berths.
- **Dwell:** counting from its arrival at the rock, it follows the edge for a
  seeded 6 to 12 seconds, seeded from its ship ID and pick count, then picks the
  next rock. It picks at once when the traced rock is destroyed or starts
  moving.
- **Next rock:** the nearest qualifying rock to its current position that is not
  among its last 3 picks. A rock qualifies when it is live and at rest, its
  traced loop lies within 2000 world units of home and outside station and
  destination exclusion zones and the Needle channel, and the straight course to
  its loop clears other scenery at the passage berth. The Freighter travels at its
  patrol pace to the nearest point of that loop, then traces it.
- **No rock:** with no qualifying rock it patrols home on the standard ellipse
  and checks again after each seeded 6 to 12 second dwell.
- **State:** the traced rock's ID, the arrival time, the pick count and the last
  3 picks are saved with the ship's other enemy state and survive Continue.

Engagement, retreat and return are unchanged; a returning Mining Freighter
resumes tracing once it reaches home.

### Obstacle clearance

The optional read-only navigation query steers around authored scenery using the
actual moving hull and drawn obstacle outlines. `ENEMY_AVOIDANCE` in
`src/data/enemyNavigation.ts` supplies the preferred 80-world-unit berth,
40-unit constrained-passage berth and a 1.25 look-ahead multiplier for time
and query reach. Before scaling, look-ahead is the greater of the turn and
acceleration times plus the braking time. The steering grid has 12 directions.
At each clearance, avoidance checks up to five courses: straight and 30 or 60
degrees to either side. Quest guard home placement uses a separate 16-direction
grid. Prediction takes 12 samples, starting at the actual first physics step and
spacing the rest evenly across the remaining horizon.
Moving rocks are obstacles at their predicted position at each sample. A moving
rock is a candidate when its straight path over the look-ahead comes within the
query reach. Each moving rock is predicted along a straight line from its
current velocity, including debris-river rocks, whose curved path this
approximates over the horizon.
These steering clearances do not inflate physical collision geometry or introduce
cover behavior. They do not guarantee the preferred berth in every passage.
Without relevant obstacle candidates, the existing steering path remains active.
Combat speed, pursuit limits, weapon intent and damage remain unchanged.

### Finite pursuit

The home radius is 2500 units for free-roaming swarms and fighters, 3000 for
interceptors, 1500 for frigates, and 1000 for retaliators, capitals and the
finale flagship. Escorts keep their leader-relative behavior.
Keep authored guard patrols, blockade limits and industrial noncombat navigation.
Use the ship's established home and retain existing authored home handling.

The pursuit clock, sight-loss cutoff and rearm delay are 30, 8 and 2 seconds,
respectively. During an active chase, an interceptor steers directly toward
Ada when she is visible and targetable, outside its engagement range, and the
gap is widening. When that condition ends it uses its normal steering again,
including its usual attack passes in range. Existing retreat, navigation and
return-to-home guards still apply.

The pursuit clock counts only time while Ada is unseen or outside the ship's
engagement range, and resets to zero while the ship is fighting her. While Ada is
unseen after actual line-of-sight loss, an engaged mobile ship investigates her
fixed last-seen position at a slower pace, then patrols around it. It does not
follow her hidden position. A chase ends when the pursuit clock reaches `maxSeconds`, the enemy reaches its
home radius, a visible target leaves that radius, or Ada stays unseen for
`unseenSeconds`. Ending a chase latches return-to-home, clears engagement and
suppresses new shots; a returning forward-gun ship faces its travel direction.
Existing projectiles and incoming damage remain active. No grace or invulnerability is granted. Ship physics can retain outward momentum
briefly before turning; the adapter's fixed slice bounds distance overshoot.

Returning mobile craft investigate home and resume patrol instead of stopping
within five world units. A returning ship re-engages when it visibly observes Ada within its perception once
`rearmSeconds` have passed since the return began, or at once when it is hit;
either clears the return latch and resets its pursuit clock. Unknown
observation never re-engages it. After a retreat, sight recovery also requires
engagement admission and the home leash; return recovery keeps its existing
`rearmSeconds` delay. A damaged engine still takes precedence over
return movement. Save and restore the latch, the pursuit clock, unseen time and
time since the return began; unloading or resetting them must not renew a
pursuit. Observation is supplied by the runtime; last-seen state never reads
hidden target coordinates.

### Bounded retreat follow-up

This policy describes the approved retreat source. Morale and `hitAndRun` use independent policies in
`retreats.morale` and `retreats.hitAndRun`. Both inherit `ENEMY_RETREAT`: at most
1.6 seconds or 200 world units of displacement from the retreat origin,
whichever limit is reached first, with a gentle seeded curve of up to 0.5 radians.
The six-second cooldown after completion prevents another retreat, not sight
recovery. Each definition can override either policy independently; route
position no longer supplies a `retreatSeconds` timer.

Swarm, fighter, interceptor and retaliator morale retreats are temporary, not
permanent flight. Recovery requires actual line of sight, targeting permission,
perception range, engagement admission and the existing home leash. Without
reacquisition, ships investigate the fixed last-seen position within the existing
unseen and pursuit limits, then return home and patrol. Existing momentum and
turning still apply; reaching a retreat bound changes steering, not position.
A forward-gun ship in a morale or `hitAndRun` retreat turns to its travel
direction and holds fire; after recovery it fires again only once its aim point
is inside its [nose arc](#nose-fire).

### Runtime integration interface

The settled Tech-owned source paths are `src/model/enemyAi.ts`,
`src/model/enemyAi.test.ts` and `src/data/enemyCatalog.ts`.

`SpaceObject` carries optional `enemy`, `velocity` and `routeId` fields. Enemy state
lives on `SpaceObject.enemy`; ballistic debris uses `SpaceObject.velocity`.
`FlightState.combat` is optional and carries `initialPackSizes` and `routeEncounters`.
`Shot.projectile` is optional and distinguishes bolt, missile and dot projectiles.
There is no parallel enemy-state collection or save-version migration.

`src/model/save.ts` validates these optional fields when present while accepting
complete version-1 saves without them. Enemy state validates catalog membership,
identity, finite vectors, nonnegative timers and HP, and exactly one state entry per
catalog hardpoint. Route IDs and route encounters must belong to the selected galaxy.

The flight adapter must take one peer snapshot and call the rules per live enemy
per simulation slice. Apply resolved movement once, respecting exclusion zones and
collisions. Adapt fire intents into `Shot` with unique `nextId` values, `enemy: true`,
empty hit IDs, configured lifetime, intended velocity and projectile kind. Runtime
shield damage, projectile collisions and danger tracking remain in the flight model.
Only actual targeting threats and projectiles should extend danger, not
unengaged patrolling retaliators. Suppress all intents after defeat.

Route player-shot collisions to explicit hardpoint hit volumes before hull damage.
Apply one hit per collision policy, preserve piercing hit IDs at the appropriate
entity/part granularity, and recalculate effects immediately. Do not filter multipart
enemies out while hull HP remains. Emit `enemyDisabled` exactly once when the
last weapon hardpoint is destroyed, and the destroyed event exactly once when hull
HP reaches 0. Preserve disabled part state while
other parts remain active. No parallel flight loop is provided here.

### Integrated verification required

The canonical regression path is `src/model/enemyAi.test.ts`. Runtime source and
tests remain under `src/`. The integrated isolated gate typechecks, lints, tests
and builds the source, including
actual intents and adapter commands in the following scenarios:

- Identical saved state, snapshot and timestep produce identical JSON and intents;
  observation query order consumes no RNG and cannot change subsequent spawn streams.
- Ballistic debris has identical velocity through repeated steps and no fire intent.
- A visible sight fighter chases and fires; an untouched retaliator does neither.
  Damage activates retaliation. Unknown visibility never grants permission.
- Independent cooldowns survive JSON round trips. Long elapsed fire slices preserve
  scheduled offsets; projectile integration uses each offset exactly once.
- Pursuit ends on distance, time spent unseen or out of firing range, or lost
  observation, and fighting resets its clock; save/load keeps the return latch
  and timers; a returning ship re-engages on sight within perception after
  `rearmSeconds`, or at once when hit.
- A pack losing its configured fraction flees; damage can make one member flee
  before the group. Initial counts persist and unloading is not a casualty.
- Every former resting state keeps a moving ship at or above its minimum speed:
  arriving home, lost line of sight, a band hold, an escort station, a turret
  hold, an idle pack, peer contact, an obstacle with no clear course and a
  position limit. A Mining Freighter traces one rock's edge for its dwell, then
  moves to another. Destroyed, disabled, salvaged and engineless ships, platforms
  and hostile stations still come to rest.
- A destroyed frigate weapon stops firing while the other weapon continues. A
  heavy with every engine lost keeps its prior momentum and coasts to rest.
- Capital hull HP reaching zero destroys it, whatever its hardpoints. Destroying
  every weapon hardpoint first disables it once, and salvaging or destroying a
  disabled heavy produces one outcome event.
- Each archetype's actual velocity stays within its maximum speed, including
  saved momentum.
- An interceptor on a crossing pass keeps its nose on Ada and fires only while
  its aim point is inside its nose arc, with shots along its facing; after
  closest approach it turns to its travel, keeps its speed and holds fire.
- A forward-gun ship breaking off in a retreat turns to its travel direction and
  fires nothing until it faces Ada again.
- A forward-gun ship strafing in its band, a retaliator included, keeps its nose
  on Ada and its requested speed within its sideways and backing-off limits.
- A turret ship's turret fires at Ada astern while its hull faces its travel.
- Quiet encounter placement, exclusion zones, state protection, collision
  routing, offscreen hardpoints, danger tracking and once-only defeat events pass the real integrated flight loop.
