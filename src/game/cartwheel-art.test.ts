import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ASTEROID_ART, readResourceRocks } from "../data/asteroid-catalog.ts";
import { resourceArtId } from "../data/resource-rocks.ts";
import { STORY_SHIP_CRAFT } from "../data/story-ships.ts";
import { ASTEROID_SHAPES } from "../model/asteroids.ts";
import {
  type CartwheelAsset,
  craftArt,
  craftFrameSets,
  galaxyAsset,
  hubLayers,
  readBuoyArt,
  readHubArt,
} from "./cartwheel-art.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8"));
const manifest = json("/art/manifest.json") as {
  assets: CartwheelAsset[];
  resourceRocks: string;
};
const assets = manifest.assets;

describe("Cartwheel art", () => {
  it("loads the hub, buoy, story craft, nugget and debris with Cartwheel, not at boot", () => {
    const sets = new Map<unknown, string[]>();
    for (const asset of assets) {
      const set = galaxyAsset(asset);
      sets.set(set, [...(sets.get(set) ?? []), asset.id]);
    }
    const cartwheel = sets.get(2)!;
    expect(cartwheel).toEqual(
      expect.arrayContaining([
        "outpost-hub-a",
        "outpost-hub-repaired-b",
        "outpost-hub-bay-a",
        "mooring-buoy-b",
        "craft-miner-0",
        "craft-blocker-15",
        "ore-nugget",
        "cartwheel-debris-7",
      ]),
    );
    // Hub, buoy, four story craft, the nugget, debris and the claim family's 97 hull frames.
    expect(cartwheel).toHaveLength(6 + 2 + 4 * 16 + 1 + 8 + 6 * 16 + 1);
    expect(sets.get("unused")!.every((id) => id.startsWith("craft-stranded-"))).toBe(true);
    expect(sets.get(3)!.every((id) => /^(whale|whirlpool)-/.test(id))).toBe(true);
    expect(sets.get(3)!.filter((id) => id.startsWith("whirlpool-debris-"))).toHaveLength(16);
    const boot = sets.get(null)!;
    expect(boot).toEqual(expect.arrayContaining(["ship", "station-a", "outpost-growers-a"]));
    expect(
      boot.some((id) => /^(craft-|outpost-hub-|mooring-buoy-|cartwheel-debris-)/.test(id)),
    ).toBe(false);
  });

  it("reads the hub by destination: worn, repaired and the second bay overlay", () => {
    const hub = readHubArt(assets)!;
    expect(hub.worn.frames.map((frame) => frame.id)).toEqual(["outpost-hub-a", "outpost-hub-b"]);
    expect(hub.repaired!.frames.map((frame) => frame.id)).toEqual([
      "outpost-hub-repaired-a",
      "outpost-hub-repaired-b",
    ]);
    expect(hub.bay!.frames.map((frame) => frame.id)).toEqual([
      "outpost-hub-bay-a",
      "outpost-hub-bay-b",
    ]);
    expect(hubLayers(hub, true, false)).toEqual([hub.worn]);
    expect(hubLayers(hub, false, false)).toEqual([hub.repaired]);
    expect(hubLayers(hub, true, true)).toEqual([hub.worn, hub.bay]);
    expect(hubLayers(hub, false, true)).toEqual([hub.repaired, hub.bay]);
    expect(readHubArt(assets.filter((asset) => asset.variant !== "worn"))).toBeUndefined();
  });

  it("reads the mooring buoy's blink pair", () => {
    expect(readBuoyArt(assets)!.frames.map((frame) => frame.id)).toEqual([
      "mooring-buoy-a",
      "mooring-buoy-b",
    ]);
    expect(readBuoyArt(assets)!.frameMs).toBe(700);
  });

  it("reads each story craft's 16 headings and speed jets, leaving the stranded craft out", () => {
    const sets = craftFrameSets(assets);
    expect([...sets.keys()].sort()).toEqual(Object.values(STORY_SHIP_CRAFT).sort());
    const art = craftArt((craft) => json(`/art/cartwheel/${craft}-jets.json`), sets);
    for (const [craft, entry] of art) {
      expect(entry.frames.map((frame) => frame.directionIndex)).toEqual(
        Array.from({ length: 16 }, (_, k) => k),
      );
      expect(entry.frames.every((frame) => frame.id.startsWith(`craft-${craft}-`))).toBe(true);
      expect(entry.jets?.headings).toHaveLength(16);
    }
    expect(
      craftFrameSets(assets.filter((asset) => asset.id !== "craft-miner-7")).has("miner"),
    ).toBe(false);
  });

  it("draws each resource rock on its plain shape's exact footprints", () => {
    const rocks = readResourceRocks(json(manifest.resourceRocks))!;
    expect(rocks.rocks.map((rock) => rock.id).sort()).toEqual(
      [...ASTEROID_SHAPES.values()]
        .filter((shape) => shape.size === "medium" || shape.size === "large")
        .map((shape) => resourceArtId(shape.id))
        .sort(),
    );
    const plain = new Map(ASTEROID_ART.asteroids.map((rock) => [resourceArtId(rock.id), rock]));
    // Footprints are world-plane offsets from the base centre, so they match as given.
    for (const rock of rocks.rocks) {
      const base = plain.get(rock.id)!;
      expect(rock.footprintRadius).toBe(base.footprintRadius);
      expect(rock.frames).toHaveLength(rock.size === "medium" ? 24 : 1);
      const ours = rock.frames.flatMap((frame) => frame.footprint.flat());
      const theirs = base.frames.flatMap((frame) => frame.footprint.flat());
      expect(ours).toHaveLength(theirs.length);
      ours.forEach((at, i) => {
        expect(at.x).toBeCloseTo(theirs[i]!.x, 6);
        expect(at.y).toBeCloseTo(theirs[i]!.y, 6);
      });
    }
  });
});
