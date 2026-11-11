import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ASTEROID_ART, readResourceRocks } from "../data/asteroid-catalog.ts";
import { PROJECTS } from "../data/projects.ts";
import { resourceArtId } from "../data/resource-rocks.ts";
import { STORY_SHIP_CRAFT } from "../data/story-ships.ts";
import { ASTEROID_SHAPES } from "../model/asteroids.ts";
import {
  type CartwheelAsset,
  craftArt,
  craftFrameSets,
  galaxyAsset,
  HUB_PROJECT_ART,
  hubLayers,
  readBuoyArt,
  readHubArt,
} from "./cartwheel-art.ts";
import { ART_MANIFEST, GALAXY_MANIFESTS } from "./test-art-manifest.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8"));
const manifest = ART_MANIFEST as unknown as {
  assets: CartwheelAsset[];
  resourceRocks: string;
};
const assets = manifest.assets;

describe("Cartwheel art", () => {
  it("loads the hub, buoy, story craft, debris and claim jumpers from Cartwheel's manifest", () => {
    const sets = new Map<unknown, string[]>();
    for (const asset of assets) {
      const set = galaxyAsset(GALAXY_MANIFESTS, asset);
      sets.set(set, [...(sets.get(set) ?? []), asset.id]);
    }
    expect([...sets.keys()].sort()).toEqual([1, 2, 3, null].sort());
    const cartwheel = sets.get(2)!;
    expect(cartwheel).toEqual(
      expect.arrayContaining([
        "outpost-hub-a",
        "outpost-hub-repaired-b",
        "outpost-hub-bay-a",
        "mooring-buoy-b",
        "craft-miner-0",
        "craft-blocker-15",
        "cartwheel-debris-7",
      ]),
    );
    // Hub, buoy, four story craft, debris, the claim family's 97 hull frames, the stranded ore
    // pod's blink pairs and hauler's frames, and the claim jumpers' part frames.
    const parts = cartwheel.filter((id) => {
      const entry = assets.find((asset) => asset.id === id)!;
      return entry.hardpoint !== undefined || entry.top !== undefined;
    });
    expect(cartwheel).toHaveLength(6 + 2 + 4 * 16 + 8 + 6 * 16 + 1 + 16 * 2 + 16 + parts.length);
    expect(cartwheel.filter((id) => id.startsWith("craft-stranded-"))).toHaveLength(48);
    expect(sets.get(3)!.every((id) => /^(whale|whirlpool)-/.test(id))).toBe(true);
    expect(sets.get(3)!.filter((id) => id.startsWith("whirlpool-debris-"))).toHaveLength(16);
    // Sunflower's outposts load with the boot set from Sunflower's own manifest.
    expect(sets.get(1)!.every((id) => id.startsWith("outpost-"))).toBe(true);
    expect(sets.get(1)).toEqual(
      expect.arrayContaining(["outpost-growers-a", "outpost-workshop-b"]),
    );
    const boot = sets.get(null)!;
    expect(boot).toEqual(expect.arrayContaining(["ship", "station-a", "ore-nugget"]));
    expect(
      boot.some((id) =>
        /^(craft-|outpost-|mooring-buoy-|cartwheel-debris-|whale-|whirlpool-)/.test(id),
      ),
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

  it("maps every Cartwheel project id to an art key on the hub's entries", () => {
    const keys = new Set(
      assets.flatMap((asset) => (asset.destination === "hub" && asset.project) || []),
    );
    const ids = PROJECTS[2].map(({ id }) => id);
    expect(Object.keys(HUB_PROJECT_ART).sort()).toEqual(ids.sort());
    for (const id of ids) {
      expect(keys.has(HUB_PROJECT_ART[id as keyof typeof HUB_PROJECT_ART])).toBe(true);
    }
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
