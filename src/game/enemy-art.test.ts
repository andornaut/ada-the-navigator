import { describe, expect, it } from "vitest";

import fighterJets from "../../public/art/enemies/fighter-jets.json";
import interceptorJets from "../../public/art/enemies/interceptor-jets.json";
import retaliatorJets from "../../public/art/enemies/retaliator-jets.json";
import swarmJets from "../../public/art/enemies/swarm-jets.json";
import manifest from "../../public/art/manifest.json";
import { enemyCatalog, enemyEncounterTuning } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { enemySpeedFraction } from "../model/enemy-ai.ts";
import {
  type EnemyArt,
  enemyArt,
  type EnemyFrame,
  enemyFrameSets,
  enemyJetsPath,
  enemyJetTriangles,
  selectEnemyFrame,
} from "./enemy-art.ts";
import { jetLength } from "./ship-jets.ts";

const assets = manifest.assets as EnemyFrame[];
const files: Record<string, unknown> = {
  fighter: fighterJets,
  interceptor: interceptorJets,
  retaliator: retaliatorJets,
  swarm: swarmJets,
};
const art = enemyArt((archetype) => files[archetype], enemyFrameSets(assets));
const sector = (name: string) => art.get(name)!;
const at = (degrees: number) => ({
  x: Math.cos((degrees * Math.PI) / 180),
  y: Math.sin((degrees * Math.PI) / 180),
});

describe("enemy frame sets", () => {
  it("reads sixteen sized headings for each sector one archetype from Art's manifest", () => {
    expect([...art.keys()].sort()).toEqual(["fighter", "interceptor", "retaliator", "swarm"]);
    const sizes = Object.fromEntries(
      [...art].map(([name, set]) => {
        expect(set.frames).toHaveLength(16);
        expect(set.frames.map((frame) => frame.directionIndex)).toEqual([...Array(16).keys()]);
        return [name, set.frames[0]!.displayWidth];
      }),
    );
    expect(sizes).toEqual({ fighter: 42, interceptor: 38.5, retaliator: 84, swarm: 35 });
  });

  it("leaves vector-only archetypes and non-enemy assets out", () => {
    for (const name of ["frigate", "capital"]) {
      expect(art.has(name)).toBe(false);
    }
    expect(Object.keys(enemyCatalog).filter((name) => art.has(name))).toHaveLength(4);
  });

  it("finds each archetype's jets file beside its frames", () => {
    expect(enemyJetsPath("fighter", sector("fighter").frames[3]!)).toBe(
      "/art/enemies/fighter-jets.json",
    );
  });
});

describe("enemy frame selection", () => {
  it.each([0, 1, 4, 8, 12, 15])("draws heading %i at its exact world angle", (index) => {
    expect(selectEnemyFrame(sector("fighter"), at(index * 22.5)).directionIndex).toBe(index);
  });

  it("draws the nearest of sixteen headings for a continuous facing", () => {
    const set = sector("swarm");
    expect(selectEnemyFrame(set, at(11)).id).toBe("enemy-swarm-0");
    expect(selectEnemyFrame(set, at(12)).id).toBe("enemy-swarm-1");
    expect(selectEnemyFrame(set, at(-11)).id).toBe("enemy-swarm-0");
    expect(selectEnemyFrame(set, at(-12)).id).toBe("enemy-swarm-15");
    // A new hull faces up, world angle -90 degrees.
    expect(selectEnemyFrame(set, { x: 0, y: -1 }).id).toBe("enemy-swarm-12");
  });
});

