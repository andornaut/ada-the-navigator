import { describe, expect, it } from "vitest";

import {
  type ExclusionZone,
  planRegion,
  SPAWN_RULE,
  type SpawnBand,
  type SpawnPlacement,
  type SpawnPlan,
  type SpawnRegion,
  type SpawnRules,
} from "./spawnPlanner.ts";

const band: SpawnBand = {
  enemies: [
    {
      density: 1.5,
      escorts: { kind: "escort", perLeader: 2, radius: 8, ring: 70 },
      groupSize: [1, 2],
      kind: "heavy",
      radius: 40,
      spacing: 120,
    },
    { density: 2, groupSize: [2, 4], kind: "fighter", radius: 10, spacing: 100 },
  ],
  from: 0,
  moving: [
    { density: 1.5, from: ["big", "small"], groupShare: 0.75, kind: "mover", speed: [10, 80] },
  ],
  rocks: [
    { density: 0.6, kind: "big", shapes: [{ id: "big-a", radius: 70, weight: 1 }] },
    {
      density: 6,
      kind: "small",
      shapes: [
        { id: "small-a", radius: 15, weight: 2 },
        { id: "small-b", radius: 30, weight: 1 },
      ],
    },
  ],
};
const rules: SpawnRules = {
  bands: [band],
  chunkSize: 512,
  corridor: 20,
  gap: 40,
  jitter: 100,
  search: 256,
  tries: 12,
};
const region: SpawnRegion = { cell: { x: -1, y: -1 }, columns: 3, exclusions: [], rows: 3 };
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function pairs(placements: readonly SpawnPlacement[]): [SpawnPlacement, SpawnPlacement][] {
  return placements.flatMap((a, index) =>
    placements.slice(index + 1).map((b) => [a, b] as [SpawnPlacement, SpawnPlacement]),
  );
}

function deliveredOf(plan: SpawnPlan, kind: string): number {
  return plan.placements.filter((placement) =>
    placement.kind === kind ? true : placement.moving?.kind === kind,
  ).length;
}

