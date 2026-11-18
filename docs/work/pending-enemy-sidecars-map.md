---
id: TBD
title: Load enemy and story craft data files from each manifest's sidecars map
status: approved
approved: user, 2026-11-18, download size (policy 820117b), Tech step of ada-0282
design: art
related: [ada-0281, ada-0282]
---

## Scope

The loader and the precache partition read each enemy and story craft's `jets`, `hardpoints`
and `shards` paths from the `sidecars` map of the manifest that lists its frames, instead of
deriving `{craft}-{kind}.json` beside the first frame. Core's coral shards read core's map. A
manifest without the map has no sidecars; a malformed map makes its manifest invalid. Phantom's
claim platform reads Cartwheel's map through the family selection. This lets the ada-0282
dedupe pass point several galaxies at one shared file.

## Criteria

- `enemyJetsPath`, `enemyHardpointsPath` and `enemyShardsPath` look up the map, with no fallback
  derivation, in `scene.ts`, `sceneAssets.ts` and `galaxyPrecacheGroups.ts`.
- For every craft in every manifest, the map names exactly the files the derivation loaded:
  core 12 crafts and 25 paths, Cartwheel 13 and 25, Andromeda 9 and 21, Needle 9 and 20, and
  none for Sunflower, Whirlpool and Phantom.
- Each sidecar is precached in the same group as its craft's frames.

## Decisions

- A craft or kind missing from the map loads no file, so nothing requests a path that does not
  exist.

## Outcome
