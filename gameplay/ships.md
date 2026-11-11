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
rotate smoothly to face their movement, turning with `turnSeconds`, and keep their
last facing when stopped. A returning enemy slows as it nears home, scaling its
speed by `min(1, distance / (maxSpeed * brakingSeconds))`, and stops within five
world units. Each weapon's aim starts on its first target and then turns with
`aimTurnSeconds`. Hardpoint hit areas and fire origins rotate with the
hull. Hardpoint and hull weapons aim independently of the hull with
`aimTurnSeconds`. An enemy's facing is saved with its other state.

## Values

| Ship               | Size (Ada widths) | `speedRatio` | `accelerationSeconds` | `brakingSeconds` | `turnSeconds` | `aimTurnSeconds` |
| ------------------ | ----------------: | -----------: | --------------------: | ---------------: | ------------: | ---------------: |
| Ada                |                 1 |            1 |                  0.30 |             0.45 |          0.18 |             0.07 |
| `swarm`            |               0.6 |          0.9 |                  0.20 |             0.25 |          0.12 |             0.10 |
| `fighter`          |                 1 |          0.8 |                  0.40 |             0.50 |          0.30 |             0.15 |
| `interceptor`      |               0.9 |          1.1 |                  0.90 |             1.20 |          0.60 |             0.12 |
| `retaliator`       |                 2 |         0.45 |                  1.20 |             1.50 |          0.90 |             0.35 |
| `frigate`          |                 3 |          0.4 |                   1.5 |              2.0 |           1.2 |             0.40 |
| `capital`          |                10 |          0.2 |                   2.5 |              3.0 |           2.0 |             0.50 |
| `oversizedCapital` |                30 |         0.12 |                   3.5 |              4.0 |           3.0 |             0.60 |

Ada's ship has noticeable momentum: it takes about a second to reach full speed,
coasts for over a second when the stick is released, and swings wide on sharp
turns. Small enemies are nimble, the interceptor is fast but carries its momentum
through overshooting passes, and larger ships are progressively heavier.

## Sector one roster

Sector one enemies are four small and medium archetypes from one visual family,
with distinct sizes, behaviours and physics. Frigates and capitals keep their
existing route roles.

| Archetype     | Encounter | Group | Weight |  HP | Behaviour                                                                                                    |
| ------------- | --------- | ----: | -----: | --: | ------------------------------------------------------------------------------------------------------------ |
| `swarm`       | Pack      |   3–5 |   0.35 |   2 | Attacks on sight; erratic circling (orbit 0.9, wobble 0.65, separation 85). Packs retreat after losses.      |
| `fighter`     | Solo/pair |   1–2 |   0.35 |   4 | Attacks on sight; loose orbit (0.4) at its engagement band. A pair shares pack morale.                       |
| `interceptor` | Solo      |     1 |   0.15 |   3 | Attacks on sight; no orbit, engagement band 260, so its momentum carries it past Ada in repeated passes.     |
| `retaliator`  | Solo      |     1 |   0.15 |   8 | Ignores Ada until hit; slow loose orbit (0.2); fires a three-bolt spread (angles −0.2, 0, 0.2; every 2.2 s). |

Weights choose each sector-one encounter's archetype; the group size range replaces
the shared range for that archetype. Values not listed keep the current catalog
values. Other sectors keep the current shared encounter table until they are
themed.

## Presentation

Each sector themes its enemy ships as one visual family. Shapes stay simple and
readable at display size, with distinct silhouettes by role: a small darting
swarm craft, a baseline fighter, a long narrow interceptor and a broad heavy
retaliator. Enemy ships read as hostile and stay distinct from Ada's white and
blue ship. Display size follows the size column relative to Ada's ship.
