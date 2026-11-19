---
id: TBD
title: Draw and hit-test every missile blast as an on-screen circle
status: approved
approved: user, 2026-11-18, structured prompt
design: flight-rules
related: [ada-0047, ada-0200, ada-0225]
---

## Scope

Every missile blast, Ada's and enemies', is a circle on screen of radius `R` (30 Rapid, 60 Heavy,
or the level's radius) in the drawn ships' px, centred on the contact or the range-expiry point.
Its tint, ring, inner line, debris and flash draw as circles, and reduced motion shows a static
circular ring. It deals full damage to every enemy, or Ada, whose drawn hull or turret outlines
it overlaps.

## Criteria

- An enemy whose drawn shape the circle reaches takes the full damage in every screen direction,
  and one just past it takes none.
- The nearest covered turret takes a heavy's share, as with other hits; the struck target takes
  its direct damage once.
- Armed mines whose centre the circle covers pop; the enemy ring burst's spawn ellipse is
  unchanged.
- A measurement of hull and turret damage per enemy inside and outside the circle, Rapid and
  Heavy, before and after; browser smoke proofs of a blast over a group at both sizes.

## Decisions

- The radius is screen px, so the circle covers the area of the ground-plane ellipse it replaces.
- A hardpoint without Art's outline is covered when its anchor is within the radius plus a
  hardpoint's reach on screen.

## Outcome
