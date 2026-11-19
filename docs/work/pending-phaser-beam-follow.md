---
id: TBD
title: Keep every visible Phaser beam on its firing ship's nose or muzzle and aim
status: approved
approved: user, 2026-11-18, structured prompt
design: flight-rules
related: [ada-0047, ada-0225]
---

## Scope

Ada's and enemies' visible Phaser beams are drawn each frame from the firing ship's current fire
origin (Ada's nose, an enemy's drawn muzzle) along that ship's current aim, at the length `L`
fixed when firing. The hit, its coverage and the starburst stay at fire time.

## Criteria

- The beam follows a moving and turning ship at its fire-time length; the hit, damage and
  starburst do not move.
- The enemy Phaser's 0.4 s aim line stays where it started.
- Enemy Phaser hooks use the fire-time contact point and incoming vector; the enemy Lance is
  unchanged.
- The browser smoke captures Ada firing while thrusting and turning, at fire, mid-flash and late
  flash.

## Decisions

- An enemy beam follows the barrel it fired from: each fire intent carries its volley, which
  picks the drawn tip.
- A beam whose ship is destroyed or can no longer aim holds where it last was.

## Outcome
