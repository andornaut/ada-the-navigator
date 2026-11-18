---
id: TBD
title: Keep the art manifest as a shared core and per-galaxy manifests
status: done
approved: user, 2026-11-11
design: art
related: []
---

## Scope

Define the sprite manifest, then split it into a core manifest for shared art and one manifest per galaxy for art only that galaxy uses.

## Criteria

- `public/art/manifest.json` lists shared entries and maps each stable galaxy id to `public/art/<galaxy>/manifest.json`.
- `art/tools/manifest.ts` refuses a write when an id appears in two manifests or the galaxy map lacks a galaxy.
- The station, discovery cache, coral heavies, drones, and the craft drawn as finale allies (miner, whale, smaller adult, Pip's scooter) are core entries.
- Source licences for reused art are kept beside the manifest data.

## Decisions

- One shared asset bank across galaxies: an entry used by more than one galaxy belongs in core.

## Outcome

Shipped on `main` in 894d3c11, 5ae4d2b7, b43a3a54, 5f08e5b6, 4c160427, e2159811, 75d2b420, f14747a2 and 2668e050.
