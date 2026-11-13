# Enemy rule interface

This module supplies pure observation-to-intent rules. Overall encounter placement,
quiet travel and optional versus required fights belong to the version one rules.
All numeric catalog values are provisional tuning, not user-selected values.
Each archetype's maximum speed is fixed in world units ([Ships](ships.md#values)).
Frigates and capitals may block required quest routes in the first five chapters;
the overall placement contract remains in the version one rules.

## Data and state

The catalog interface defines typed aggression, size, physics ([Ships](ships.md)),
perception and engagement radii, behaviours and their parameters, wobble,
separation, firing patterns,
morale, hardpoints and pursuit leashes. [Ships](ships.md) lists sizes, physics and
each galaxy's archetypes, and its [Difficulty](ships.md#difficulty) section
sets hit points, weapon mounts and enemy weapons by route position. Frigates have
one engine and two to four weapons. A capital hull is about 5 Ada widths across and
covers at most a sixth of the screen. Capital command parts never fire. Each weapon carries its own typed fire profile, interval, spread and
projectile speed. Missile profiles travel straight; there is no homing rule.

`createEnemy(definition, identity, position)` creates JSON-serializable state. Identity
includes a stable ID, archetype, nullable pack ID and seeded phase in radians. Use a
named spawn RNG stream in the adapter. The rules consume no randomness and do not
mutate supplied state. Serialize phase, age, engagement, flee latch, velocity, hull
HP, hardpoint HP, cooldowns, home position, last-seen position and age, pursuit
elapsed time and returning latch. Preserve initial pack sizes separately through losses
and save/load. No functions, maps, clocks or runtime objects belong in saved state.

`damageEnemy(definition, hit, state)` applies finite positive damage to the named
hardpoint or to the hull with a null ID. Unknown part IDs do nothing. A valid hit
latches retaliation even when the target is currently unseen. Individual hull damage
can trigger flight without killing a craft. Pack losses latch flight for survivors.
Fleeing craft do not shoot or resume aggression in this encounter.

`enemyEffects(definition, state)` derives destroyed part IDs, disablement and
destruction. A hit on a heavy's hardpoint damages that hardpoint and the hull; a
hull hit damages the hull. Hull HP at 0 destroys the ship. Destroying every weapon
hardpoint disables it while its hull survives: it emits no intents, steers no
more and coasts to rest. A destroyed weapon emits no further shots. Each engine provides an equal share of thrust: a
ship's top speed scales with the fraction of its engines still working, and
with all of them destroyed it has no thrust and coasts to rest from its current
momentum, like a disabled heavy. Other weapons keep firing independently. No primary hull weapon substitutes for a
lost hardpoint. Disabled entities must leave the adapter's active peer snapshot.

## Observation and intents

Call `stepEnemy(definition, context, state)` on a fixed simulation slice, preferably
1/60 second, using one immutable pre-movement peer snapshot for the entire slice.
Context supplies Ada's maximum speed and width, player position, targeting permission,
explicit visibility and initial pack sizes. Inputs must be finite;
use positive dimensions, nonnegative speeds and stable unique entity/part IDs.
Only positive finite dt advances rules. Unknown or occluded visibility grants no
chase or fire permission. It does not classify space as safe or unreachable.
The adapter must supply actual observation and safe-zone permission, not infer them
from hidden runtime state. Peers include self exactly once; preserve initial pack
counts even when survivors are unloaded. Do not count unloading as a loss.

The result contains updated state, desired velocity, aim, fire intents and effects.
State position is deliberately unchanged. Steering and velocity response are rules;
collision resolution and position integration are runtime responsibilities. Commit
resolved position and velocity back into the next saved state. Separation reads only
the supplied snapshot, avoiding array-order feedback. Catalog offsets are
fractions of hull width in the hull's local frame. Hulls rotate to face their
movement, and hardpoint collision and muzzle offsets rotate with them.

Sight aggression latches on visible perception. Retaliators patrol without
attacking until hit.
Engaged craft move by their behaviours ([Ships](ships.md#behaviours)) and separate from
peers. Smooth seeded variation gives each mobile ship a stable patrol shape
without erratic jitter or query-dependent RNG.
Flee direction is away from the observed or last-seen player position. Safe-zone collision policy
must still reject unsafe movement. There is no pathfinder or reachability oracle.

Fire intents contain world-space origin, normalized aim, projectile speed, weapon ID,
profile ID, projectile kind (bolt or missile) and delay within the slice.
Hardpoint ID identifies the emitting weapon; a null ID identifies the hull weapon. Cooldowns persist even outside engagement. Catch-up shots
have explicit delays; advance each new projectile for only `dt - delay`, or schedule
it at that offset. Fixed small slices bound work and integration error. There is
no spawn warning; Astra's drone-arrival line is the only cue. Pattern spread, projectile speed and intervals provide tuning
for readable attacks without adding a warning phase. Disabling a weapon prevents
future fire, but does not delete already emitted projectiles.

`stepDebris(dt, debris)` advances position by constant velocity times dt. Debris has
no AI, pursuit, morale, aim or weapon. The adapter owns seeded region placement and
collision damage. Do not repurpose the stationary quest-debris behavior implicitly.

## Patrol and investigation

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

## Finite pursuit

`pursuit.homeRadius`, `maxSeconds`, `unseenSeconds` and `rearmSeconds` are
provisional finite tuning. The current shared values are 2000 world units, 30
seconds, 6 seconds and 2 seconds. Home is fixed at creation.

The pursuit clock counts only time while Ada is unseen or beyond the ship's
firing range, and resets to zero while the ship is fighting her. While Ada is
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
observation never re-engages it. Retreat and flee morale are unchanged: a
fleeing craft never re-engages. A damaged engine still takes precedence over
return movement. Save and restore the latch, the pursuit clock, unseen time and
time since the return began; unloading or resetting them must not renew a
pursuit. Observation is supplied by the runtime; last-seen state never reads
hidden target coordinates.

## Runtime integration interface

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

## Integrated verification required

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
