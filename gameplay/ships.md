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
([Enemy navigation](#patrol-and-investigation)). Platforms remain
stationary; disabled or salvaged ships do not navigate, and ships with no working
engines coast to rest. Each weapon's aim starts on its first target and then turns with
`aimTurnSeconds`. Hardpoint hit areas and fire origins rotate with the
hull. Hardpoint and hull weapons aim independently of the hull with
`aimTurnSeconds`. An enemy's facing is saved with its other state.

## Values

| Ship          | Size (Ada widths) | `maxSpeed` | `accelerationSeconds` | `brakingSeconds` | `turnSeconds` | `aimTurnSeconds` |
| ------------- | ----------------: | ---------: | --------------------: | ---------------: | ------------: | ---------------: |
| Ada           |                 1 |        175 |                 0.413 |            0.693 |          0.16 |             0.08 |
| `swarm`       |              0.65 |        175 |                  0.20 |             0.25 |          0.12 |             0.10 |
| `fighter`     |                 1 |        160 |                  0.40 |             0.50 |          0.30 |             0.15 |
| `interceptor` |              0.75 |        240 |                  0.90 |             1.20 |          0.60 |             0.12 |
| `retaliator`  |                 2 |        120 |                  1.20 |             1.50 |          0.90 |             0.35 |
| `frigate`     |                 4 |        100 |                   1.5 |              2.0 |           1.2 |             0.40 |
| `capital`     |                 5 |         50 |                   2.5 |              3.0 |           2.0 |             0.50 |
| `platform`    |                 3 |          0 |                     – |                – |             – |             0.30 |

Ada's top speeds are 175, 200 and 225 world units per second. From rest with
full throttle in a straight line, she reaches 90% speed in 0.95, 0.80 and
0.65 seconds. Releasing movement from full speed coasts about 120 world units
at every level in clear space, taking about 3.19, 2.79 or 2.48 seconds to
reach the existing 1% rest threshold. The time constants derive from
`timeTo90 / ln(10)` for acceleration and `120 / (0.99 * topSpeed)` for braking.
Her aim turns with `aimTurnSeconds` 0.08, 0.07 and 0.06 at engine levels 1, 2
and 3, and her movement heading turns twice as slowly, with `turnSeconds` 0.16,
0.14 and 0.12.
Enemy base top speeds are the same in every galaxy. A swarm matches Ada's
level-one top speed. The interceptor's top speed exceeds Ada's at every engine
level. The finale flagship shares the capital's 50-unit top speed and moves at
its existing siege fraction. Ada swings wide on sharp turns. Small enemies are
nimble, interceptors carry momentum through passes, and larger ships are
progressively heavier.
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
| `escort`    | Stays near its leader and intercepts Ada when she comes close to it.                         |
| `siege`     | Advances slowly on Ada while its hardpoint turrets fire; used by frigates and capitals.      |

Provisional parameters: `hitAndRun` retreats after 3 volleys or a hit, using
its independent bounded retreat policy. Morale and `hitAndRun` share initial
limits of 1.6 seconds or 200 world units of displacement, up to 0.5 radians of
seeded curvature and a six-second cooldown, with per-policy overrides. These are
the shared retreat defaults in source.
Recovery requires actual line of sight, perception, engagement admission and the
home leash; otherwise fixed last-seen investigation gives way to home patrol
([Retreat policy](#bounded-retreat-follow-up)). `strafe` passes no closer
than 150 world units and loops back beyond 420; `siege`
advances at half top speed; `escort` holds station 60 beyond its leader's hull,
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
|        1 |         5 |             20 |               2 |             40 |               4 |          ×1 |
|        2 |         5 |             22 |               2 |             44 |               4 |          ×1 |
|        3 |         6 |             30 |               3 |             60 |               6 |        ×1.2 |
|        4 |         6 |             32 |               3 |             64 |               6 |        ×1.3 |
|        5 |         7 |             44 |               4 |             88 |               8 |        ×1.4 |
|        6 |         7 |             48 |               4 |             96 |               8 |        ×1.5 |

- Small-craft columns are hull HP. Outside Sunflower's staged ambient roster,
  the group bonus adds to both ends of each `swarm` and `fighter` group range. Lead is how much of Ada's movement enemy
  aim allows for (see [Enemy aim](#enemy-aim)). Notice and fire rates are
  relative to the base catalog. The Fire column applies to enemy-only weapons; shared
  weapons use the equipped-level rate shares below. Enemy group densities are in [Spawn targets](rules.md#spawn-targets).
- Every heavy hardpoint (weapon, engine, command and platform turret) has the
  position's hardpoint HP: 5, 5, 6, 6, 7 and 7 along the route. The flagship's
  parts have 9 HP. A `platform` hull has half the frigate hull.
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
bolts do not add physical mounts. Projectile speed stays at 0.6 times the
player's level-1 speed for that weapon, without level speed scaling. Enemies
carry no ammunition.

| Archetype       | Weapon signature                                            |
| --------------- | ----------------------------------------------------------- |
| `swarm`         | Laser                                                       |
| `fighter`       | Multi-Laser                                                 |
| `interceptor`   | One Phaser                                                  |
| `retaliator`    | Rapid Missile                                               |
| `frigate`       | One Heavy Missile on `port`; other active mounts Laser      |
| `capital`       | One charged lance or mine layer; other mounts Scattershot   |
| `platform`      | Laser on every active mount                                 |
| Hostile station | Ring burst on `weapon-5`; other active mounts Rapid Missile |

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
line for 0.4 seconds before the beam fires. The aim line stays where it started,
so Ada can move off it.

| Enemy weapon  | Projectile speed | Notes                                               |
| ------------- | ---------------: | --------------------------------------------------- |
| Laser         |              300 | Platform two-shot bursts 0.15 s apart               |
| Multi-Laser   |              240 | The equipped level's fan                            |
| Rapid Missile |              300 | Equipped-level cadence; its blast damages Ada       |
| Heavy Missile |              240 | Equipped-level damage; its blast damages Ada        |
| Scattershot   |              360 | Equipped-level pellet count, damage, range and fade |
| Phaser        |          Hitscan | 0.4 s fixed aim line before firing                  |

Projectile speeds are world units per second. The three enemy-only weapons:

- **Ring burst:** 8 bolts outward in a ring, 1.5 damage each, every 3.5 seconds,
  at 240 world units per second.
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
- **Mounts:** Art draws each heavy class once, with every weapon mount it can
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
route part HP: 72, 98 and 112 respectively. Part hits damage only the selected
part, with no hull damage or overflow. Hull hits damage only the hull. A station
has no hull floor: zero hull destroys it, and disabling every weapon disables it.
Friendly stations retain one HP. Existing ship hull HP and the flagship hull floor
remain unchanged.

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

Ambient encounters use a 900-world-unit local admission radius. Whole groups,
including every escort and hull, must fit the budget and archetype limit, with
at most one nearby capital. Admission conservatively counts live neighbouring
hulls whose footprints could share that neighbourhood, including required
guards, old packs and pursuing ships. Disabled hulls still count; salvaged ships
do not. Fighter groups target four and use the largest size that fits the remaining budget.
Swarms target their configured maximum and fit the remaining budget down to two;
with fewer than two slots they wait rather than spawning a singleton.
One nonstacking local allowance adds two slots near a capital ship or a hostile
station. A proposed capital supplies the allowance to its own formation. Multiple
qualifying ships and stations never add more than two slots. Spawn and first-sight
admission use the same existing footprint neighborhood. Frigates do not supply
this allowance, and all escorts still consume cap slots. Friendly stations do not
qualify. Encounter weights, frequency, HP and rewards are unchanged.

Other groups and all mandatory escorts remain atomic: unaffordable groups are
excluded rather than trimmed, and admission never raises the cap.

### Required guard frigates and support fighters

General ambient frigates retain two mandatory fighter escorts. One ambient
formation counts as three hulls; a pair counts as six. Admit the complete
formation within existing population, archetype and footprint caps or wait.
Required story/quest guard frigates are always present; only their support
fighters may number zero to two. Reserve actual required sites, hulls and
protected footprints before optional rocks/ambient encounters, then fit support
under existing caps. Never turn failed placement into an empty route plan,
raise caps, remotely summon a guard toward Ada or reveal hidden targets.
Guards patrol near their station/objective outside protected clearance and block
the route until defeated or disabled. Support is not an independent blocker.
Persistent identities, surviving followers and casualties do not replenish or
duplicate on revisit/Continue. A disabled or destroyed leader retains the
existing escort fallback. Capital formations and legacy compatibility remain
unchanged. Existing required-guard assertions remain required.

Ambient enemy group densities by galaxy and region are in
[Spawn targets](rules.md#spawn-targets). Each galaxy's encounter rate below sets
its encounter spacing: the quiet distance of 1800 world units, rounded up to whole
512-unit chunks (at least three), divided by the square root of the rate.

Every galaxy uses three geographic regions measured from the galactic center at
the encounter location: inner below 10000 world units, middle from 10000 to below
25000, and outer from 25000 onward. Periodic worlds use the shortest wrapped
center distance. Exploration history, quest intro distance and map progress do
not choose difficulty, and existing enemies keep their composition when crossing.

Composition weights blend linearly across 2000-world-unit bands centered on each
boundary (9000–11000 and 24000–26000). Numeric budgets and archetype limits switch
discretely at 10000 and 25000; they do not interpolate. The fresh-chunk ledger
continues to exclude standing, teleports and revisits for quest pacing.

| Position | Galaxy    | Encounter rate | Encounter spacing (world units) | Inner / middle / outer budget | Archetype limit |
| -------: | --------- | -------------: | ------------------------------: | ----------------------------- | --------------- |
|        1 | Sunflower |          1.725 |                            1559 | 3 / 4 / 5                     | 1 / 2 / 2       |
|        2 | Whirlpool |         1.8975 |                            1487 | 4 / 5 / 6                     | 2               |
|        3 | Needle    |           2.07 |                            1423 | 4 / 5 / 6                     | 3               |
|        4 | Andromeda |         2.2425 |                            1368 | 5 / 6 / 7                     | 4               |
|        5 | Cartwheel |          2.415 |                            1318 | 5 / 6 / 7                     | 4               |
|        6 | Phantom   |         2.5875 |                            1273 | 6 / 7 / 8                     | 4               |

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
| `frigate`     | Solo         |     1 |   0.15 | `siege`; size 4 Ada widths                   |

The whale and family sites each keep their authored capital guard. Whirlpool's
ambient roster has no capitals. Hunting packs are placed near whale destinations
and along the calf-guiding
route. Hunters never target or damage whales; their shots pass through them.
Space currents push small craft and leave frigates and capitals unaffected (see
[the version one rules](rules.md#galaxy-two-whirlpool-whale-family)). Whirlpool adds no new
archetype: currents change how the existing ones fight.

## Needle roster

Needle's drones gather at the mouths of its narrow channels and fly fast passes.

| Archetype      | Encounter | Group | Weight | Behaviours                                   |
| -------------- | --------- | ----: | -----: | -------------------------------------------- |
| `swarm`        | Pack      |   2–8 |   0.20 | `swarm`; packs `flee` after losses           |
| `fighter`      | Patrol    |     4 |   0.25 | `chase`; a group shares pack morale          |
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
| `swarm`        | Pack         |   2–8 |   0.20 | `swarm`; packs `flee` after losses           |
| `fighter`      | Patrol       |     4 |   0.30 | `hitAndRun`; a group shares pack morale      |
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
| `swarm`        | Pack            |   2–7 |   0.25 | `swarm`; packs `flee` after losses                             |
| `fighter`      | Claim jumpers   |     4 |   0.40 | `hitAndRun`; a group shares pack morale                        |
| `interceptor`  | Solo or pair    |   1–2 |   0.12 | `hitAndRun`                                                    |
| `retaliator`   | Solo            |     1 |   0.10 | `retaliate`, then `chase`; three-bolt spread                   |
| `frigate`      | Solo            |     1 |   0.10 | `siege`; size 4 Ada widths                                     |
| Capital battle | Group           |     1 |   0.03 | A `capital` with 4 `escort` fighters                           |
| `platform`     | Ore-field guard |     1 |      – | `siege` at speed 0: two required turrets; placed, not weighted |

An ore field is a seeded cluster of 6 to 10 resource-bearing rocks about 900
world units across, placed like stations: at least 3000 world units apart and
1500 from the hub, stations and quantum jump arrivals. A field holds only its
resource rocks: chunk generation keeps ordinary asteroids out of a 600 world
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
  the frigate and capital, and the hull's hit circle follows the size column.
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

| Archetype      | Encounter    | Group | Weight | Behaviours                                   |
| -------------- | ------------ | ----: | -----: | -------------------------------------------- |
| `swarm`        | Pack         |   2–8 |   0.18 | `swarm`; packs `flee` after losses           |
| `fighter`      | Home guard   |     4 |   0.25 | `chase`; a group shares pack morale          |
| `interceptor`  | Pair         |     2 |   0.15 | `strafe`                                     |
| `retaliator`   | Solo         |     1 |   0.07 | `retaliate`, then `chase`; three-bolt spread |
| `frigate`      | Solo or pair |   1–2 |   0.25 | `siege`; size 4 Ada widths                   |
| Capital battle | Group        |     1 |   0.10 | A `capital` with 6 `escort` fighters         |

Blockades and the finale's waves draw from this roster (see
[the version one rules](rules.md#galaxy-six-phantom-the-finale)). Once the
chapter is complete, Phantom places no new encounters.

## Archie's flagship

Admiral Archie's flagship is a `capital` in his own design, the only crewed ship in
his fleet.

- **Hull and parts:** 160 hull HP; command, two engines and 8 weapon mounts, each
  hardpoint 8 HP. Its weapons follow the capital signature at position 6, as for any
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
  like the calf. Two whales fly side by side, their centres 80 world units
  apart.
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
trigger the same retreat for survivors. Active morale retreat suppresses fire;
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
chase or fire permission. It does not classify space as safe or unreachable.
The adapter must supply actual observation and safe-zone permission, not infer them
from hidden runtime state. Active peers contain live, nonsalvaged, enabled
actors, including self exactly once for an active actor. Disabled hulls remain
physical and saved but do not influence steering or escort observation.
The adapter supplies transient `loadedPackMembers` counts from the full live,
nonsalvaged pre-movement snapshot, including disabled survivors. Morale adds the
existing dormant survivor counts. If the loaded count field is absent, pure
callers retain the peer-count fallback; a supplied map with no pack entry means
zero loaded survivors. Preserve initial pack counts through unloading and
Continue. Neither unloading nor disablement is a casualty.

The result contains updated state, desired velocity, aim, fire intents and effects.
State position is deliberately unchanged. Steering and velocity response are rules;
collision resolution and position integration are runtime responsibilities. Commit
resolved position and velocity back into the next saved state. Separation reads only
the supplied snapshot, avoiding array-order feedback. Authored heading anchors
and turret pivots determine hardpoint and muzzle positions when available.
Their frame offsets use the canonical display scale once, then the existing
inverse projection. Fractional catalog offsets are a fallback when authored
metadata is absent. Hulls rotate to face their movement; collision and muzzle
positions follow the drawn hull and turret headings.

Sight aggression latches on visible perception. Retaliators patrol without
attacking until hit.
Engaged craft move by their behaviours ([Ships](#behaviours)) and separate from
peers. Smooth seeded variation gives each mobile ship a stable patrol shape
without erratic jitter or query-dependent RNG.
Flee direction is away from the observed or last-seen player position. Safe-zone collision policy
must still reject unsafe movement. There is no pathfinder or reachability oracle.

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
aim line; charged lance tracks for 0.7 seconds and locks for 0.3 seconds
before firing. Tell lines and beams stop at obstacles. Each fired beam damages
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

Platforms have no navigation and remain stationary. Disabled or salvaged ships
do not patrol or investigate. A ship with every engine destroyed has no thrust
and coasts to rest. Patrol changes neither aggression, engagement admission,
pursuit leashes nor safe-zone permissions.

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
suppresses new shots. Existing projectiles and incoming damage remain active. No
grace or invulnerability is granted. Ship physics can retain outward momentum
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
per simulation slice. Apply resolved movement once, respecting safe zones and
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
- A destroyed frigate weapon stops firing while the other weapon continues. A
  heavy with every engine lost keeps its prior momentum and coasts to rest.
- Capital hull HP reaching zero destroys it, whatever its hardpoints. Destroying
  every weapon hardpoint first disables it once, and salvaging or destroying a
  disabled heavy produces one outcome event.
- Each archetype's actual velocity stays within its maximum speed, including
  saved momentum.
- Quiet encounter placement, safe zones, collision routing, offscreen hardpoints,
  danger tracking and once-only defeat events pass the real integrated flight loop.
