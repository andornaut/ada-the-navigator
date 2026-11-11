# Enemy rule interface

This module supplies pure observation-to-intent rules. Overall encounter placement,
quiet travel and optional versus required fights belong to the prototype contract.
All numeric catalog values are provisional tuning, not user-selected values.
Most archetypes remain at or below Ada's speed. The selected small interceptor has
an approved maximum ratio of 1.1, and the default configurable speed cap is 1.1.
Frigates and capitals may block required quest routes in the first three chapters;
the overall placement contract remains in the prototype document.

## Data and state

The catalog interface defines typed aggression, size, physics ([Ships](ships.md)),
perception and engagement radii, behaviours and their parameters, wobble,
separation, firing patterns,
morale, hardpoints and pursuit leashes. [Ships](ships.md) lists sizes, physics and
galaxy one's solo and pack archetypes. Frigates have three independent parts: one engine and two
weapons. A capital hull is about 5 Ada widths across and covers at most a sixth of
the screen.
No authored assets or story are introduced. Capital command parts are required but
never fire. Each weapon carries its own typed fire profile, interval, spread and
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

`enemyEffects(definition, state)` derives disabled part IDs and defeat. Every required
part must be disabled to defeat a multipart ship, regardless of hull HP. A disabled
weapon emits no further shots. Each engine provides an equal share of thrust: a
ship's top speed scales with the fraction of its engines still working, and it
stops when all are disabled. Other weapons keep firing independently. No primary hull weapon substitutes for a
lost hardpoint. Disabled entities must leave the adapter's active peer snapshot.

## Observation and intents

Call `stepEnemy(definition, context, state)` on a fixed simulation slice, preferably
1/60 second, using one immutable pre-movement peer snapshot for the entire slice.
Context supplies Ada's maximum speed and width, player position, targeting permission,
explicit visibility, initial pack sizes and speed cap ratio. Inputs must be finite;
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

Sight aggression latches on visible perception. Retaliators remain idle until hit.
Engaged craft move by their behaviours ([Ships](ships.md#behaviours)) and separate from
peers. Sinusoidal phase makes swarm movement erratic without query-dependent RNG.
Flee direction is away from the observed or last-seen player position. Safe-zone collision policy
must still reject unsafe movement. There is no pathfinder or reachability oracle.

Fire intents contain world-space origin, normalized aim, projectile speed, weapon ID,
profile ID, projectile kind (bolt or missile) and delay within the slice.
Hardpoint ID identifies the emitting weapon; a null ID identifies the hull weapon. Cooldowns persist even outside engagement. Catch-up shots
have explicit delays; advance each new projectile for only `dt - delay`, or schedule
it at that offset. Fixed small slices bound work and integration error. No entry or
spawn warning exists. Pattern spread, projectile speed and intervals provide tuning
for readable attacks without adding a warning phase. Disabling a weapon prevents
future fire, but does not delete already emitted projectiles.

`stepDebris(dt, debris)` advances position by constant velocity times dt. Debris has
no AI, pursuit, morale, aim or weapon. The adapter owns seeded region placement and
collision damage. Do not repurpose the stationary quest-debris behavior implicitly.

## Finite pursuit

`pursuit.homeRadius`, `maxSeconds` and `unseenSeconds` are provisional finite tuning.
The current shared values are 1400 world units, 18 seconds and 3 seconds. Home is
fixed at creation. A chase ends when elapsed engagement reaches its limit, the enemy
reaches its home radius, a visible target leaves that radius, or observation expires.
Ending a chase latches return-to-home, clears engagement and suppresses new shots.
Existing projectiles and incoming damage remain active. No grace or invulnerability
is granted. Ship physics can retain outward momentum briefly before
turning; the adapter's fixed slice bounds distance overshoot.

Returning craft steer home and stop within five world units. They can rearm sight
or retaliation only after returning and visibly observing Ada outside perception.
Unknown observation does not satisfy that reset. Remaining nearby cannot reset the
pursuit clock or cause repeated reacquisition. Hits do not clear the return latch.
A damaged engine still takes precedence over return movement. Save and restore the
latch and timers; unloading or resetting them must not renew a pursuit. Observation
is supplied by the runtime; last-seen state never reads hidden target coordinates.

## Runtime integration interface

The settled Tech-owned source paths are `src/model/enemy-ai.ts`,
`src/model/enemy-ai.test.ts` and `src/data/enemy-catalog.ts`.

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
Only actual targeting threats and projectiles should extend danger, not idle
retaliators. Suppress all intents after defeat.

Route player-shot collisions to explicit hardpoint hit volumes before hull damage.
Apply one hit per collision policy, preserve piercing hit IDs at the appropriate
entity/part granularity, and recalculate effects immediately. Do not filter multipart
enemies out merely because hull HP reaches zero. Emit `enemyDisabled` exactly once
when required parts transition to all disabled. Preserve disabled part state while
other parts remain active. No parallel flight loop is provided here.

## Integrated verification required

The canonical regression path is `src/model/enemy-ai.test.ts`. Runtime source and
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
- Faster pursuit terminates on distance, time or lost observation; save/load keeps
  its return latch and nearby targets cannot immediately restart the chase.
- A pack losing its configured fraction flees; damage can make one member flee
  before the group. Initial counts persist and unloading is not a casualty.
- A destroyed frigate weapon stops firing while the other weapon continues. A lost
  engine returns exactly zero velocity immediately, including prior momentum.
- Capital hull HP reaching zero does not defeat it or disable intact weapons.
  Every required part must be disabled, producing one defeat event.
- Cap ratios of 1 and lower constrain actual velocity, including saved momentum.
  The selected interceptor permits 1.1; other catalog ratios remain at or below 1.
- Quiet encounter placement, safe zones, collision routing, offscreen hardpoints,
  danger tracking and once-only defeat events pass the real integrated flight loop.