describe("enemy jets", () => {
  it.each([
    ["swarm", 1, 80],
    ["fighter", 2, 96],
    ["interceptor", 1, 88],
    ["retaliator", 3, 192],
  ] as const)("draws %s with %i mouths of two haloless layers", (name, mouths, frame) => {
    const set = sector(name);
    expect(set.jets?.frame).toBe(frame);
    expect(set.jets?.headings.every((entry) => entry.length === mouths)).toBe(true);
    expect(set.jets?.layers.map((layer) => layer.colors)).toEqual([
      [0xb8644c, 0xf0a07c],
      [0xd68b72, 0xffe2c8],
    ]);
    for (const heading of set.frames) {
      expect(enemyJetTriangles(set, heading, 1)).toHaveLength(mouths * 2);
    }
  });

  it.each(["swarm", "fighter", "interceptor", "retaliator"])(
    "maps %s mouth geometry from frame pixels to display pixels about the pivot",
    (name) => {
      const set = sector(name);
      const jets = set.jets!;
      const frame = set.frames[5]!;
      const scale = frame.displayWidth! / jets.frame;
      const [outer] = jets.layers;
      const mouth = jets.headings[5]![0]!;
      const tip = jetLength(jets, 1) * outer!.length;
      const [left, point, right] = enemyJetTriangles(set, frame, 1)[0]!.points;
      expect(point.x).toBeCloseTo((mouth.anchor.x + mouth.axis.x * tip - jets.frame / 2) * scale);
      expect(point.y).toBeCloseTo((mouth.anchor.y + mouth.axis.y * tip - jets.frame / 2) * scale);
      expect(left.x).toBeCloseTo(
        (mouth.anchor.x + mouth.half.x * outer!.width - jets.frame / 2) * scale,
      );
      expect(right.y).toBeCloseTo(
        (mouth.anchor.y - mouth.half.y * outer!.width - jets.frame / 2) * scale,
      );
    },
  );

  it("does not clip jet tips to the frame", () => {
    const extents = [...art.values()].flatMap((set) =>
      set.frames.flatMap((frame) =>
        enemyJetTriangles(set, frame, 1).flatMap(({ points }) =>
          points.map(
            (point) => Math.max(Math.abs(point.x), Math.abs(point.y)) / (frame.displayWidth! / 2),
          ),
        ),
      ),
    );
    expect(Math.max(...extents)).toBeGreaterThan(1);
  });

  it("scales jets with speed as a fraction of the archetype's maximum speed", () => {
    const set = sector("fighter");
    const frame = set.frames[0]!;
    const definition = enemyCatalog.fighter;
    const maxSpeed = PROTOTYPE.tuning.maxSpeed * definition.physics.speedRatio;
    const fraction = (speed: number) =>
      enemySpeedFraction(
        definition,
        PROTOTYPE.tuning.maxSpeed,
        enemyEncounterTuning.speedCapRatio,
        {
          velocity: { x: 0, y: speed },
        },
      );
    const reach = (f: number) => {
      const [, point] = enemyJetTriangles(set, frame, f)[0]!.points;
      const [left, , right] = enemyJetTriangles(set, frame, f)[0]!.points;
      return Math.hypot(point.x - (left.x + right.x) / 2, point.y - (left.y + right.y) / 2);
    };
    expect(fraction(0)).toBe(0);
    expect(enemyJetTriangles(set, frame, fraction(0))).toEqual([]);
    expect(fraction(maxSpeed / 2)).toBeCloseTo(0.5, 12);
    expect(fraction(maxSpeed * 3)).toBe(1);
    const jets = set.jets!;
    expect(reach(fraction(maxSpeed / 2)) / reach(fraction(maxSpeed))).toBeCloseTo(
      jetLength(jets, 0.5) / jetLength(jets, 1),
      9,
    );
  });
});

describe("enemy art fallback", () => {
  const swarmFrames = assets.filter((asset) => asset.id.startsWith("enemy-swarm-"));

  it("keeps the vector placeholder for an archetype with a missing or mislabelled frame", () => {
    const missing = assets.filter((asset) => asset.id !== "enemy-swarm-7");
    expect(enemyFrameSets(missing).has("swarm")).toBe(false);
    expect(enemyFrameSets(missing).has("fighter")).toBe(true);
    const mislabelled = assets.map((asset) =>
      asset.id === "enemy-fighter-2" ? { ...asset, archetype: "swarm" } : asset,
    );
    expect(enemyFrameSets(mislabelled).has("fighter")).toBe(false);
    const unsized = assets.map((asset) =>
      asset.id === "enemy-interceptor-0" ? { ...asset, displayWidth: 0 } : asset,
    );
    expect(enemyFrameSets(unsized).has("interceptor")).toBe(false);
  });

  it("requires exactly sixteen headings, so a missing last or an extra frame falls back", () => {
    const lastMissing = assets.filter((asset) => asset.id !== "enemy-retaliator-15");
    expect(enemyFrameSets(lastMissing).has("retaliator")).toBe(false);
    expect(enemyFrameSets(lastMissing).has("swarm")).toBe(true);
    const sixteenth = assets.find((asset) => asset.id === "enemy-fighter-15")!;
    const extra = [
      ...assets,
      { ...sixteenth, directionIndex: 16, id: "enemy-fighter-16" } satisfies EnemyFrame,
    ];
    expect(enemyFrameSets(extra).has("fighter")).toBe(false);
    expect(enemyFrameSets(extra).has("interceptor")).toBe(true);
  });

  it("draws frames without jets when the jets file is missing or mismatched", () => {
    const sets = new Map([["swarm", swarmFrames]]);
    const absent = enemyArt(() => undefined, sets).get("swarm")!;
    expect(absent.jets).toBeUndefined();
    expect(enemyJetTriangles(absent, absent.frames[0]!, 1)).toEqual([]);
    const short = { ...swarmJets, headings: swarmJets.headings.slice(0, 8) };
    expect(enemyArt(() => short, sets).get("swarm")!.jets).toBeUndefined();
    const set: EnemyArt = enemyArt(() => swarmJets, sets).get("swarm")!;
    expect(set.jets?.headings).toHaveLength(16);
  });
});
