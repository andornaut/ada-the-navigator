import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { JOB_TYPES, type JobType, type LandmarkKind } from "../data/jobs.ts";
import { PROCEDURAL_POI_NAMES, PROCEDURAL_POIS as T } from "../data/proceduralPois.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { dropRandom } from "./drops.ts";
import { landmarkSites } from "./landmarks.ts";
import type { Vec } from "./types.ts";
import {
  worldCell,
  worldCellChance,
  worldCellKey,
  worldCellOrigin,
  worldCellsNear,
  type WorldGrid,
  worldGrid,
} from "./worldCells.ts";
import { wrappedDistanceSquared, wrapPoint } from "./worldGeometry.ts";

export interface ProceduralPoiContext {
  /** Absent for legacy flights. Callers extract this only from explicit torus metadata. */
  readonly worldSide?: number;
  /** Existing story/station clearance policy, evaluated on a canonical candidate point. */
  readonly isProtected?: (point: Vec, clearance: number) => boolean;
  readonly protectedPlaces?: readonly (Vec & { readonly radius?: number })[];
  /** Legal mechanic profiles, not temporary heavy-admission or occupied-task-slot status. */
  readonly opportunityEligibility?: ProceduralPoiOpportunityEligibility;
}
export interface ProceduralPoiOpportunityEligibility {
  readonly resources?: boolean;
  readonly salvage?: boolean;
  /** Existing templates with an eligible offer, supplied by the canonical job owner. */
  readonly jobTemplates?: readonly JobType[];
}
export type ProceduralPoiOpportunity =
  | { readonly kind: "resources"; readonly profile: "ordinaryRock" | "oreField" }
  | { readonly kind: "salvage"; readonly profile: "disabledFrigate" }
  | {
      readonly kind: "job";
      readonly profile: "existingJobs";
      readonly templates: readonly JobType[];
    };
export interface ProceduralPoi extends Vec {
  readonly id: string;
  readonly kind: LandmarkKind;
  /** An existing generic player-string key; never an authored landmark's name. */
  readonly name: string;
  readonly opportunity: ProceduralPoiOpportunity;
}

function opportunity(
  context: ProceduralPoiContext,
  galaxy: GalaxyNumber,
  seed: number,
  id: string,
): ProceduralPoiOpportunity | undefined {
  const eligibility = context.opportunityEligibility;
  const templates = JOB_TYPES.filter((type) => eligibility?.jobTemplates?.includes(type));
  const eligible = T.opportunities.filter((entry) =>
    entry.kind === "job" ? templates.length > 0 : eligibility?.[entry.kind] !== false,
  );
  const total = eligible.reduce((sum, entry) => sum + entry.weight, 0);
  if (!total) {
    return undefined;
  }
  // This independent stream never consumes or changes placement or visual-kind draws.
  let roll = dropRandom(seed, `procedural-poi-opportunity:${galaxy}:${id}`)() * total;
  let selected = eligible.at(-1);
  for (const entry of eligible) {
    if (roll < entry.weight) {
      selected = entry;
      break;
    }
    roll -= entry.weight;
  }
  switch (selected?.kind) {
    case "resources":
      return {
        kind: "resources",
        profile: ORE_FIELDS.galaxies.includes(galaxy) ? "oreField" : "ordinaryRock",
      };
    case "salvage":
      return { kind: "salvage", profile: "disabledFrigate" };
    case "job":
      return { kind: "job", profile: "existingJobs", templates };
    default:
      return undefined;
  }
}

function inputs(galaxy: GalaxyNumber, seed: number): void {
  if (!GALAXY_NUMBERS.includes(galaxy)) {
    throw new RangeError("Unknown POI galaxy");
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("POI seed must be an unsigned galaxy seed");
  }
}

