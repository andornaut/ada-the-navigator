# Ada the Navigator gameplay

| Reference                     | Covers                                            |
| ----------------------------- | ------------------------------------------------- |
| [Design](design.md)           | Premise, cast and story arc                       |
| [Rules](rules.md)             | Flight, chapter progression, navigation and saves |
| [Ships](ships.md)             | Physics, rosters, combat and enemy AI             |
| [Economy](economy.md)         | Resources, station services, prices and rewards   |
| [Quests](quests.md)           | Jobs, landmarks, markers, scan feedback and goals |
| [Player copy](player-copy.md) | Dialogue, objectives and interface text           |

[Ideas](ideas.md) collects future candidates. [Cheats](../docs/design/cheats.md)
lists the cheats, which act on the real save.

The [cross-game policies](https://github.com/andornaut/game-coordinator/blob/main/docs/design/game-policies.md) define shared settings, updates,
product consistency, saves, cheats and proposal handling. The documents here
retain Ada's specific rules, copy and lifecycle.

## Ownership

Gameplay owns this directory, game rules, gameplay data and values, and player
strings. Tech owns implementation, tooling and integration. Art owns art direction
and assets in `art/` and `public/art/`.

## Handoff interface

Gameplay hands approved rules, data definitions and player text to Tech with the
source branch, base commit and exact commit to integrate. Tech and Gameplay agree
on implementation interfaces as requirements become defined.

Gameplay supplies Art with approved presentation requirements and references to
the corresponding rules and text. Art supplies asset references and usage details
for Tech to integrate. Recording the design does not authorize code or production
asset work.
