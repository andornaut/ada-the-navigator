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
- The 18 industrial craft sidecars in Andromeda, Cartwheel and Needle
  (`retaliatorCargoHauler` and `retaliatorMiningFreighter` jets, hardpoints and shards) move from
  the mandatory base into their galaxy's precache group. They belong to that galaxy; the base
  placement came from the derivation keying their frames by `retaliator`, so nothing referenced
  them.

## Outcome

Precache groups over the 8,333 files under `public/`, before and after:

| Group     | Before | After |
| --------- | -----: | ----: |
| Sunflower |     58 |    58 |
| Cartwheel |  1,480 | 1,486 |
| Whirlpool |    340 |   340 |
| Needle    |  1,036 | 1,042 |
| Andromeda |  1,426 | 1,432 |
| Phantom   |     60 |    60 |
| Base      |  3,933 | 3,915 |
