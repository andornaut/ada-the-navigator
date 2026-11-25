import { describe, expect, it } from "vitest";

import {
  type EnemyTarget,
  type ExclusionZone,
  planRegion,
  SPAWN_RULE,
  type SpawnBand,
  spawnBandAt,
  type SpawnCategory,
  type SpawnPlacement,
  type SpawnPlan,
  type SpawnRegion,
  type SpawnRules,
} from "./spawnPlanner.ts";

const band: SpawnBand = {
  enemies: [
    {
      density: 1,
      escorts: { archetype: "escort", kind: "escort", perLeader: 2, radius: 8, ring: 70 },
      groupSize: [1, 2],
      kind: "heavy",
      radius: 40,
      spacing: 120,
    },
    { density: 0.7, groupSize: [2, 4], kind: "fighter", radius: 10, spacing: 100 },
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
  order: ["enemies", "rocks", "moving"],
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

/** Placed rocks of a kind, or whole groups of an enemy kind. */
function deliveredOf(plan: SpawnPlan, kind: string): number {
  return plan.report.kinds[kind]!.unit === "groups"
    ? new Set(
        plan.placements
          .filter((placement) => placement.kind === kind && !placement.leader)
          .map((placement) => placement.group),
      ).size
    : plan.placements.filter(
        (placement) => placement.kind === kind || placement.moving?.kind === kind,
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
          // Formation spacings land on exactly two radii plus the gap, up to rounding.
          a.radius + b.radius + rules.gap - 1e-9,
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
        const categories: SpawnCategory[] = [
          placement.category,
          ...(placement.moving ? ["moving" as const] : []),
        ];
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

  it("drops a rock or a whole group after its tries", () => {
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
    expect(plan.report.kinds.heavy!.unit).toBe("groups");
    expect(plan.report.kinds.small!.unit).toBe("rocks");
    // Escorts belong to their group and are not counted on their own.
    expect(plan.report.kinds.escort).toBeUndefined();
    expect(plan.report.kinds.mover!.drops).toEqual({
      [SPAWN_RULE.noSourceRock]: plan.report.kinds.mover!.requested,
    });
  });

  it("places every member and escort of a group or none of it", () => {
    let groups = 0;
    for (const seed of SEEDS) {
      const plan = planRegion(rules, seed, region);
      for (const target of band.enemies) {
        const members = plan.placements.filter(
          (placement) => placement.kind === target.kind && !placement.leader,
        );
        for (const group of new Set(members.map((member) => member.group))) {
          groups++;
          const own = members.filter((member) => member.group === group);
          expect(own.map((member) => member.id).sort()).toEqual(
            own.map((_, index) => `${group}:${index}`).sort(),
          );
          expect(own.length).toBeGreaterThanOrEqual(target.groupSize[0]);
          expect(own.length).toBeLessThanOrEqual(target.groupSize[1]);
          // Members keep their formation line exactly.
          for (const member of own) {
            expect(member.y).toBe(own[0]!.y);
          }
          const escorts = plan.placements.filter(
            (placement) => placement.group === group && placement.leader,
          );
          expect(escorts).toHaveLength(own.length * (target.escorts?.perLeader ?? 0));
          for (const escort of escorts) {
            const leader = own.find((member) => member.id === escort.leader)!;
            // The test heavy's ring of 70 widens to its hull, the escort's and the gap: 88.
            expect(Math.hypot(escort.x - leader.x, escort.y - leader.y)).toBeCloseTo(
              Math.max(target.escorts!.ring, target.radius + escort.radius + rules.gap),
            );
          }
        }
        const report = plan.report.kinds[target.kind]!;
        expect(report.delivered).toBe(new Set(members.map((member) => member.group)).size);
      }
    }
    expect(groups).toBeGreaterThan(40);
  });

  describe("spaces members by their hulls plus the gap", () => {
    const pair = (target: EnemyTarget) =>
      planRegion(
        { ...rules, bands: [{ ...band, enemies: [target], moving: [], rocks: [] }], gap: 20 },
        1,
        { ...region, columns: 1, rows: 1 },
      );
    const leaders = (plan: SpawnPlan) =>
      plan.placements.filter((placement) => placement.category === "enemy" && !placement.leader);

    it("fits a two-frigate group exactly two hulls plus the gap apart", () => {
      const plan = pair({
        density: 1,
        escorts: { archetype: "escort", kind: "escort", perLeader: 2, radius: 10, ring: 110 },
        groupSize: [2, 2],
        kind: "frigate",
        radius: 50,
        spacing: 100,
      });
      expect(plan.report.kinds.frigate).toMatchObject({ delivered: 1, requested: 1 });
      const [a, b] = leaders(plan);
      expect(Math.abs(a!.x - b!.x)).toBeCloseTo(50 + 50 + 20);
      for (const escort of plan.placements.filter((placement) => placement.leader)) {
        const leader = plan.placements.find((placement) => placement.id === escort.leader)!;
        // The ring of 110 already clears both hulls and the gap.
        expect(Math.hypot(escort.x - leader.x, escort.y - leader.y)).toBeCloseTo(110);
      }
    });

    it("keeps the member spacing for hulls it already clears", () => {
      const plan = pair({
        density: 1,
        groupSize: [3, 3],
        kind: "fighter",
        radius: 10,
        spacing: 100,
      });
      const xs = leaders(plan)
        .map((member) => member.x)
        .sort((p, q) => p - q);
      expect(xs).toHaveLength(3);
      expect(xs[1]! - xs[0]!).toBeCloseTo(100);
      expect(xs[2]! - xs[1]!).toBeCloseTo(100);
    });

    it("widens an escort ring so escorts clear each other", () => {
      const plan = pair({
        density: 1,
        escorts: { archetype: "escort", kind: "escort", perLeader: 6, radius: 10, ring: 30 },
        groupSize: [1, 1],
        kind: "capital",
        radius: 10,
        spacing: 100,
      });
      const escorts = plan.placements.filter((placement) => placement.leader);
      expect(escorts).toHaveLength(6);
      // Six escorts of radius 10 need a chord of 40, so a ring of 40 / (2 sin 30 degrees) = 40.
      for (const [index, escort] of escorts.entries()) {
        const next = escorts[(index + 1) % escorts.length]!;
        expect(Math.hypot(escort.x - next.x, escort.y - next.y)).toBeCloseTo(40);
      }
    });
  });

  it("tries further anchors before dropping a group", () => {
    const blocks: ExclusionZone[] = [-1, 0, 1].flatMap((x) =>
      [-1, 0, 1].map((y) => ({
        applies: ["enemy" as const],
        rule: "block",
        shape: { kind: "disc" as const, radius: 180, x: x * 512 + 256, y: y * 512 + 256 },
      })),
    );
    const enemies = { ...rules, bands: [{ ...band, moving: [], rocks: [] }] };
    let retried = 0;
    for (const seed of SEEDS) {
      const report = planRegion(enemies, seed, { ...region, exclusions: blocks }).report.kinds
        .heavy!;
      const drops = report.drops.block ?? 0;
      // Rejected anchors beyond those of dropped groups belong to groups placed on a later try.
      retried += (report.rejections.block ?? 0) - drops * rules.tries;
      expect(report.delivered + report.dropped).toBe(report.requested);
    }
    expect(retried).toBeGreaterThan(0);
  });

  it("plans passes in the rules' order, so earlier passes claim space first", () => {
    const without = (omit: "enemies" | "rocks") => ({
      ...rules,
      bands: [{ ...band, moving: [], [omit]: [] }],
    });
    const ofCategory = (plan: SpawnPlan, category: "enemy" | "rock") =>
      plan.placements.filter((placement) => placement.category === category);
    const rocksFirst = { ...rules, order: ["rocks", "moving", "enemies"] as const };
    let shortfall = 0;
    for (const seed of SEEDS) {
      const enemiesFirst = planRegion(rules, seed, region);
      expect(ofCategory(enemiesFirst, "enemy")).toEqual(
        ofCategory(planRegion(without("rocks"), seed, region), "enemy"),
      );
      const rocks = planRegion(rocksFirst, seed, region);
      expect(ofCategory(rocks, "rock").map(({ id, x, y }) => [id, x, y])).toEqual(
        ofCategory(
          planRegion({ ...without("enemies"), order: rocksFirst.order }, seed, region),
          "rock",
        ).map(({ id, x, y }) => [id, x, y]),
      );
      shortfall += rocks.report.kinds.small!.delivered - enemiesFirst.report.kinds.small!.delivered;
    }
    // Static rocks placed after the enemy groups lose room to them.
    expect(shortfall).toBeGreaterThan(0);
  });

  it("refuses an order that omits or repeats a pass or moves rocks before placing them", () => {
    for (const order of [
      ["enemies", "rocks"],
      ["enemies", "rocks", "rocks"],
      ["moving", "rocks", "enemies"],
    ] as const) {
      expect(() => planRegion({ ...rules, order }, 1, region)).toThrow(RangeError);
    }
  });

  describe("blends target densities across band boundaries", () => {
    const lower: SpawnBand = {
      enemies: [],
      from: 0,
      moving: [],
      rocks: [{ ...band.rocks[0]!, density: 1 }],
    };
    const upper: SpawnBand = {
      enemies: [],
      from: 1000,
      moving: [],
      rocks: [
        { ...band.rocks[0]!, density: 3 },
        { ...band.rocks[1]!, density: 2 },
      ],
    };
    const blended = { ...rules, bands: [lower, upper], blend: 400 };
    const densities = (distance: number) =>
      Object.fromEntries(
        spawnBandAt(blended, { x: distance, y: 0 }).rocks.map((rock) => [rock.kind, rock.density]),
      );

    it("switches outside the blend width and mixes linearly inside it", () => {
      expect(densities(700)).toEqual({ big: 1 });
      expect(densities(800)).toEqual({ big: 1 });
      expect(densities(900)).toEqual({ big: 1.5, small: 0.5 });
      expect(densities(1000)).toEqual({ big: 2, small: 1 });
      expect(densities(1100)).toEqual({ big: 2.5, small: 1.5 });
      expect(densities(1200)).toEqual({ big: 3, small: 2 });
    });

    it("keeps other values from the active band", () => {
      const admission = { archetypes: 1, cap: 3 };
      const banded = { ...blended, bands: [lower, { ...upper, admission }] };
      expect(spawnBandAt(banded, { x: 950, y: 0 }).admission).toBeUndefined();
      expect(spawnBandAt(banded, { x: 1050, y: 0 }).admission).toEqual(admission);
    });
  });

  describe("admits groups within the local budget", () => {
    const single = { ...region, columns: 1, rows: 1 };
    const admitting = (
      enemies: readonly EnemyTarget[],
      admission: { archetypes: number; cap: number },
      allowance = 2,
    ): SpawnPlan =>
      planRegion(
        {
          ...rules,
          admission: { allowance, capital: "capital", localRadius: 900, maxNearbyCapitals: 1 },
          bands: [{ admission, enemies, from: 0, moving: [], rocks: [] }],
          gap: 20,
        },
        1,
        single,
      );
    const fighters = (smallest?: number): EnemyTarget => ({
      density: 4,
      groupSize: [3, 3],
      kind: "fighter",
      radius: 10,
      spacing: 100,
      ...(smallest === undefined ? {} : { smallest }),
    });

    it("drops whole groups beyond the budget", () => {
      const plan = admitting([fighters()], { archetypes: 2, cap: 5 });
      expect(plan.placements).toHaveLength(3);
      expect(plan.report.kinds.fighter).toMatchObject({ delivered: 1, requested: 4 });
      expect(plan.report.kinds.fighter!.drops).toEqual({ [SPAWN_RULE.admission]: 3 });
    });

    it("shrinks a group down to its smallest size to fit the budget", () => {
      const plan = admitting([fighters(1)], { archetypes: 2, cap: 5 });
      expect(plan.placements).toHaveLength(5);
      expect(plan.report.kinds.fighter).toMatchObject({ delivered: 2, requested: 4 });
    });

    it("limits distinct archetypes", () => {
      const swarm = { ...fighters(), density: 1, groupSize: [1, 1] as const, kind: "swarm" };
      const plan = admitting([fighters(), swarm], { archetypes: 1, cap: 20 });
      expect(new Set(plan.placements.map((placement) => placement.archetype))).toEqual(
        new Set(["fighter"]),
      );
      expect(plan.report.kinds.swarm!.drops).toEqual({ [SPAWN_RULE.admission]: 1 });
    });

    const capital: EnemyTarget = {
      density: 2,
      escorts: {
        archetype: "fighter",
        kind: "capital-escort",
        perLeader: 2,
        radius: 10,
        ring: 120,
      },
      groupSize: [1, 1],
      kind: "capital",
      radius: 60,
      spacing: 100,
    };

    it("adds the allowance for a capital and limits capitals nearby", () => {
      const plan = admitting([capital], { archetypes: 2, cap: 1 });
      // A capital with two escorts fits a budget of 1 only with the allowance of 2.
      expect(plan.report.kinds.capital).toMatchObject({ delivered: 1, requested: 2 });
      expect(plan.report.kinds.capital!.drops).toEqual({ [SPAWN_RULE.admission]: 1 });
      expect(
        admitting([capital], { archetypes: 2, cap: 1 }, 0).report.kinds.capital!.delivered,
      ).toBe(0);
    });
  });

  it("gathers a share of groups beside the nearest site in reach", () => {
    const site = { x: 300, y: 260 };
    const target = (share: number): EnemyTarget => ({
      density: 1,
      gather: { distance: 150, reach: 5000, share, site: "ore-field" },
      groupSize: [1, 1],
      kind: "fighter",
      radius: 10,
      spacing: 100,
    });
    const plan = (share: number) =>
      planRegion(
        {
          ...rules,
          bands: [{ ...band, enemies: [target(share)], moving: [], rocks: [] }],
          gap: 20,
        },
        1,
        { ...region, sites: { "ore-field": [site, { x: 5000, y: 5000 }] } },
      ).placements;
    const distances = (share: number) =>
      plan(share).map((placement) => Math.hypot(placement.x - site.x, placement.y - site.y));
    // The first anchor beside the site is clear, so each placed group sits on its ring.
    const gathered = distances(1);
    expect(gathered.length).toBeGreaterThan(5);
    expect(gathered.filter((distance) => Math.abs(distance - 150) < 1e-9).length).toBeGreaterThan(
      gathered.length / 2,
    );
    expect(distances(0).filter((distance) => Math.abs(distance - 150) < 1e-9)).toEqual([]);
  });

  it("redraws a moving rock's velocity until its path keeps clear of path zones", () => {
    const zone: ExclusionZone = {
      applies: ["path"],
      rule: "protected",
      shape: { kind: "disc", radius: 300, x: 0, y: 0 },
    };
    const pathed = {
      ...rules,
      bands: [{ ...band, enemies: [], moving: [{ ...band.moving[0]!, path: 20 }] }],
    };
    let rejected = 0;
    let movers = 0;
    for (const seed of SEEDS) {
      const plan = planRegion(pathed, seed, { ...region, exclusions: [zone] });
      rejected += plan.report.kinds.mover!.rejections.protected ?? 0;
      for (const rock of plan.placements.filter((placement) => placement.moving)) {
        movers++;
        const { velocity } = rock.moving!;
        for (let step = 0; step <= 400; step++) {
          const t = (20 * step) / 400;
          expect(
            Math.hypot(rock.x + velocity.x * t, rock.y + velocity.y * t),
          ).toBeGreaterThanOrEqual(300 + rock.radius - 1e-6);
        }
      }
      const report = plan.report.kinds.mover!;
      expect(report.requested).toBe(report.delivered + report.dropped);
    }
    expect(rejected).toBeGreaterThan(0);
    expect(movers).toBeGreaterThan(20);
  });

  it("keeps enemy group anchors apart across chunk boundaries", () => {
    const solo: EnemyTarget = {
      density: 3,
      groupSize: [1, 1],
      kind: "fighter",
      radius: 10,
      spacing: 100,
    };
    const pair = { ...region, columns: 2, rows: 1 };
    const spaced = (seed: number, groupSpacing?: number) =>
      planRegion(
        {
          ...rules,
          bands: [{ ...band, enemies: [solo], moving: [], rocks: [] }],
          gap: 20,
          ...(groupSpacing === undefined ? {} : { groupSpacing }),
        },
        seed,
        pair,
      );
    const crossing = (plan: SpawnPlan) =>
      pairs(plan.placements).filter(
        ([a, b]) => a.chunk !== b.chunk && Math.hypot(a.x - b.x, a.y - b.y) < 400,
      ).length;
    let crowded = 0;
    let rejected = 0;
    for (const seed of SEEDS) {
      // Without spacing, single-ship groups in neighbouring chunks may sit closer than 400.
      crowded += crossing(spaced(seed));
      const plan = spaced(seed, 400);
      for (const [a, b] of pairs(plan.placements)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(400);
      }
      expect(plan.placements.length).toBeGreaterThan(1);
      rejected += plan.report.kinds.fighter!.rejections[SPAWN_RULE.groupSpacing] ?? 0;
    }
    expect(crowded).toBeGreaterThan(0);
    expect(rejected).toBeGreaterThan(0);
  });

  it("counts only the report's chunks while planning their neighbours", () => {
    const centre = { cell: { x: 0, y: 0 }, columns: 1, rows: 1 };
    for (const seed of SEEDS) {
      const plan = planRegion(rules, seed, { ...region, report: centre });
      const alone = planRegion(rules, seed, { ...region, ...centre });
      expect(plan.placements.some((placement) => placement.chunk !== "0,0")).toBe(true);
      for (const kind of ["big", "small", "heavy", "fighter", "mover"]) {
        expect(plan.report.kinds[kind]?.requested ?? 0).toBe(
          alone.report.kinds[kind]?.requested ?? 0,
        );
      }
      expect(plan.report.kinds.small!.delivered).toBe(
        plan.placements.filter(
          (placement) => placement.kind === "small" && placement.chunk === "0,0",
        ).length,
      );
    }
  });

  it("shrinks requests by the share of the chunk that applicable zones cover", () => {
    // A band along x = 128 of half width 128 covers the chunk's left half.
    const half: ExclusionZone = {
      applies: ["rock"],
      rule: "current",
      shape: {
        halfWidth: 128,
        kind: "path",
        points: [
          { x: 128, y: -1000 },
          { x: 128, y: 1500 },
        ],
      },
    };
    const target = (openArea: boolean) =>
      planRegion(
        {
          ...rules,
          bands: [
            {
              ...band,
              enemies: [{ ...band.enemies[1]!, density: 4 }],
              moving: [],
              rocks: [{ ...band.rocks[1]!, density: 8 }],
            },
          ],
          openArea,
        },
        1,
        { cell: { x: 0, y: 0 }, columns: 1, exclusions: [half], rows: 1 },
      ).report.kinds;
    expect(target(true).small!.requested).toBe(4);
    expect(target(false).small!.requested).toBe(8);
    // The zone applies to rocks alone, so enemy requests keep their full density.
    expect(target(true).fighter!.requested).toBe(4);
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
