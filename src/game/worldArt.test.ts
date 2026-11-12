import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { SpaceObject } from "../model/types.ts";
import {
  AMMO_PACK_FRAMES,
  ammoPackFrame,
  BEACON_FRAMES,
  beaconFrame,
  CACHE_FRAMES,
  cacheApproached,
  cacheFrame,
  HOLODISK_FRAMES,
  holodiskFrame,
  holodiskWaypoint,
  isDiscoveryCache,
  type LoopAsset,
  loopPhase,
  readLoopArt,
} from "./worldArt.ts";

const manifest = JSON.parse(
  readFileSync(new URL("../../public/art/manifest.json", import.meta.url), "utf8"),
) as { assets: LoopAsset[] };
const cache = readLoopArt(manifest.assets, "discovery-cache", CACHE_FRAMES)!;
const holodisk = readLoopArt(manifest.assets, "holodisk", HOLODISK_FRAMES)!;
const beacon = readLoopArt(manifest.assets, "holodisk-beacon", BEACON_FRAMES)!;
const ammoPack = readLoopArt(manifest.assets, "ammo-pack", AMMO_PACK_FRAMES)!;

const object = (overrides: Partial<SpaceObject>): SpaceObject => ({
  hp: 1,
  id: "object",
  kind: "pickup",
  radius: 10,
  x: 0,
  y: 0,
  ...overrides,
});

describe("ammo pack art", () => {
  it("reads the core manifest's 16 by 16 clip, centred, and its four named frames", () => {
    expect(ammoPack.asset).toMatchObject({
      displayHeight: 16,
      displayWidth: 16,
      frameHeight: 16,
      frameWidth: 16,
      path: "/art/pickups/ammo-pack.png",
      pivot: { x: 0.5, y: 0.5 },
    });
    expect(ammoPack.frames).toEqual({ glint1: 1, glint2: 2, glint3: 3, rest: 0 });
    expect(ammoPack.loopMs).toBe(1310);
  });

  it("glints from rest: rest 1100 ms, then each glint 70 ms, and round again", () => {
    expect(ammoPackFrame(ammoPack, false, 0)).toBe(0);
    expect(ammoPackFrame(ammoPack, false, 1099)).toBe(0);
    expect(ammoPackFrame(ammoPack, false, 1100)).toBe(1);
    expect(ammoPackFrame(ammoPack, false, 1170)).toBe(2);
    expect(ammoPackFrame(ammoPack, false, 1240)).toBe(3);
    expect(ammoPackFrame(ammoPack, false, 1309)).toBe(3);
    expect(ammoPackFrame(ammoPack, false, 1310)).toBe(0);
  });

  it("holds rest under reduced motion", () => {
    for (const ms of [0, 1100, 1170, 1240]) {
      expect(ammoPackFrame(ammoPack, true, ms)).toBe(0);
    }
  });
});

describe("discovery cache art", () => {
  it("reads the hidden frame and the 1000 ms lit loop from Art's manifest", () => {
    expect(cache.frames).toEqual({ hidden: 0, litA: 1, litB: 2 });
    expect(cache.loopMs).toBe(1000);
    expect(cache.asset.displayWidth).toBe(21);
  });

  it("stays hidden before Ada approaches, then alternates litA and litB every 500 ms", () => {
    expect(cacheFrame(cache, false, false, 600)).toBe(0);
    expect(cacheFrame(cache, true, false, 0)).toBe(1);
    expect(cacheFrame(cache, true, false, 499)).toBe(1);
    expect(cacheFrame(cache, true, false, 500)).toBe(2);
    expect(cacheFrame(cache, true, false, 1000)).toBe(1);
  });

  it("under reduced motion shows hidden, then litA without the loop", () => {
    expect(cacheFrame(cache, false, true, 500)).toBe(0);
    expect(cacheFrame(cache, true, true, 500)).toBe(1);
  });

  it("is approached within the given world distance", () => {
    expect(cacheApproached(160, { x: 0, y: 0 }, { x: 96, y: 128 })).toBe(true);
    expect(cacheApproached(160, { x: 0, y: 0 }, { x: 97, y: 128 })).toBe(false);
  });

  it("marks discovery Stardust pickups as caches, not drops or cargo", () => {
    expect(isDiscoveryCache(object({ amount: 5, role: "discovery" }))).toBe(true);
    expect(isDiscoveryCache(object({ amount: 5 }))).toBe(false);
    expect(isDiscoveryCache(object({ role: "cargo" }))).toBe(false);
    expect(isDiscoveryCache(object({ kind: "resource", role: "discovery" }))).toBe(false);
  });
});

describe("holodisk art", () => {
  it("turns for 810 ms: rest 600 ms, then turn1, edge and turn2 at 70 ms each", () => {
    expect(holodisk.loopMs).toBe(810);
    expect(holodiskFrame(holodisk, false, 0, 599)).toBe(0);
    expect(holodiskFrame(holodisk, false, 0, 600)).toBe(1);
    expect(holodiskFrame(holodisk, false, 0, 670)).toBe(2);
    expect(holodiskFrame(holodisk, false, 0, 740)).toBe(3);
    expect(holodiskFrame(holodisk, false, 0, 810)).toBe(0);
  });

  it("starts each pickup at its own phase and rests under reduced motion", () => {
    expect(holodiskFrame(holodisk, false, 100, 500)).toBe(1);
    expect(holodiskFrame(holodisk, true, 100, 500)).toBe(0);
    const phases = new Set(
      Array.from({ length: 20 }, (_, index) => loopPhase(`holodisk:${index}`, holodisk.loopMs)),
    );
    expect(phases.size).toBeGreaterThan(10);
    expect(Math.max(...phases)).toBeLessThan(810);
  });

  it("pulses the beacon base and bright every 600 ms and holds base under reduced motion", () => {
    expect(beacon.loopMs).toBe(1200);
    expect(beaconFrame(beacon, false, 599)).toBe(0);
    expect(beaconFrame(beacon, false, 600)).toBe(1);
    expect(beaconFrame(beacon, false, 1200)).toBe(0);
    expect(beaconFrame(beacon, true, 600)).toBe(0);
  });

  it("marks the waypoint only while the holodisk destination is placed and not recovered", () => {
    const disk = object({ id: "holodisk", kind: "destination" });
    const rock = object({ id: "rock", kind: "rock" });
    expect(holodiskWaypoint(false, [rock, disk])).toBe(disk);
    expect(holodiskWaypoint(true, [rock, disk])).toBeUndefined();
    expect(holodiskWaypoint(false, [rock])).toBeUndefined();
  });

  it("keeps the placeholders when a sheet or a named frame is missing", () => {
    expect(readLoopArt([], "holodisk", HOLODISK_FRAMES)).toBeUndefined();
    expect(readLoopArt(manifest.assets, "holodisk", ["missing"])).toBeUndefined();
  });
});
