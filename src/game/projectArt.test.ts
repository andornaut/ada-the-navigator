import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PROJECTS } from "../data/projects.ts";
import { ART_MANIFEST } from "../testing/publicArt.ts";
import {
  boundsOnScreen,
  outpostParts,
  partsBounds,
  type ProjectArt,
  readProjectArt,
  revealAlpha,
} from "./projectArt.ts";
import { readOutpostArt, stationDockWorld, type StationFrame } from "./stationArt.ts";

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const manifest = ART_MANIFEST as unknown as {
  assets: (StationFrame & { outpost?: string })[];
};
const PROJECTS_FILE = read("../../public/art/projects.json") as {
  projects: Record<string, Record<string, unknown>>;
  reveal: Record<string, unknown>;
};
const outposts = readOutpostArt(manifest.assets);
const art = readProjectArt(manifest.assets, outposts, PROJECTS_FILE)!;
const change = (id: string): ProjectArt => art.projects.get(id)!;
const ids = (parts: ReturnType<typeof outpostParts>) =>
  parts.map(({ frame, order }) => [frame.id, order]);

describe("project world-change art", () => {
  it("reads Art's Sunflower changes at their projects' outposts, with a 600 ms reveal", () => {
    expect(art.revealMs).toBe(600);
    expect([...art.projects].map(([id, { kind, outpost }]) => [id, kind, outpost])).toEqual([
      ["greenhouseRing", "replace", "growers"],
      ["workshopCrane", "overlay", "workshop"],
      ["salvageBeacons", "overlay", "salvagers"],
    ]);
    const sites = new Map(
      Object.values(PROJECTS)
        .flat()
        .map(({ id, site }) => [id, site]),
    );
    for (const [id, { outpost }] of art.projects) {
      expect(sites.get(id), id).toBe(outpost);
    }
  });

  it("reads the spare overlay without an outpost and the Needle practice path with its own pair", () => {
    expect(art.world.get("spareBeacon")).toMatchObject({
      frame: { id: "beacon-guide-spare-a" },
      kind: "overlay",
    });
    expect(art.world.get("channelLights")).toMatchObject({
      frames: [{ id: "needle-lamp-a" }, { id: "needle-lamp-b" }],
      kind: "path",
    });
    const projects = structuredClone(PROJECTS_FILE.projects);
    projects.channelLights!.path = "eye";
    projects.spareBeacon!.state = "dented";
    const remaining = readProjectArt(manifest.assets, outposts, { ...PROJECTS_FILE, projects })!;
    expect([...remaining.world.keys()]).toEqual(["practiceBerth", "routeExchange"]);
    projects.practiceBerth!.offset = [0, "bad"];
    projects.routeExchange!.reference = "pip";
    expect(
      readProjectArt(manifest.assets, outposts, { ...PROJECTS_FILE, projects })!.world.size,
    ).toBe(0);
  });

  it("keeps the growers' dock entrance at the same world point under the ring", () => {
    const ring = change("greenhouseRing");
    const growers = outposts.get("growers")!;
    for (const index of [0, 1] as const) {
      const before = stationDockWorld(growers.frames[index])!;
      const after = stationDockWorld(ring.frames[index])!;
      expect(after.offset.x).toBeCloseTo(before.offset.x, 9);
      expect(after.offset.y).toBeCloseTo(before.offset.y, 9);
      expect(after.mouthRadius).toBeCloseTo(before.mouthRadius, 9);
    }
  });

  it("draws the outpost alone without changes, and the ring's frame in its place", () => {
    const growers = outposts.get("growers")!;
    expect(ids(outpostParts(growers, [], 1))).toEqual([["outpost-growers-b", 0]]);
    expect(ids(outpostParts(growers, [change("greenhouseRing")], 0))).toEqual([
      ["outpost-growers-ring-a", 0],
    ]);
    expect(ids(outpostParts(growers, [change("greenhouseRing")], 1))).toEqual([
      ["outpost-growers-ring-b", 0],
    ]);
  });

  it("places each beacon at its anchor, behind first, blinking opposite its neighbours", () => {
    const salvagers = outposts.get("salvagers")!;
    const parts = outpostParts(salvagers, [change("salvageBeacons")], 0);
    expect(ids(parts)).toEqual([
      ["outpost-salvagers-beacon-a", -1],
      ["outpost-salvagers-a", 0],
      ["outpost-salvagers-beacon-b", 1],
      ["outpost-salvagers-beacon-a", 2],
    ]);
    // The Salvagers enlargement applies equally to the hull and beacon anchors: the behind
    // anchor draws first, then the front anchors after the hull, in the file's order.
    const scale = 0.4375 * 1.5 * 1.4;
    const anchors = PROJECTS_FILE.projects.salvageBeacons!.anchors as { x: number; y: number }[];
    for (const [part, anchor] of [
      [parts[0]!, anchors[0]!],
      [parts[2]!, anchors[1]!],
      [parts[3]!, anchors[2]!],
    ] as const) {
      expect(part.offset.x).toBeCloseTo(anchor.x * scale, 9);
      expect(part.offset.y).toBeCloseTo(anchor.y * scale, 9);
    }
    expect(ids(outpostParts(salvagers, [change("salvageBeacons")], 1)).map(([id]) => id)).toEqual([
      "outpost-salvagers-beacon-b",
      "outpost-salvagers-b",
      "outpost-salvagers-beacon-a",
      "outpost-salvagers-beacon-b",
    ]);
  });

  it("draws the crane in front of the workshop at its anchor", () => {
    const parts = outpostParts(outposts.get("workshop")!, [change("workshopCrane")], 1);
    expect(ids(parts)).toEqual([
      ["outpost-workshop-b", 0],
      ["outpost-workshop-crane-b", 1],
    ]);
    // The lifting drum's axis, in the workshop's frame px from its pivot, at its enlargement.
    const scale = 0.4375 * 1.5 * 1.4;
    expect(parts[1]!.offset.x).toBeCloseTo(79.179 * scale, 9);
    expect(parts[1]!.offset.y).toBeCloseTo(45.714 * scale, 9);
  });

  it("leaves out a change whose art does not fit its outpost, and all of them without a reveal", () => {
    const projects = structuredClone(PROJECTS_FILE.projects);
    projects.greenhouseRing!.replaces = ["outpost-workshop-a", "outpost-workshop-b"];
    projects.workshopCrane!.anchors = [{ layer: "above", phase: 0, x: 0, y: 0 }];
    projects.salvageBeacons!.frames = ["outpost-salvagers-beacon-a", "missing"];
    expect(
      readProjectArt(manifest.assets, outposts, { ...PROJECTS_FILE, projects })!.projects.size,
    ).toBe(0);
    expect(
      readProjectArt(manifest.assets, new Map(), PROJECTS_FILE)!.projects.size,
      "outposts without art",
    ).toBe(0);
    for (const reveal of [{ durationMs: 600, easing: "linear" }, { durationMs: 0 }, undefined]) {
      expect(
        readProjectArt(manifest.assets, outposts, { ...PROJECTS_FILE, reveal }),
      ).toBeUndefined();
    }
  });

  it("fades in on cubicOut over the reveal, clamped at both ends", () => {
    expect(revealAlpha(600, -10)).toBe(0);
    expect(revealAlpha(600, 0)).toBe(0);
    expect(revealAlpha(600, 300)).toBeCloseTo(0.875, 9);
    expect(revealAlpha(600, 600)).toBe(1);
    expect(revealAlpha(600, 900)).toBe(1);
  });

  it("counts an outpost on screen once any of its drawn parts overlaps the screen", () => {
    const screen = { height: 390, width: 844 };
    const bounds = partsBounds(
      outpostParts(outposts.get("growers")!, [change("greenhouseRing")], 0),
    );
    // The leaf-petal hull with the ring is 176.4 by 132.3 display px, pivot (0.5, 0.45139).
    expect(bounds.left).toBeCloseTo(-88.2, 9);
    expect(bounds.top).toBeCloseTo(-132.3 * 0.45139, 9);
    expect(boundsOnScreen(screen, { x: -88.15, y: 100 }, bounds)).toBe(true);
    expect(boundsOnScreen(screen, { x: -88.2, y: 100 }, bounds)).toBe(false);
    expect(boundsOnScreen(screen, { x: 400, y: 390 + 59.7 }, bounds)).toBe(true);
    expect(boundsOnScreen(screen, { x: 400, y: 390 + 59.75 }, bounds)).toBe(false);
  });
});
