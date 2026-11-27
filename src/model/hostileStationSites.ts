import { randomStream } from "@andornaut/game-kit/runtime/random";
import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { GALAXY_ID } from "../data/galaxies.ts";
import {
  hasHostileStationSites,
  HOSTILE_STATION_PLACEMENT,
} from "../data/hostileStationPlacement.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { Vec } from "./types.ts";
import {
  periodicWorldGrid,
  worldCellKey,
  worldCellOrigin,
  worldCellsNear,
  worldGrid,
} from "./worldCells.ts";
import { type WorldContext, worldDistance } from "./worldContacts.ts";
import { nearestImage, wrapPoint } from "./worldGeometry.ts";

export interface HostileStationSite extends Readonly<Vec> {
  readonly id: string;
}

export interface HostileStationSitesContext extends WorldContext {
  readonly galaxy: GalaxyNumber;
  readonly geographySeed: number;
  /** Caller-owned required/protected geometry rejection never resamples a candidate. */
  readonly placementClear?: (site: HostileStationSite) => boolean;
}

/** Inverse Poisson CDF: one local draw selects a count, including zero and multiple sites. */
function poissonCount(mean: number, draw: number): number {
  let count = 0;
  let probability = Math.exp(-mean);
  let cumulative = probability;
  while (draw > cumulative && probability > 0) {
    count++;
    probability *= mean / count;
    cumulative += probability;
  }
  return count;
}

/** Preserve the seeded coordinate's bits when selecting its query-chart image. */
function queryImage(context: WorldContext, center: Vec, point: Vec): Vec {
  if (context.worldSide === undefined) {
    return point;
  }
  const { offset } = nearestImage(context.worldSide, center, point);
  return { x: point.x + offset.x, y: point.y + offset.y };
}

/** Stable geographic candidates only; callers still own whole-formation combat admission. */
export function hostileStationSites(
  context: HostileStationSitesContext,
  region: Readonly<Rect>,
): readonly HostileStationSite[] {
  if (
    !Number.isInteger(context.geographySeed) ||
    context.geographySeed < 0 ||
    context.geographySeed > 0xffffffff
  ) {
    throw new RangeError("Invalid hostile station geography seed");
  }
  if (
    ![
      region.x,
      region.y,
      region.width,
      region.height,
      region.x + region.width,
      region.y + region.height,
    ].every(Number.isFinite) ||
    region.width < 0 ||
    region.height < 0
  ) {
    throw new RangeError("Invalid hostile station query region");
  }
  const policy = HOSTILE_STATION_PLACEMENT;
  const galaxy = GALAXY_ID[context.galaxy];
  if (!region.width || !region.height || !hasHostileStationSites(context.galaxy)) {
    return [];
  }
  // Tile area derives from density; independent Poisson counts do not impose one site per tile.
  const pitch = Math.sqrt(policy.densityArea);
  const grid =
    context.worldSide === undefined
      ? worldGrid(context, pitch)
      : periodicWorldGrid(context, Math.min(pitch, context.worldSide));
  const center = { x: region.x + region.width / 2, y: region.y + region.height / 2 };
  const sites: HostileStationSite[] = [];
  // The approved radial extent bounds enumeration even for a whole-world query.
  for (const cell of worldCellsNear(grid, policy.maximumCenterDistance, { x: 0, y: 0 })) {
    const origin = worldCellOrigin(grid, cell);
    const tileCenter = queryImage(context, center, {
      x: origin.x + grid.pitch / 2,
      y: origin.y + grid.pitch / 2,
    });
    if (
      tileCenter.x + grid.pitch / 2 <= region.x ||
      tileCenter.x - grid.pitch / 2 >= region.x + region.width ||
      tileCenter.y + grid.pitch / 2 <= region.y ||
      tileCenter.y - grid.pitch / 2 >= region.y + region.height
    ) {
      continue;
    }
    const key = worldCellKey(grid, cell);
    const next = randomStream(context.geographySeed, `hostile-station:${galaxy}:${key}`);
    const count = poissonCount(grid.pitch ** 2 / policy.densityArea, next());
    for (let index = 0; index < count; index++) {
      const raw = { x: origin.x + next() * grid.pitch, y: origin.y + next() * grid.pitch };
      const point = context.worldSide === undefined ? raw : wrapPoint(context.worldSide, raw);
      const distance = worldDistance(context, { x: 0, y: 0 }, point);
      if (distance < policy.minimumCenterDistance || distance > policy.maximumCenterDistance) {
        continue;
      }
      const image = queryImage(context, center, point);
      if (
        image.x < region.x ||
        image.x >= region.x + region.width ||
        image.y < region.y ||
        image.y >= region.y + region.height
      ) {
        continue;
      }
      const site = {
        ...point,
        id: `hostile-station:${galaxy}:${context.geographySeed}:${key}:${index}`,
      };
      if (!context.placementClear || context.placementClear(site)) {
        sites.push(site);
      }
    }
  }
  return sites.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
