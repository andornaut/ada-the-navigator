import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ASTEROID_ART, readResourceRocks } from "../data/asteroidCatalog.ts";
import { PROJECTS } from "../data/projects.ts";
import { resourceArtId } from "../data/resourceRocks.ts";
import { STORY_SHIP_CRAFT } from "../data/storyShips.ts";
import { ASTEROID_SHAPES } from "../model/asteroids.ts";
import { ART_MANIFEST, CORE_MANIFEST, GALAXY_MANIFESTS } from "../testing/publicArt.ts";
import {
  type CartwheelAsset,
  craftArt,
  craftFrameSets,
  galaxyAsset,
  HUB_PROJECT_ART,
  hubLayers,
  readBuoyArt,
  readCraftNose,
  readHubArt,
  storyCraftSets,
  storyNoses,
} from "./cartwheelArt.ts";
import { enemyJetsPath } from "./enemyArt.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8"));
const manifest = ART_MANIFEST as unknown as {
  assets: CartwheelAsset[];
  resourceRocks: string;
};
const assets = manifest.assets;
// A cast portrait sheet ({key}-portrait or {key}-portrait-compact), in any galaxy's manifest.
const portrait = (id: string) => /^[a-z]+(-[a-z]+)*-portrait(-compact)?$/.test(id);

