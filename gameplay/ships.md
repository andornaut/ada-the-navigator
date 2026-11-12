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
`turnSeconds`, its velocity and hull swing round together. A returning enemy slows as it nears home, scaling its
speed by `min(1, distance / (maxSpeed * brakingSeconds))`, and stops within five
world units. Each weapon's aim starts on its first target and then turns with
`aimTurnSeconds`. Hardpoint hit areas and fire origins rotate with the
hull. Hardpoint and hull weapons aim independently of the hull with
`aimTurnSeconds`. An enemy's facing is saved with its other state.

## Values

| Ship          | Size (Ada widths) | `maxSpeed` | `accelerationSeconds` | `brakingSeconds` | `turnSeconds` | `aimTurnSeconds` |
| ------------- | ----------------: | ---------: | --------------------: | ---------------: | ------------: | ---------------: |
| Ada           |                 1 |        160 |                  0.36 |             0.55 |          0.22 |             0.07 |
| `swarm`       |              0.65 |        180 |                  0.20 |             0.25 |          0.12 |             0.10 |
| `fighter`     |                 1 |        160 |                  0.40 |             0.50 |          0.30 |             0.15 |
| `interceptor` |              0.75 |        220 |                  0.90 |             1.20 |          0.60 |             0.12 |
| `retaliator`  |                 2 |         90 |                  1.20 |             1.50 |          0.90 |             0.35 |
| `frigate`     |                 4 |         80 |                   1.5 |              2.0 |           1.2 |             0.40 |
| `capital`     |                 5 |         40 |                   2.5 |              3.0 |           2.0 |             0.50 |
| `platform`    |                 3 |          0 |                     – |                – |             – |             0.30 |

Ada's 160 is her base engine; engine levels 2 and 3 raise it to 190 and 220.
Enemy speeds are fixed and the same in every galaxy: the swarm and interceptor
outrun a new Ada, engine level 2 outruns the swarm, and level 3 matches the
interceptor. Ada's ship has noticeable momentum: it takes about a second to reach full speed,
coasts for about a second and a half when the stick is released, and swings wide on sharp
turns. Small enemies are nimble, the interceptor is fast but carries its momentum
through overshooting passes, and larger ships are progressively heavier.
The `platform` is fixed in place and only turns its turrets.

## Behaviours

Enemy movement comes from a data-driven behaviour library, so each archetype
mixes and matches behaviours and their parameters. Enemies never pace or kite:
none holds a fixed distance or circles at a standoff band. Each one chases,
escapes, or alternates between the two.

| Behaviour   | Movement                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------- |
| `chase`     | Pursues Ada directly and keeps pressing in, firing as it comes.                              |
| `hitAndRun` | Rushes in, then pulls away when hit or after a burst of fire, and comes back.                |
| `strafe`    | Flies straight through past Ada, carried by momentum, then loops back for another pass.      |
| `swarm`     | Chases with erratic wobble and peer separation, so a pack surrounds Ada.                     |
| `flee`      | Runs away; triggered by morale (low hull, pack losses) and ends the encounter for that ship. |
| `retaliate` | Ignores Ada until hit, then switches to its attack behaviour.                                |
| `escort`    | Stays near its capital and intercepts Ada when she comes close to it.                        |
| `siege`     | Advances slowly on Ada while its hardpoint turrets fire; used by frigates and capitals.      |

