import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CORE_MANIFEST, publicJson } from "../testing/publicArt.ts";
import { readDestruction, readShards, shardPolygons } from "./destructionArt.ts";
import { readShardPalettePack } from "./shardPalettePack.ts";

const BODIES = [
  "fighter",
  "interceptor",
  "retaliator",
  "retaliatorCargoHauler",
  "retaliatorMiningFreighter",
  "swarm",
] as const;
type Recolor = "claim" | "garnet" | "needle";
type Family = "coral" | Recolor;

const read = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../public/art/${path}`, import.meta.url), "utf8"));
const destruction = readDestruction(read("enemies/destruction.json"))!;
// Each body's shard pack, at the path the core manifest's sidecars name.
const sidecars = CORE_MANIFEST.sidecars as Record<string, { shards: string }>;

function fixture(body: (typeof BODIES)[number]) {
  const wrapper = publicJson(sidecars[body]!.shards) as {
    core: NonNullable<ReturnType<typeof readShards>>;
    palettes: Record<Recolor, Record<string, string>>;
    version: number;
  };
  // Independently materialize the v1 objects represented by the selected production bytes.
  const sources = { coral: wrapper.core } as Record<Family, typeof wrapper.core>;
  for (const family of ["claim", "garnet", "needle"] as const) {
    const source = JSON.parse(JSON.stringify(wrapper.core)) as typeof wrapper.core;
    for (const heading of source.headings) {
      for (const shard of heading.shards) {
        for (const polygon of shard.polygons) {
          Object.assign(polygon, { color: wrapper.palettes[family][polygon.color] });
        }
      }
    }
    sources[family] = readShards(source)!;
  }
  return { sources, wrapper };
}

describe("candidate shard palette pack", () => {
  it.each(BODIES)("restores %s for all four palettes with the same renderer output", (body) => {
    const { sources, wrapper } = fixture(body);
    const sourceBefore = JSON.stringify(wrapper);
    const pack = readShardPalettePack(wrapper, body)!;
    expect(pack.core).toBe(sources.coral);
    expect(pack.forFamily("coral")).toBe(sources.coral);
    for (const [family, source] of Object.entries(sources) as [Family, typeof pack.core][]) {
      const view = pack.forFamily(family);
      expect(view, family).toStrictEqual(source);
      expect(pack.forFamily(family)).toBe(view);
      expect(view.shards).toBe(pack.core.shards);
      expect(view.headings[0]!.shards[0]!.polygons[0]!.points).toBe(
        pack.core.headings[0]!.shards[0]!.polygons[0]!.points,
      );
      const duration = destruction.archetypes[body]!.durationMs;
      for (const heading of [0, 7, 15]) {
        for (const time of [0, duration * 0.45, duration]) {
          expect(shardPolygons(destruction, view, duration, heading, time)).toStrictEqual(
            shardPolygons(destruction, source, duration, heading, time),
          );
        }
      }
    }
    expect(JSON.stringify(wrapper)).toBe(sourceBefore);
  });

  it("rejects a wrong version or body and leaves the existing v1 reader independent", () => {
    const { wrapper } = fixture("fighter");
    expect(readShardPalettePack(wrapper, "swarm")).toBeUndefined();
    expect(readShardPalettePack({ ...wrapper, version: 1 }, "fighter")).toBeUndefined();
    expect(readShardPalettePack(wrapper.core, "fighter")).toBeUndefined();
    expect(readShards(wrapper.core)).toBe(wrapper.core);
  });

  it("publishes no core view when an unrequested family is incomplete or invalid", () => {
    const { wrapper } = fixture("fighter");
    const needle = { ...wrapper.palettes.needle };
    const key = Object.keys(needle)[0]!;
    delete needle[key];
    expect(
      readShardPalettePack({ ...wrapper, palettes: { ...wrapper.palettes, needle } }, "fighter"),
    ).toBeUndefined();
    needle["#010203"] = "#abcdef";
    expect(
      readShardPalettePack({ ...wrapper, palettes: { ...wrapper.palettes, needle } }, "fighter"),
    ).toBeUndefined();
    delete needle["#010203"];
    needle[key] = "not a color";
    expect(
      readShardPalettePack({ ...wrapper, palettes: { ...wrapper.palettes, needle } }, "fighter"),
    ).toBeUndefined();
    needle[key] = wrapper.palettes.needle[key]!;
    needle["#010203"] = "#abcdef";
    expect(
      readShardPalettePack({ ...wrapper, palettes: { ...wrapper.palettes, needle } }, "fighter"),
    ).toBeUndefined();
  });

  it("rejects invalid shard references, motion and points before exposing a view", () => {
    const { wrapper } = fixture("fighter");
    const core = JSON.parse(JSON.stringify(wrapper.core)) as {
      headings: {
        shards: { shard: number; drift: number[]; polygons: { points: number[] }[] }[];
      }[];
    };
    const entry = core.headings[0]!.shards[0]!;
    const original = entry.shard;
    entry.shard = wrapper.core.shards.length;
    expect(readShardPalettePack({ ...wrapper, core }, "fighter")).toBeUndefined();
    entry.shard = original;
    const dx = entry.drift[0]!;
    entry.drift[0] = Infinity;
    expect(readShardPalettePack({ ...wrapper, core }, "fighter")).toBeUndefined();
    entry.drift[0] = dx;
    const points = entry.polygons[0]!.points;
    delete points[0];
    expect(readShardPalettePack({ ...wrapper, core }, "fighter")).toBeUndefined();
    points[0] = NaN;
    expect(readShardPalettePack({ ...wrapper, core }, "fighter")).toBeUndefined();
  });
});