function candidate(
  context: ProceduralPoiContext,
  galaxy: GalaxyNumber,
  seed: number,
  grid: WorldGrid,
  rawCell: Vec,
): ProceduralPoi | undefined {
  const cell = worldCell(grid, rawCell);
  const key = worldCellKey(grid, cell);
  const next = dropRandom(seed, `procedural-poi:${galaxy}:${key}:0`);
  const chance = worldCellChance(grid, T.density * T.cellSize ** 2);
  if (next() >= chance) {
    return undefined;
  }
  const origin = worldCellOrigin(grid, cell);
  // The inset leaves the existing minimum separation between candidates in adjoining cells.
  const jitter = Math.max(0, (grid.pitch - T.spacing) / 2);
  const point = wrapPoint(context.worldSide!, {
    x: origin.x + grid.pitch / 2 + (next() * 2 - 1) * jitter,
    y: origin.y + grid.pitch / 2 + (next() * 2 - 1) * jitter,
  });
  const kind = T.kinds[Math.floor(next() * T.kinds.length)]!;
  if (
    landmarkSites(galaxy).some(
      (site) => wrappedDistanceSquared(context.worldSide!, point, site) < T.spacing ** 2,
    ) ||
    context.protectedPlaces?.some(
      (site) =>
        wrappedDistanceSquared(context.worldSide!, point, site) <
        (T.placeClearance + (site.radius ?? 0)) ** 2,
    ) ||
    context.isProtected?.(point, T.placeClearance)
  ) {
    return undefined;
  }
  const id = `poi:${galaxy}:${key}:0`;
  const intent = opportunity(context, galaxy, seed, id);
  if (!intent) {
    return undefined;
  }
  return { ...point, id, kind, name: PROCEDURAL_POI_NAMES[kind], opportunity: intent };
}

/**
 * A bounded local query with canonical identities and coordinates. The seed is the stable galaxy
 * seed; a flight seed, query image, visit count or wrap count must not replace it.
 */
export function proceduralPoisNear(
  context: ProceduralPoiContext,
  galaxy: GalaxyNumber,
  seed: number,
  range: number,
  point: Vec,
): readonly ProceduralPoi[] {
  if (context.worldSide === undefined) {
    return [];
  }
  inputs(galaxy, seed);
  if (!Number.isFinite(range) || range < 0 || range > T.maxQueryRadius) {
    throw new RangeError("POI query exceeds the local radius budget");
  }
  const center = wrapPoint(context.worldSide, point);
  const grid = worldGrid(context, T.cellSize);
  const sites = new Map<string, ProceduralPoi>();
  // Cover entire cell footprints even when the shared grid query samples only their origins.
  for (const cell of worldCellsNear(grid, range + grid.pitch * Math.SQRT2, center)) {
    const site = candidate(context, galaxy, seed, grid, cell);
    if (site && wrappedDistanceSquared(context.worldSide, center, site) <= range ** 2) {
      sites.set(site.id, site);
    }
  }
  return [...sites.values()].sort(
    (a, b) =>
      wrappedDistanceSquared(context.worldSide!, center, a) -
        wrappedDistanceSquared(context.worldSide!, center, b) || a.id.localeCompare(b.id),
  );
}

/** A direct identity lookup never scans or materializes the galaxy's population. */
export function proceduralPoiById(
  context: ProceduralPoiContext,
  galaxy: GalaxyNumber,
  seed: number,
  id: string,
): ProceduralPoi | undefined {
  if (context.worldSide === undefined) {
    return undefined;
  }
  inputs(galaxy, seed);
  const match = /^poi:([1-6]):(-?(?:0|[1-9]\d*)),(-?(?:0|[1-9]\d*)):0$/.exec(id);
  if (!match || Number(match[1]) !== galaxy) {
    return undefined;
  }
  const cell = { x: Number(match[2]), y: Number(match[3]) };
  if (!Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y)) {
    return undefined;
  }
  const grid = worldGrid(context, T.cellSize);
  if (worldCellKey(grid, cell) !== `${match[2]},${match[3]}`) {
    return undefined;
  }
  return candidate(context, galaxy, seed, grid, cell);
}

/** Charted map data is supplied separately from survey landmarks and never grants discovery credit. */
export function chartedProceduralPois(
  context: ProceduralPoiContext,
  galaxy: GalaxyNumber,
  seed: number,
  knownIds: ReadonlySet<string>,
  range: number,
  point: Vec,
): readonly ProceduralPoi[] {
  return proceduralPoisNear(context, galaxy, seed, range, point).filter((site) =>
    knownIds.has(site.id),
  );
}
