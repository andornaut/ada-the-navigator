# Ships

Every ship, Ada's and each enemy archetype, has physics defined in data with the
same fields and the same movement model. All values are provisional tuning.

## Physics

| Field                 | Meaning                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| `speedRatio`          | Maximum speed as a fraction of Ada's base maximum speed (200 world units/s) |
| `accelerationSeconds` | Exponential time constant for velocity to approach a non-zero target        |
| `brakingSeconds`      | Exponential time constant for velocity to approach zero with no target      |
| `turnSeconds`         | Exponential time constant for the movement heading to turn toward a target  |
| `aimTurnSeconds`      | Exponential time constant for the aim direction to turn toward a target     |

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

| Ship          | Size (Ada widths) | `speedRatio` | `accelerationSeconds` | `brakingSeconds` | `turnSeconds` | `aimTurnSeconds` |
| ------------- | ----------------: | -----------: | --------------------: | ---------------: | ------------: | ---------------: |
| Ada           |                 1 |            1 |                  0.30 |             0.45 |          0.18 |             0.07 |
| `swarm`       |              0.65 |          0.9 |                  0.20 |             0.25 |          0.12 |             0.10 |
| `fighter`     |                 1 |          0.8 |                  0.40 |             0.50 |          0.30 |             0.15 |
| `interceptor` |              0.75 |          1.1 |                  0.90 |             1.20 |          0.60 |             0.12 |
| `retaliator`  |                 2 |         0.45 |                  1.20 |             1.50 |          0.90 |             0.35 |
| `frigate`     |                 4 |          0.4 |                   1.5 |              2.0 |           1.2 |             0.40 |
| `capital`     |                 5 |          0.2 |                   2.5 |              3.0 |           2.0 |             0.50 |
| `platform`    |                 3 |            0 |                     – |                – |             – |             0.30 |

Ada's ship has noticeable momentum: it takes about a second to reach full speed,
coasts for over a second when the stick is released, and swings wide on sharp
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

Provisional parameters: `hitAndRun` retreats for 1.6 s after 3 volleys or a
hit; `strafe` passes within 90 world units and loops back beyond 420; `siege`
advances at half top speed; `escort` holds station 60 beyond its capital's hull,
intercepts Ada within 600 and falls back to `hitAndRun` without its capital.
Chasers press in to close range and bounce off on contact. Finite pursuit, return home and the speed cap still apply.
When an encounter regenerates, its survivors are restored by role, so a destroyed
capital never returns as an escort or the reverse. Galaxy one is mildly
more aggressive than the base catalog, and later galaxies ramp difficulty quickly.

## Galaxy one roster

Galaxy one has its own playtest roster.

| Archetype      | Encounter   | Group | Weight |  HP | Behaviours                                                                         |
| -------------- | ----------- | ----: | -----: | --: | ---------------------------------------------------------------------------------- |
| `swarm`        | Pack        |   4–6 |   0.35 |   2 | `swarm`; packs `flee` after losses                                                 |
| `fighter`      | Small group |   1–3 |   0.30 |   4 | `hitAndRun`; a group shares pack morale                                            |
| `interceptor`  | Solo        |     1 |   0.15 |   3 | `strafe`                                                                           |
| `retaliator`   | Solo        |     1 |   0.10 |   8 | `retaliate`, then `chase`; three-bolt spread                                       |
| `frigate`      | Solo        |     1 |   0.07 |  10 | `siege`; size 4 Ada widths                                                         |
| Capital battle | Group       |     1 |   0.03 |   – | A `capital` (5 Ada widths: command, 2 engines, 4 turrets) with 4 `escort` fighters |

Weights choose each galaxy-one encounter; the group size range replaces the
shared range for that archetype. Galaxy one enemies notice Ada from 20% farther
away and fire 15% more often than the base catalog. Encounters come about 20%
more often. Values not listed keep the current catalog values. Cartwheel and
Whirlpool have their own rosters below, in the same format; Black Eye keeps the
current shared encounter table until its roster is specified. All values are
provisional playtest tuning.

## Galaxy two roster

Cartwheel's drones are claim jumpers: they gather at ore fields and hit and run
any miner who comes near, Ada included. Fixed turret platforms guard ore fields.

