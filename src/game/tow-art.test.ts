import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { JOB_POOL, JOB_TUNING } from "../data/jobs.ts";
import type { SectorId } from "../data/types.ts";
import { ART_MANIFEST, GALAXY_MANIFESTS } from "../testing/public-art.ts";
import { keylineWidth, LIGHT_FIELD } from "./light-field.ts";
import {
  craftFrame,
  craftHeading,
  readStrandedCraft,
  readTowLine,
  STRANDED_CRAFT,
  type StrandedCraftArt,
  strandedCraftId,
  towBeads,
  towCurve,
  type TowFrame,
  towOffset,
} from "./tow-art.ts";

const json = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public${path}`, import.meta.url), "utf8"));
const manifest = ART_MANIFEST as unknown as { assets: TowFrame[]; tow: string };
const tow = json(manifest.tow);

/** A galaxy's stranded craft from its own manifest's `tow` data and assets. */
const galaxyCraft = (sector: SectorId): Map<string, StrandedCraftArt> => {
  const galaxy = GALAXY_MANIFESTS.get(sector)!;
  return readStrandedCraft(json(galaxy.tow!), galaxy.assets as unknown as TowFrame[]);
};
const POOL = Object.entries(JOB_POOL).map(([sector, pool]) => ({
  items: pool.craft,
  sector: Number(sector) as SectorId,
}));
const BLINKERS = [
  "stranded-lamp-buoy",
  "stranded-needle-pod",
  "stranded-ore-pod",
  "stranded-seed-pod",
  "stranded-traveler-pod",
  "stranded-whirlpool-pod",
];

describe("tow art", () => {
  it("names a stranded craft for each galaxy's rescue items", () => {
    for (const { items, sector } of POOL) {
      expect(Object.keys(STRANDED_CRAFT[sector] ?? {}).sort(), `sector ${sector}`).toEqual(
        [...items].sort(),
      );
    }
    expect(strandedCraftId(1, "an ore pod")).toBeUndefined();
    expect(strandedCraftId(1, "constructor")).toBeUndefined();
  });

  it("resolves each galaxy's rescue items to its own craft at 16 headings", () => {
    for (const { items, sector } of POOL) {
      const craft = galaxyCraft(sector);
      for (const item of items) {
        const art = craft.get(strandedCraftId(sector, item)!);
        expect(art, `${sector} ${item}`).toBeDefined();
        expect(art!.frames).toHaveLength(16);
        expect(art!.tow).toHaveLength(16);
      }
    }
  });

  it("resolves a pod to Whirlpool's shell pod and Needle's spool pod", () => {
    expect(strandedCraftId(3, "a pod")).toBe("stranded-whirlpool-pod");
    expect(strandedCraftId(4, "a pod")).toBe("stranded-needle-pod");
    expect(galaxyCraft(3).has("stranded-whirlpool-pod")).toBe(true);
    expect(galaxyCraft(4).has("stranded-needle-pod")).toBe(true);
    expect(galaxyCraft(3).has("stranded-needle-pod")).toBe(false);
  });

  it("blinks the pods and the lamp buoy a then b every 700 ms, and draws the rest in one frame", () => {
    const blinkers: string[] = [];
    for (const { sector } of POOL) {
      for (const [id, art] of galaxyCraft(sector)) {
        const ids = art.frames.map((set) => set.map((frame) => frame.id));
        if (ids.every((set) => set.length === 2)) {
          blinkers.push(id);
          expect(art.frameMs, id).toBe(700);
          expect(ids).toEqual(ids.map((_, k) => [`craft-${id}-${k}-a`, `craft-${id}-${k}-b`]));
          expect(craftFrame(art, 5, false, 700).id).toBe(`craft-${id}-5-b`);
          expect(craftFrame(art, 5, true, 700).id).toBe(`craft-${id}-5-a`);
        } else {
          expect(ids, id).toEqual(ids.map((_, k) => [`craft-${id}-${k}`]));
        }
      }
    }
    expect(blinkers.sort()).toEqual(BLINKERS);
  });

  it("puts every heading's tow point inside its frame", () => {
    for (const { sector } of POOL) {
      for (const [id, art] of galaxyCraft(sector)) {
        art.tow.forEach((point, k) => {
          const frame = art.frames[k]![0]!;
          const inside =
            Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            point.x >= 0 &&
            point.x <= frame.width &&
            point.y >= 0 &&
            point.y <= frame.height;
          expect(inside, `${id} ${k}`).toBe(true);
        });
      }
    }
  });

  it("keylines the stranded craft 1 px on a light field", () => {
    expect(LIGHT_FIELD.keylined).toContain("strandedCraft");
    expect(keylineWidth(LIGHT_FIELD, "strandedCraft")).toBe(1);
  });

  it("reads Cartwheel's craft from its own manifest as from core's tow data", () => {
    expect(GALAXY_MANIFESTS.get(2)!.tow).toBe(manifest.tow);
    const own = galaxyCraft(2);
    expect([...own.keys()].sort()).toEqual(["stranded-hauler", "stranded-ore-pod"]);
    expect(own).toEqual(readStrandedCraft(tow, manifest.assets));
  });

  it("reads the cable's layers, beads and cap", () => {
    const line = readTowLine(tow)!;
    expect(line.layers).toEqual([
      { color: "#4F5462", width: 2.5 },
      { color: "#B8BFC9", width: 1.2 },
    ]);
    expect(line.beads).toEqual({ color: "#4F5462", radius: 0.9, spacing: 12, start: 6 });
    expect(line.cap.map(({ radius }) => radius)).toEqual([1.8, 0.8]);
    expect(readTowLine({ ...(tow as object), version: 2 })).toBeUndefined();
  });

  it("reads both craft at 16 headings: the pod's blink pair and the hauler's one frame", () => {
    const craft = readStrandedCraft(tow, manifest.assets);
    const pod = craft.get("stranded-ore-pod")!;
    expect(pod.frames.map((set) => set.map(({ id }) => id))[3]).toEqual([
      "craft-stranded-ore-pod-3-a",
      "craft-stranded-ore-pod-3-b",
    ]);
    expect(pod.frameMs).toBe(700);
    expect(craft.get("stranded-hauler")!.frames[3]!.map(({ id }) => id)).toEqual([
      "craft-stranded-hauler-3",
    ]);
    expect(craftFrame(pod, 3, false, 700).id).toBe("craft-stranded-ore-pod-3-b");
    expect(craftFrame(pod, 3, true, 700).id).toBe("craft-stranded-ore-pod-3-a");
    // A missing heading frame leaves the craft out.
    const partial = manifest.assets.filter(({ id }) => id !== "craft-stranded-hauler-7");
    expect(readStrandedCraft(tow, partial).has("stranded-hauler")).toBe(false);
  });

  it("faces the craft toward Ada and offsets the tow point in display px", () => {
    expect(craftHeading({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    expect(craftHeading({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(4);
    const pod = readStrandedCraft(tow, manifest.assets).get("stranded-ore-pod")!;
    const frame = pod.frames[2]![0]!;
    // Heading 2's lug at (32, 33.835) of the 64 px frame, shown at 28 px.
    expect(towOffset(pod, frame, 2).x).toBeCloseTo(0, 9);
    expect(towOffset(pod, frame, 2).y).toBeCloseTo((33.835 - 32) * (28 / 64), 9);
  });

  it("draws the line straight when taut and sagged by sqrt(3 d (L - d) / 8) when slack", () => {
    const length = JOB_TUNING.tow.line;
    const still = { x: 0, y: 0 };
    const taut = towCurve(length, still, { x: 0, y: 0 }, { x: length, y: 0 });
    expect(taut.every(({ y }) => Math.abs(y) < 1e-9)).toBe(true);
    const chord = 40;
    const slack = towCurve(length, still, { x: 0, y: 0 }, { x: chord, y: 0 });
    const middle = slack[(slack.length - 1) / 2]!;
    expect(middle.x).toBeCloseTo(chord / 2, 9);
    // With no sideways velocity it sags screen-down: world +y here.
    expect(middle.y).toBeCloseTo(Math.sqrt((3 * chord * (length - chord)) / 8), 9);
    // Away from Ada's sideways velocity.
    const moving = towCurve(length, { x: 0, y: 50 }, { x: 0, y: 0 }, { x: chord, y: 0 });
    expect(moving[(moving.length - 1) / 2]!.y).toBeLessThan(0);
  });

  it("spaces beads every 12 px from 6 px off the craft end", () => {
    const beads = readTowLine(tow)!.beads;
    const points = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
    ];
    expect(towBeads(beads, points).map(({ x }) => x)).toEqual([34, 22, 10]);
  });
});
