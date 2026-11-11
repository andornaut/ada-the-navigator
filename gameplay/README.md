# Ada the Navigator gameplay

[Version one design](design.md) records the current premise, story structure,
space play, controls and unresolved details. [Ships](ships.md) defines ship
physics and enemy rosters. [Economy](economy.md) defines Stardust, stations and
the shop. [Ideas](ideas.md) contains proposals outside the
current version. These documents describe design, not implementation.

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
