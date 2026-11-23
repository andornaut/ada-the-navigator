import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  flashAt,
  hexColor,
  mixColor,
  readDestruction,
  readShards,
  reducedAt,
  shardPolygons,
  wreckFlashAt,
} from "./destructionArt.ts";
import { readShardPalettePack } from "./shardPalettePack.ts";

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public/art/enemies/${path}`, import.meta.url), "utf8"));
const data = readDestruction(read("destruction.json"))!;
const shardSource = (archetype: string) => {
  const value = read(`${archetype}-shards-packed.json`) as {
    core: { archetype: string; halfSpan: number };
  };
  expect(readShardPalettePack(value, archetype)?.core).toBe(value.core);
  return value.core;
};
const fighterSource = shardSource("fighter");
const fighter = readShards(fighterSource)!;
// The producer sizes the flash from the raw model half-span, rounded to three decimals.
const fighterFlashWidth = Math.round(fighterSource.halfSpan * 1.98 * 1000) / 1000;
const timing = data.archetypes.fighter!;

describe("enemy destruction art", () => {
  it("reads the timings and every shard archetype", () => {
    expect(fighterSource).toMatchObject({ archetype: "fighter", frame: 104, halfSpan: 21.44 });
    expect(timing).toMatchObject({
      durationMs: 450,
      flashWidth: fighterFlashWidth,
      releaseMs: 150,
    });
    expect(Object.keys(data.archetypes).sort()).toEqual([
      "fighter",
      "interceptor",
      "retaliator",
      "retaliatorCargoHauler",
      "retaliatorMiningFreighter",
      "swarm",
    ]);
    for (const [archetype, timing] of Object.entries(data.archetypes)) {
      const source = shardSource(archetype);
      expect(source.archetype).toBe(archetype);
      expect(readShards(source), archetype).toBeDefined();
      expect(timing.flashWidth, archetype).toBe(Math.round(source.halfSpan * 1.98 * 1000) / 1000);
    }
    expect(readShards({ version: 2 })).toBeUndefined();
  });

  it("draws the idle frame's shards unmoved at the start", () => {
    const polygons = shardPolygons(data, fighter, timing.durationMs, 0, 0);
    const source = fighter.headings[0]!.shards.flatMap((shard) => shard.polygons);
    expect(polygons).toHaveLength(source.length);
    for (const polygon of polygons) {
      expect(polygon.alpha).toBe(1);
      const match = source.find(
        (entry) =>
          entry.points.length === polygon.points.length &&
          entry.points.every((value, index) => Math.abs(value - polygon.points[index]!) < 1e-9),
      );
      expect(match).toBeDefined();
      expect(polygon.color).toBe(hexColor(match!.color));
    }
  });

  it("drifts, shrinks to 65%, cools 55% and fades shards out by the end", () => {
    const shard = fighter.headings[3]!.shards[0]!;
    const end = shardPolygons(data, fighter, timing.durationMs, 3, timing.durationMs);
    const [x, y] = [shard.polygons[0]!.points[0]!, shard.polygons[0]!.points[1]!];
    const [cx, cy] = shard.centroid;
    const spin = fighter.shards[shard.shard]!.spin;
    const dx = (x - cx) * 0.65;
    const dy = (y - cy) * 0.65;
    const expected = [
      cx + Math.cos(spin) * dx - Math.sqrt(3) * Math.sin(spin) * dy + shard.drift[0],
      cy + (Math.sin(spin) / Math.sqrt(3)) * dx + Math.cos(spin) * dy + shard.drift[1],
    ];
    const moved = end.find(
      (polygon) =>
        Math.abs(polygon.points[0]! - expected[0]!) < 1e-6 &&
        Math.abs(polygon.points[1]! - expected[1]!) < 1e-6,
    );
    expect(moved).toBeDefined();
    expect(moved!.color).toBe(
      mixColor(hexColor(shard.polygons[0]!.color), hexColor("#7f4b3d"), 0.55),
    );
    expect(end.every((polygon) => polygon.alpha === 0)).toBe(true);
  });

  it("keeps hull shards opaque until 30% and fades flecks out by 60%", () => {
    const at = (u: number) => shardPolygons(data, fighter, 1000, 0, u * 1000);
    const kinds = fighter.headings[0]!.shards.map((shard) => fighter.shards[shard.shard]!.kind);
    expect(kinds).toContain("fleck");
    expect(at(0.3).some((polygon) => polygon.alpha === 1)).toBe(true);
    expect(at(0.6).filter((polygon) => polygon.alpha === 0).length).toBeGreaterThan(0);
  });

  it("flashes for 80 ms at full then reduced width", () => {
    expect(flashAt(data, timing, 0)).toEqual({ alpha: 0.922, width: fighterFlashWidth });
    expect(flashAt(data, timing, 40)).toEqual({ alpha: 0.588, width: fighterFlashWidth * 0.55 });
    expect(flashAt(data, timing, 80)).toBeNull();
  });

  it("uses the same destruction flash after missile and other weapon hits", () => {
    expect(wreckFlashAt(data, timing, { age: 0 })).toEqual(flashAt(data, timing, 0));
    expect(wreckFlashAt(data, timing, { age: 0.04 })).toEqual(flashAt(data, timing, 40));
    expect(wreckFlashAt(data, timing, { age: 0, blasted: true })).toEqual(flashAt(data, timing, 0));
    expect(wreckFlashAt(data, timing, { age: 0.04, blasted: true })).toEqual(
      flashAt(data, timing, 40),
    );
    expect(wreckFlashAt(data, timing, { age: 0.08, blasted: true })).toBeNull();
  });

  it("tints, shrinks and fades the idle frame under reduced motion", () => {
    expect(reducedAt(data, timing, 0)).toEqual({ alpha: 1, scale: 1, tint: 0xffffff });
    const half = reducedAt(data, timing, timing.reduced.durationMs / 2)!;
    expect(half.alpha).toBeCloseTo(0.5, 9);
    expect(half.scale).toBeCloseTo(0.9, 9);
    expect(half.tint).toBe(mixColor(0xffffff, 0xc1b9b8, 0.5));
    expect(reducedAt(data, timing, timing.reduced.durationMs)).toBeNull();
  });
});