Provisional parameters: `hitAndRun` retreats after 3 volleys or a hit, for its
position's retreat time ([Difficulty](#difficulty)); `strafe` passes within 90 world units and loops back beyond 420; `siege`
advances at half top speed; `escort` holds station 60 beyond its capital's hull,
intercepts Ada within 600 and falls back to `hitAndRun` without its capital.
Chasers press in to close range and bounce off on contact. Finite pursuit and return home still apply.
When an encounter regenerates, its survivors are restored by role, so a destroyed
capital never returns as an escort or the reverse. The first galaxy is mildly
more aggressive than the base catalog, and difficulty rises along the route (see
[Difficulty](#difficulty)). Escorts also fall back when their capital is disabled.

## Difficulty

Difficulty rises from the first galaxy to the sixth along five levers: tougher
enemies, stronger enemy weapons, denser encounters, more and better-armed heavies,
and more aggressive behaviour. Each galaxy's roster sets its encounters and
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

| Position | `swarm` | `fighter` | `interceptor` | `retaliator` | Group bonus | `hitAndRun` retreat | Notice | Fire | Encounters |
| -------: | ------: | --------: | ------------: | -----------: | ----------: | ------------------: | -----: | ---: | ---------: |
|        1 |       2 |         4 |             3 |            8 |          +0 |               1.6 s |   +20% | +15% |       +20% |
|        2 |       2 |         5 |             3 |            9 |          +0 |               1.5 s |   +30% | +30% |       +30% |
|        3 |       3 |         5 |             4 |           10 |          +1 |               1.4 s |   +40% | +45% |       +35% |
|        4 |       3 |         6 |             4 |           11 |          +1 |               1.2 s |   +45% | +50% |       +40% |
|        5 |       3 |         6 |             5 |           11 |          +2 |               1.1 s |   +50% | +55% |       +40% |
|        6 |       3 |         6 |             5 |           12 |          +2 |               1.0 s |   +50% | +60% |       +40% |

Heavies:

| Position | Hardpoint | `frigate` hull | Frigate weapons | `capital` hull | Capital weapons | Heavy share |
| -------: | --------: | -------------: | --------------: | -------------: | --------------: | ----------: |
|        1 |         4 |             20 |               2 |             40 |               4 |          ×1 |
|        2 |         4 |             22 |               2 |             44 |               4 |          ×1 |
|        3 |         5 |             30 |               3 |             60 |               6 |        ×1.2 |
|        4 |         5 |             32 |               3 |             64 |               6 |        ×1.3 |
|        5 |         6 |             44 |               4 |             88 |               8 |        ×1.4 |
|        6 |         6 |             48 |               4 |             96 |               8 |        ×1.5 |

- Small-craft columns are hull HP. The group bonus adds to both ends of every
  `swarm` and `fighter` group range. Notice, fire and encounter rates are relative to the base catalog.
- Every heavy hardpoint (weapon, engine, command and platform turret) has the
  position's hardpoint HP. A `platform` hull has half the frigate hull.
- Heavy share multiplies the roster's `frigate` and `capital` weights; the weights
  then renormalize. Placed platforms are not weighted.

### Enemy weapons

Enemies fire the same weapons Ada does, plus three weapons only they carry. A
weapon's damage, blast and spread are the same whoever fires it, at the same level
(see [Flight and combat](rules.md#flight-and-combat)). Each enemy's fire cadence
and projectile speed stay its own, so attacks stay readable and dodgeable. Enemies
carry no ammunition. Weapon levels rise with position:

| Archetype     | Positions 1–2                  | Positions 3–4                                                    | Positions 5–6                                                                       |
| ------------- | ------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `swarm`       | Laser 1                        | Laser 2                                                          | Laser 3                                                                             |
| `fighter`     | Laser 1                        | Rapid Missile 2                                                  | Rapid Missile 3                                                                     |
| `interceptor` | Laser 1                        | Scattershot 2                                                    | Scattershot 3                                                                       |
| `retaliator`  | Multi-Laser 1                  | Multi-Laser 2                                                    | Multi-Laser 3                                                                       |
| `frigate`     | 2 × Laser 1                    | 2 × Laser 2, Rapid Missile 2                                     | 2 × Laser 3, Rapid Missile 3, charged lance                                         |
| `capital`     | 2 × Laser 1, 2 × Multi-Laser 1 | 2 × Laser 2, 2 × Multi-Laser 2, Rapid Missile 2, Heavy Missile 1 | 2 × Laser 3, 2 × Rapid Missile 3, Heavy Missile 1, Phaser 1, ring burst, mine layer |
| `platform`    | 2 × Laser 1                    | 2 × Laser 2                                                      | 2 × Laser 3                                                                         |

Enemy Heavy Missile and Phaser stay at level 1: their single hits are large, so a
capital's Heavy Missile flies slowly and its Phaser shows a thin aim line for 0.4
seconds before the beam fires. The aim line stays where it started, so Ada can
move off it.

| Enemy weapon  | Interval | Projectile speed | Notes                                                         |
| ------------- | -------: | ---------------: | ------------------------------------------------------------- |
| Laser         |    1.4 s |             ×1.7 | `swarm` 1.8 s and ×1.5; platform two-shot bursts 0.15 s apart |
| Multi-Laser   |    2.2 s |             ×1.7 | The level's fan                                               |
| Rapid Missile |    2.0 s |             ×1.3 | Its blast damages Ada                                         |
| Heavy Missile |    4.0 s |             ×0.6 | Its blast damages Ada                                         |
| Scattershot   |    2.4 s |             ×1.7 | Ada's dot count, range and fade                               |
| Phaser        |    3.0 s |          Hitscan | 0.4 s aim line first                                          |

Intervals are before the position's fire rate. Projectile speeds multiply the
base enemy projectile speed, a fixed 200 world units per second. Damage at each
level is the shared per-level damage of Ada's weapon. The three enemy-only weapons:

- **Ring burst:** 8 bolts outward in a ring, 1.5 damage each, every 3.5 seconds,
  at ×1.2.
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
- **Destroyed:** at 0 hull HP the ship breaks apart and drops its Stardust and the
  usual weapon chance (see [Economy](economy.md#earning-stardust)).
- **Disabled:** when every weapon hardpoint is destroyed, the ship is disabled,
  whatever its hull HP. It stops attacking and steering, coasts to rest, no longer
  counts for battle, and shows a red "Disabled" banner above its hull.
- **Salvage:** within Talk range of a disabled heavy, Use offers Salvage. Salvaging drops the ship's Stardust and five times its usual weapon
  chance, and spares the ship: it powers down, its banner goes, it is drawn dimmed,
  and shots and Ada pass through it. Ada can instead keep shooting a disabled ship
  until its hull breaks; that drops the usual reward.
- **Engines and command:** each engine still provides an equal share of thrust.
  Command parts never fire and do not count toward disabling.
- **Mounts:** Art draws each heavy class once, with every weapon mount it can
  carry. A mount the position leaves unused is drawn as a capped plate with no
  hardpoint. Black Eye's capital is General Gadget's own, more threatening design.
- **State:** hull HP, hardpoints, disabled and salvaged states are retained like
  other heavy state until the galaxy regenerates.

## Sunflower roster

| Archetype      | Encounter   | Group | Weight | Behaviours                                                                             |
| -------------- | ----------- | ----: | -----: | -------------------------------------------------------------------------------------- |
| `swarm`        | Pack        |   4–6 |   0.35 | `swarm`; packs `flee` after losses                                                     |
| `fighter`      | Small group |   1–3 |   0.30 | `hitAndRun`; a group shares pack morale                                                |
| `interceptor`  | Solo        |     1 |   0.15 | `strafe`                                                                               |
| `retaliator`   | Solo        |     1 |   0.10 | `retaliate`, then `chase`; three-bolt spread                                           |
| `frigate`      | Solo        |     1 |   0.07 | `siege`; size 4 Ada widths                                                             |
| Capital battle | Group       |     1 |   0.03 | A `capital` (5 Ada widths: command, 2 engines, weapon mounts) with 4 `escort` fighters |

Weights choose each encounter; the group size range replaces the shared range
for that archetype. Values not listed keep the current catalog values. Each
galaxy below has its own roster in the same format; Black Eye keeps the current
shared encounter table until its roster is specified. All values are
provisional playtest tuning.

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
  rule and has the frigate's weapon drop chance.

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