describe("planRegion", () => {
  it("returns the same plan for the same seed, rules and region", () => {
    for (const seed of SEEDS) {
      expect(planRegion(rules, seed, region)).toEqual(planRegion(rules, seed, region));
    }
    expect(planRegion(rules, 1, region).placements).not.toEqual(
      planRegion(rules, 2, region).placements,
    );
  });

  it("keeps every footprint plus the gap clear of every other", () => {
    for (const seed of SEEDS) {
      const { placements } = planRegion(rules, seed, region);
      expect(placements.length).toBeGreaterThan(40);
      for (const [a, b] of pairs(placements)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
          a.radius + b.radius + rules.gap,
        );
      }
    }
  });

  it("keeps static rocks out of the chunk lanes", () => {
    const size = rules.chunkSize;
    const lane = rules.corridor!;
    for (const seed of SEEDS) {
      for (const rock of planRegion(rules, seed, region).placements) {
        if (rock.category !== "rock") {
          continue;
        }
        const local = (value: number) => ((value % (size / 2)) + size / 2) % (size / 2);
        for (const offset of [local(rock.x), local(rock.y)]) {
          expect(offset).toBeGreaterThanOrEqual(rock.radius + lane);
          expect(size / 2 - offset).toBeGreaterThanOrEqual(rock.radius + lane);
        }
      }
    }
  });

  it("keeps each category out of the zones that apply to it", () => {
    const exclusions: ExclusionZone[] = [
      {
        applies: ["rock", "enemy"],
        rule: "calm",
        shape: { kind: "disc", radius: 300, x: 0, y: 0 },
      },
      { applies: ["enemy"], rule: "arrival", shape: { kind: "disc", radius: 200, x: 500, y: 500 } },
      {
        applies: ["rock", "moving"],
        rule: "current",
        shape: {
          halfWidth: 60,
          kind: "path",
          points: [
            { x: -768, y: 600 },
            { x: 0, y: 400 },
            { x: 768, y: 600 },
          ],
        },
      },
      {
        applies: ["moving"],
        rule: "channel",
        shape: { kind: "disc", radius: 250, x: -500, y: -500 },
      },
    ];
    const zoned = { ...region, exclusions };
    let rocksInEnemyZone = 0;
    for (const seed of SEEDS) {
      const plan = planRegion(rules, seed, zoned);
      for (const placement of plan.placements) {
        const categories = [placement.category, ...(placement.moving ? ["moving" as const] : [])];
        for (const zone of exclusions) {
          if (!zone.applies.some((category) => categories.includes(category))) {
            continue;
          }
          if (zone.shape.kind === "disc") {
            expect(
              Math.hypot(placement.x - zone.shape.x, placement.y - zone.shape.y),
            ).toBeGreaterThanOrEqual(zone.shape.radius + placement.radius);
          } else {
            // The test path's segments are sampled densely enough to bound its distance.
            const points = zone.shape.points;
            for (let index = 1; index < points.length; index++) {
              const [a, b] = [points[index - 1]!, points[index]!];
              for (let step = 0; step <= 200; step++) {
                const t = step / 200;
                const at = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
                expect(Math.hypot(placement.x - at.x, placement.y - at.y)).toBeGreaterThanOrEqual(
                  zone.shape.halfWidth + placement.radius - 1e-6,
                );
              }
            }
          }
        }
        if (
          placement.category === "rock" &&
          Math.hypot(placement.x - 500, placement.y - 500) < 200 + placement.radius
        ) {
          rocksInEnemyZone++;
        }
      }
      for (const rule of ["calm", "current"]) {
        expect(
          Object.values(plan.report.kinds).some((kind) => (kind.rejections[rule] ?? 0) > 0),
        ).toBe(true);
      }
    }
    // A zone for enemies alone still admits rocks.
    expect(rocksInEnemyZone).toBeGreaterThan(0);
  });

  it("chooses moving rocks from the placed rocks without changing them", () => {
    const still = { ...rules, bands: [{ ...band, enemies: [], moving: [] }] };
    let moved = 0;
    for (const seed of SEEDS) {
      const plan = planRegion({ ...rules, bands: [{ ...band, enemies: [] }] }, seed, region);
      const base = planRegion(still, seed, region);
      const at = (placement: SpawnPlacement) => [placement.id, placement.x, placement.y];
      expect(plan.placements.map(at)).toEqual(base.placements.map(at));
      expect(base.placements.some((placement) => placement.moving)).toBe(false);
      const movers = plan.placements.filter((placement) => placement.moving);
      moved += movers.length;
      for (const mover of movers) {
        expect(["big", "small"]).toContain(mover.kind);
        const speed = Math.hypot(mover.moving!.velocity.x, mover.moving!.velocity.y);
        expect(speed).toBeGreaterThanOrEqual(10);
        expect(speed).toBeLessThanOrEqual(80);
      }
      for (const chunk of new Set(movers.map((mover) => mover.chunk))) {
        const group = movers.filter((mover) => mover.chunk === chunk);
        const grouped = group.filter((mover) => mover.moving!.grouped);
        expect(new Set(grouped.map((mover) => JSON.stringify(mover.moving!.velocity))).size).toBe(
          grouped.length ? 1 : 0,
        );
        expect(grouped.length).toBe(group.length > 1 ? Math.ceil(group.length * 0.75) : 0);
      }
    }
    expect(moved).toBeGreaterThan(40);
  });

  it("accounts for every request as delivered or dropped, by rule", () => {
    const crowded: SpawnRules = {
      ...rules,
      bands: [
        { ...band, rocks: band.rocks.map((rock) => ({ ...rock, density: rock.density * 3 })) },
      ],
    };
    let dropped = 0;
    for (const seed of SEEDS) {
      const plan = planRegion(crowded, seed, region);
      for (const [kind, report] of Object.entries(plan.report.kinds)) {
        expect(report.requested).toBe(report.delivered + report.dropped);
        expect(report.dropped).toBe(Object.values(report.drops).reduce((sum, n) => sum + n, 0));
        expect(report.delivered).toBe(deliveredOf(plan, kind));
        dropped += report.dropped;
      }
    }
    expect(dropped).toBeGreaterThan(0);
  });

  it("drops a spawn after its tries, and the escorts of a dropped leader", () => {
    const everywhere: ExclusionZone = {
      applies: ["rock", "enemy"],
      rule: "closed",
      shape: { kind: "disc", radius: 5000, x: 0, y: 0 },
    };
    const plan = planRegion(rules, 3, { ...region, exclusions: [everywhere] });
    expect(plan.placements).toEqual([]);
    for (const kind of ["big", "small", "heavy", "fighter"]) {
      const report = plan.report.kinds[kind]!;
      expect(report.requested).toBeGreaterThan(0);
      expect(report.drops).toEqual({ closed: report.requested });
      expect(report.rejections.closed).toBe(report.requested * rules.tries);
    }
    const escort = plan.report.kinds.escort!;
    expect(escort.drops).toEqual({ [SPAWN_RULE.leaderDropped]: escort.requested });
    expect(plan.report.kinds.mover!.drops).toEqual({
      [SPAWN_RULE.noSourceRock]: plan.report.kinds.mover!.requested,
    });
  });

  it("drops a rock that cannot fit a quadrant between the lanes", () => {
    const huge = {
      ...rules,
      bands: [
        {
          ...band,
          enemies: [],
          moving: [],
          rocks: [{ density: 2, kind: "huge", shapes: [{ id: "huge", radius: 120, weight: 1 }] }],
        },
      ],
    };
    const report = planRegion(huge, 1, region).report.kinds.huge!;
    expect(report.delivered).toBe(0);
    expect(report.drops).toEqual({ [SPAWN_RULE.corridor]: report.requested });
  });

  it("plans each kind from its own streams, so other kinds do not shift its requests", () => {
    const alone = { ...rules, bands: [{ ...band, enemies: [], rocks: [band.rocks[1]!] }] };
    for (const seed of SEEDS) {
      expect(planRegion(alone, seed, region).report.kinds.small!.requested).toBe(
        planRegion(rules, seed, region).report.kinds.small!.requested,
      );
    }
  });

  it("selects each chunk's band by its centre's distance from the galactic centre", () => {
    const far = { ...band, enemies: [], moving: [], rocks: [{ ...band.rocks[0]!, kind: "far" }] };
    const near = { ...band, enemies: [], moving: [], rocks: [band.rocks[1]!] };
    const banded = { ...rules, bands: [near, { ...far, from: 600 }] };
    const plan = planRegion(banded, 1, region);
    for (const placement of plan.placements) {
      // Chunk centres at (+-256, +-256) lie 362 from the centre; every other is beyond 800.
      expect(placement.kind).toBe(
        ["-1,-1", "-1,0", "0,-1", "0,0"].includes(placement.chunk) ? "small" : "far",
      );
    }
  });

  it("wraps distances to zones across the world seam", () => {
    const side = 512 * 10;
    const seam: ExclusionZone = {
      applies: ["rock", "enemy"],
      rule: "seam",
      shape: { kind: "disc", radius: 400, x: side / 2 - 10, y: 0 },
    };
    const wrapped = { ...rules, worldSide: side };
    const plan = planRegion(wrapped, 1, { ...region, cell: { x: -6, y: -1 }, exclusions: [seam] });
    for (const placement of plan.placements) {
      const offset = (((placement.x - (side / 2 - 10)) % side) + side) % side;
      const dx = Math.min(offset, side - offset);
      expect(Math.hypot(dx, placement.y)).toBeGreaterThanOrEqual(400 + placement.radius);
    }
    expect(Object.values(plan.report.kinds).some((kind) => (kind.rejections.seam ?? 0) > 0)).toBe(
      true,
    );
  });
});
