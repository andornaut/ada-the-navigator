import { randomStream } from "@andornaut/game-kit/runtime/random";

import type { GalaxyNumber } from "../data/types.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { planRegion } from "../model/spawnPlanner.ts";
import {
  spawnGatherReach,
  spawnRules,
  worldSpawnExclusions,
  worldSpawnSites,
} from "../model/spawnTargets.ts";
import { periodicWorldGrid, worldCellAt } from "../model/worldCells.ts";

/** A target passes when this share of sampled areas delivers this share of its requests. */
export const ACCEPTANCE = { areaShare: 0.9, deliveredShare: 0.9 } as const;
/** Fixed world seeds, used in turn by the sampled areas. */
export const ACCEPTANCE_SEEDS = [11, 23, 37, 41, 59, 67, 73, 89] as const;
export const AREAS_PER_BAND = 160;
/** Sampled areas are this many chunks on a side. */
const AREA_CHUNKS = 3;
/**
 * Chunks of enemy groups planned around each area, uncounted, as flight plans the neighbouring
 * lattice cells; rocks are planned in the area alone.
 */
const AREA_MARGIN = 4;

export interface KindAcceptance {
  /** Sampled areas that requested at least one of the kind. */
  readonly areas: number;
  readonly delivered: number;
  /** Dropped spawns by rule, over all areas. */
  readonly drops: Readonly<Record<string, number>>;
  /** Areas that delivered at least `ACCEPTANCE.deliveredShare` of their requests. */
  readonly passing: number;
  readonly requested: number;
}

export interface BandAcceptance {
  readonly band: number;
  readonly from: number;
  readonly galaxy: GalaxyNumber;
  readonly kinds: Readonly<Record<string, KindAcceptance>>;
  readonly to: number;
}

/** Whether a kind's sampled areas meet the acceptance rule; untested kinds do not pass. */
export function accepted(kind: KindAcceptance): boolean {
  return kind.areas > 0 && kind.passing >= ACCEPTANCE.areaShare * kind.areas;
}

const cache = new Map<string, BandAcceptance>();

/**
 * Samples a band's 3x3-chunk areas uniformly by area across the band's ring of the torus world,
 * plans each with the spawn target catalog, the seeded world's exclusion zones around the launch
 * point and its ore field sites, and totals each kind's requests and deliveries. Enemy groups in
 * a margin of uncounted chunks around each area are planned with it, as in flight. Requests are
 * per open area and, near a region boundary, blended; each area is judged against its own
 * reduced, blended request.
 */
export function bandAcceptance(galaxy: GalaxyNumber, band: number): BandAcceptance {
  const key = `${galaxy}:${band}`;
  const known = cache.get(key);
  if (known) {
    return known;
  }
  const context = { worldSide: GALAXY_SIDE };
  const rules = spawnRules(galaxy, GALAXY_SIDE);
  const gatherReach = spawnGatherReach(rules);
  const from = rules.bands[band]!.from;
  const to = rules.bands[band + 1]?.from ?? Infinity;
  const grid = periodicWorldGrid(context, rules.chunkSize);
  const next = randomStream(galaxy, `spawn-acceptance:${band}`);
  const kinds = new Map<
    string,
    {
      areas: number;
      delivered: number;
      drops: Record<string, number>;
      passing: number;
      requested: number;
    }
  >();
  for (let sample = 0; sample < AREAS_PER_BAND; sample++) {
    let point;
    do {
      point = Number.isFinite(to)
        ? (() => {
            const radius = Math.sqrt(from ** 2 + next() * (to ** 2 - from ** 2));
            const angle = next() * 2 * Math.PI;
            return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
          })()
        : { x: (next() - 0.5) * GALAXY_SIDE, y: (next() - 0.5) * GALAXY_SIDE };
    } while (Math.hypot(point.x, point.y) < from);
    const centre = worldCellAt(grid, point);
    const half = Math.floor(AREA_CHUNKS / 2);
    const planned = AREA_CHUNKS + 2 * AREA_MARGIN;
    // Every planned chunk lies within this distance of the sampled point.
    const reach = planned * grid.pitch;
    const seed = ACCEPTANCE_SEEDS[sample % ACCEPTANCE_SEEDS.length]!;
    // Rocks are planned in the area alone, so only enemy zones need the margin's reach.
    const exclusions = [
      ...worldSpawnExclusions(
        context,
        galaxy,
        seed,
        [{ x: 0, y: 0 }],
        AREA_CHUNKS * grid.pitch,
        point,
      ).filter((zone) => !zone.applies.includes("enemy")),
      ...worldSpawnExclusions(context, galaxy, seed, [{ x: 0, y: 0 }], reach, point).filter(
        (zone) => zone.applies.includes("enemy"),
      ),
    ];
    const plan = planRegion(
      rules,
      { encounter: seed, world: seed },
      {
        cell: { x: centre.x - half - AREA_MARGIN, y: centre.y - half - AREA_MARGIN },
        columns: planned,
        exclusions,
        report: {
          cell: { x: centre.x - half, y: centre.y - half },
          columns: AREA_CHUNKS,
          neighbours: ["enemies"],
          rows: AREA_CHUNKS,
        },
        rows: planned,
        sites: worldSpawnSites(context, galaxy, reach + gatherReach, point),
      },
    );
    for (const [kind, report] of Object.entries(plan.report.kinds)) {
      if (!report.requested) {
        continue;
      }
      const total = kinds.get(kind) ?? {
        areas: 0,
        delivered: 0,
        drops: {},
        passing: 0,
        requested: 0,
      };
      total.areas++;
      total.requested += report.requested;
      total.delivered += report.delivered;
      if (report.delivered >= ACCEPTANCE.deliveredShare * report.requested) {
        total.passing++;
      }
      for (const [rule, count] of Object.entries(report.drops)) {
        total.drops[rule] = (total.drops[rule] ?? 0) + count;
      }
      kinds.set(kind, total);
    }
  }
  const result = { band, from, galaxy, kinds: Object.fromEntries(kinds), to };
  cache.set(key, result);
  return result;
}