describe("Cartwheel art", () => {
  it("loads the hub, buoy, story craft, debris and claim jumpers from Cartwheel's manifest", () => {
    const sets = new Map<unknown, string[]>();
    for (const asset of assets) {
      const set = galaxyAsset(GALAXY_MANIFESTS, asset);
      sets.set(set, [...(sets.get(set) ?? []), asset.id]);
    }
    // Every galaxy manifest with entries; a placeholder galaxy's holds none.
    const drawn = [...GALAXY_MANIFESTS].filter(([, galaxy]) => galaxy.assets.length > 0);
    expect([...sets.keys()].sort()).toEqual([...drawn.map(([galaxy]) => galaxy), null].sort());
    const cartwheel = sets.get(2)!;
    expect(cartwheel).toEqual(
      expect.arrayContaining([
        "outpost-hub-a",
        "outpost-hub-repaired-b",
        "outpost-hub-bay-a",
        "mooring-buoy-b",
        "craft-blocker-15",
        "cartwheel-debris-7",
      ]),
    );
    // The miner, which other galaxies also fly, is in core with the shared art.
    expect(sets.get(null)).toEqual(expect.arrayContaining(["craft-miner-0", "craft-miner-15"]));
    // Every Cartwheel entry is in one family, counted from the manifest: the hub, the buoy, the
    // three story craft, debris, the claim family's hull frames, the stranded ore pod's blink pairs
    // and hauler's frames, the claim jumpers' part frames, and the cast's portraits, which any
    // galaxy's manifest may carry.
    const part = (id: string) => {
      const entry = assets.find((asset) => asset.id === id)!;
      return entry.hardpoint !== undefined || entry.top !== undefined;
    };
    const families: readonly (readonly [string, (id: string) => boolean, number?])[] = [
      ["hub", (id) => id.startsWith("outpost-hub-"), 6],
      ["buoy", (id) => id.startsWith("mooring-buoy-"), 2],
      ["story craft", (id) => /^craft-(blocker|visitor[12])-/.test(id), 3 * 16],
      ["debris", (id) => id.startsWith("cartwheel-debris-"), 8],
      ["claim hulls", (id) => id.startsWith("enemy-claim-") && !part(id), 6 * 16 + 1],
      ["stranded", (id) => id.startsWith("craft-stranded-"), 16 * 2 + 16],
      ["claim parts", part],
      ["portraits", portrait],
    ];
    for (const id of cartwheel) {
      expect(
        families.filter(([, member]) => member(id)).map(([name]) => name),
        id,
      ).toHaveLength(1);
    }
    for (const [name, member, count] of families) {
      if (count !== undefined) {
        expect(cartwheel.filter(member), name).toHaveLength(count);
      }
    }
    expect(
      sets
        .get(3)!
        .every(
          (id) => /^(whale|whirlpool|nebula-whirlpool|craft-stranded)-/.test(id) || portrait(id),
        ),
    ).toBe(true);
    expect(sets.get(3)!.filter((id) => id.startsWith("whirlpool-debris-"))).toHaveLength(16);
    // Sunflower's outposts load with the boot set from Sunflower's own manifest.
    expect(
      sets
        .get(1)!
        .every(
          (id) => id.startsWith("outpost-") || id.startsWith("craft-stranded-") || portrait(id),
        ),
    ).toBe(true);
    expect(sets.get(1)).toEqual(
      expect.arrayContaining(["outpost-growers-a", "outpost-workshop-b"]),
    );
    const boot = sets.get(null)!;
    expect(boot).toEqual(expect.arrayContaining(["ship", "station-a", "ore-nugget"]));
    // Core holds the craft and whales several galaxies draw, and no galaxy's own art.
    expect(
      boot.some((id) =>
        /^(outpost-|mooring-buoy-|cartwheel-debris-|whale-calf-|whirlpool-)/.test(id),
      ),
    ).toBe(false);
    expect(
      [
        ...new Set(boot.flatMap((id) => /^(craft-[a-z]+|whale-[a-z]+)-/.exec(id)?.[1] ?? [])),
      ].sort(),
    ).toEqual(["craft-miner", "craft-pip", "whale-adult", "whale-whale"]);
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
    const ids = PROJECTS[2]!.map(({ id }) => id);
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
    // Cartwheel's own craft, then the shared ones in core (the miner).
    const sets = storyCraftSets(
      GALAXY_MANIFESTS.get(2)!.assets as unknown as CartwheelAsset[],
      CORE_MANIFEST.assets as unknown as CartwheelAsset[],
    );
    expect(Object.values(STORY_SHIP_CRAFT).filter((craft) => !sets.has(craft))).toEqual([]);
    expect(sets.has("stranded")).toBe(false);
    const art = craftArt((craft) => json(enemyJetsPath(craft, sets.get(craft)![0]!)), sets);
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

  it("finds a story craft in its galaxy's manifest first, then in core", () => {
    const core = craftFrameSets(assets).get("miner")!;
    const own = core.map((frame) => ({ ...frame, path: frame.path.replace("/art/", "/art/own/") }));
    expect(storyCraftSets([], core).get("miner")).toEqual(core);
    expect(storyCraftSets(own, core).get("miner")).toEqual(own);
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

  it("read each story craft's nose by heading, its distance following Art's projection rule", () => {
    for (const craft of new Set(Object.values(STORY_SHIP_CRAFT))) {
      const nose = readCraftNose(json(`/art/cartwheel/${craft}-jets.json`))!;
      expect(nose, craft).toHaveLength(16);
      // distance = 0.4375 * reach * sqrt(7/8 + sin(2a) / 8) at a = k * 22.5 degrees, so each
      // heading's distance over heading 0's is that root over sqrt(7/8).
      const aspect = (k: number) => Math.sqrt(7 / 8 + Math.sin(2 * k * (Math.PI / 8)) / 8);
      nose.forEach(({ distance, tip }, k) => {
        expect(distance / nose[0]!.distance, `${craft} ${k}`).toBeCloseTo(aspect(k) / aspect(0), 3);
        expect(Number.isFinite(tip.x) && Number.isFinite(tip.y)).toBe(true);
      });
    }
    const noses = storyNoses((craft) => json(`/art/cartwheel/${craft}-jets.json`));
    expect(noses["visitor-1"]).toEqual(noses["visitor-2"]);
    expect(noses.miner![10]).toBeGreaterThan(noses["visitor-1"]![10]!);
    // A file without a full, well-formed nose array reads as none.
    const jets = json("/art/cartwheel/miner-jets.json") as { nose: unknown[] };
    expect(readCraftNose({ ...jets, nose: jets.nose.slice(1) })).toBeUndefined();
    expect(
      readCraftNose({ ...jets, nose: [{ distance: -1, tip: [0, 0] }, ...jets.nose.slice(1)] }),
    ).toBeUndefined();
    expect(readCraftNose({})).toBeUndefined();
    expect(storyNoses(() => undefined)).toEqual({});
  });
});
