---
id: TBD
title: Render story scenes as environment-only shared scenes
status: done
approved: user, 2026-11-12
design: art
related: [pending-storybook-earth.md]
---

## Scope

Render the story backgrounds without baked character figures, share one bedroom camera, and ship the scenes as a lossless shared package.

## Criteria

- Story backgrounds contain no human or animal figures; portraits in the story panel carry the characters.
- Every bedroom background, alias and glow frame shares one camera; Phantom's opening uses `story-ada-room-invitations` with two blank cream cards.
- Ada and Penny remain on the galaxy map.
- Story scenes ship lossless from the shared composition producer with atomic offline references; authored PNG inputs stay in `art/sources/`.

## Decisions

- The user approved environment-only story scenes, with the galaxy map figures kept as an exception.

## Outcome

Shipped on `main` in ec14e226, 5a9cb9e6, 89b0b4a2, fe0fc23d, 5ba1ef45, acb49fde, 64671a7a and 1e5be0fb.