| Archetype      | Encounter       | Group | Weight |  HP | Behaviours                                                                      |
| -------------- | --------------- | ----: | -----: | --: | ------------------------------------------------------------------------------- |
| `swarm`        | Pack            |   5–7 |   0.25 |   2 | `swarm`; packs `flee` after losses                                              |
| `fighter`      | Claim jumpers   |   2–4 |   0.40 |   5 | `hitAndRun`; a group shares pack morale                                         |
| `interceptor`  | Solo or pair    |   1–2 |   0.12 |   3 | `hitAndRun`                                                                     |
| `retaliator`   | Solo            |     1 |   0.10 |   9 | `retaliate`, then `chase`; three-bolt spread                                    |
| `frigate`      | Solo            |     1 |   0.10 |  12 | `siege`; size 4 Ada widths                                                      |
| Capital battle | Group           |     1 |   0.03 |   – | A `capital` with 4 `escort` fighters                                            |
| `platform`     | Ore-field guard |     1 |      – |  12 | `siege` at speed 0: two turrets, 6 HP each, both required; placed, not weighted |

An ore field is a seeded cluster of 6 to 10 resource-bearing rocks about 900
world units across, placed like stations: at least 3000 world units apart and
1500 from the hub, stations and quantum jump arrivals. Half of claim-jumper
groups are placed at ore fields. Cartwheel enemies notice Ada from 30% farther
away and fire 30% more often than the base catalog, and encounters come about
30% more often.

The `platform` is Cartwheel's one new archetype: fixed guards need a ship that
holds its position, and every existing archetype moves. It reuses `siege`, whose
turrets fire while it advances, with no speed to advance.

- **Placement:** one platform stands at the edge of at most half of the ore
  fields, chosen by the seed, so unguarded ore is always available. Its hull
  keeps a seeded fixed facing.
- **Parts:** two turrets, 6 HP each, both required; the hull has no HP of its
  own. Hit areas, turret mounts and muzzles come from Art's drawn hardpoints,
  as for the frigate and capital, and the hull's hit circle follows the size
  column. Shots on the hull outside a turret do no damage, as on other multipart
  ships.
- **Fire:** each live turret aims independently with `aimTurnSeconds` and fires
  a two-bolt burst, 0.15 seconds between bolts, every 1.4 seconds before the galaxy's fire multiplier while Ada is
  within 520 world units, using the base enemy bolt. It stops firing beyond 520
  and never pursues.
- **State:** retained like a frigate, so disabled turrets and a destroyed
  platform persist until the galaxy regenerates. Ada bounces off it on contact.
  It drops 6 Stardust and has the frigate's weapon drop chance.

## Galaxy three roster

Whirlpool's drones are hunters tracking the whale family, which knows where the
holodisk drifted. They chase rather than hit and run.

| Archetype      | Encounter    | Group | Weight |  HP | Behaviours                                   |
| -------------- | ------------ | ----: | -----: | --: | -------------------------------------------- |
| `swarm`        | Pack         |   5–8 |   0.25 |   3 | `swarm`; packs `flee` after losses           |
| `fighter`      | Hunting pack |   3–4 |   0.30 |   5 | `chase`; a group shares pack morale          |
| `interceptor`  | Solo or pair |   1–2 |   0.15 |   4 | `chase`                                      |
| `retaliator`   | Solo         |     1 |   0.10 |  10 | `retaliate`, then `chase`; three-bolt spread |
| `frigate`      | Solo         |     1 |   0.15 |  12 | `siege`; size 4 Ada widths                   |
| Capital battle | Group        |     1 |   0.05 |   – | A `capital` with 4 `escort` fighters         |

Hunting packs are placed near whale destinations and along the calf-guiding
route. Hunters never target or damage whales; their shots pass through them.
Space currents push small craft and leave frigates and capitals unaffected (see
[the version one rules](rules.md#galaxy-three-whale-family)). Whirlpool
enemies notice Ada from 40% farther away and fire 45% more often than the base
catalog, and encounters come about 35% more often. Whirlpool adds no new
archetype: currents change how the existing ones fight.

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
84 to 104 world units; large and huge rocks keep their radius plus 160 clear of
stations, destinations and launch points. Shapes stay simple and
readable at display size, with distinct silhouettes by role: a small darting
swarm craft, a baseline fighter, a long narrow interceptor and a broad heavy
retaliator. Enemy ships read as hostile and stay distinct from Ada's white and
blue ship. Galaxy-one craft are drawn with 16 heading frames: the model facing
stays continuous and the nearest frame is drawn. A ship drawn with frames and
hardpoints uses the drawn frame's facing for its hardpoint hit areas and muzzles. The size column sets the hit circle's diameter: the mean of the drawn sprite's
length and width, so hits match what is drawn. Sprites keep their drawn sizes.
