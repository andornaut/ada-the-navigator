import type { GalaxyNumber } from "../data/types.ts";
import { type ExplorationPacing, ROUTE_OPPORTUNITY_SECONDS } from "./explorationPacing.ts";
import type { ExplorationRenewal } from "./explorationRenewal.ts";
import { type ProceduralPoi, proceduralPoiById } from "./proceduralPois.ts";
import { periodicWorldGrid } from "./worldCells.ts";
import { canonicalCell } from "./worldGeometry.ts";

export interface ExplorationState {
  version: 1;
  pacing?: ExplorationPacing;
  renewals: Record<string, ExplorationRenewal>;
}

export interface ExplorationStateContext {
  readonly worldSide: number;
  readonly chunkSize: number;
  readonly validRoleId: (id: string) => boolean;
}

function record(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === Object.prototype || prototype === null) &&
    Reflect.ownKeys(value).every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      return typeof key === "string" && Object.hasOwn(descriptor, "value");
    })
  );
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const found = Reflect.ownKeys(value);
  return found.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validPacing(period: number, value: unknown): value is ExplorationPacing {
  return (
    record(value) &&
    exact(
      value,
      Object.hasOwn(value, "pending")
        ? ["freshSeconds", "nextOpportunity", "pending"]
        : ["freshSeconds", "nextOpportunity"],
    ) &&
    nonnegative(value.freshSeconds) &&
    value.freshSeconds <= ROUTE_OPPORTUNITY_SECONDS &&
    nonnegative(value.nextOpportunity) &&
    Number.isSafeInteger(value.nextOpportunity) &&
    (!Object.hasOwn(value, "pending") ||
      (value.freshSeconds === ROUTE_OPPORTUNITY_SECONDS && validPending(period, value.pending)))
  );
}

function validPending(period: number, value: unknown): boolean {
  if (
    !record(value) ||
    !exact(value, ["cell", "region"]) ||
    (value.region !== "near" && value.region !== "far") ||
    typeof value.cell !== "string" ||
    !/^-?\d+,-?\d+$/.test(value.cell)
  ) {
    return false;
  }
  const [x, y] = value.cell.split(",").map(Number);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    return false;
  }
  const cell = canonicalCell(period, { x: x!, y: y! });
  return value.cell === `${cell.x},${cell.y}`;
}

/** Saved renewal roles and footprints must already have their canonical identities. */
export function validExplorationState(
  context: ExplorationStateContext,
  value: unknown,
): value is ExplorationState {
  if (
    !record(value) ||
    !exact(
      value,
      Object.hasOwn(value, "pacing") ? ["version", "renewals", "pacing"] : ["version", "renewals"],
    ) ||
    value.version !== 1 ||
    !record(value.renewals)
  ) {
    return false;
  }
  let period: number;
  try {
    period = periodicWorldGrid(context, context.chunkSize).periodCells!;
    if (!Number.isSafeInteger(period) || period < 1) {
      return false;
    }
  } catch {
    return false;
  }
  if (Object.hasOwn(value, "pacing") && !validPacing(period, value.pacing)) {
    return false;
  }
  const renewals = value.renewals;
  return Object.getOwnPropertyNames(renewals).every((id) => {
    const renewal = renewals[id];
    if (
      !context.validRoleId(id) ||
      !record(renewal) ||
      !exact(renewal, ["footprint", "departed", "seconds", "distance"]) ||
      !record(renewal.footprint) ||
      !exact(renewal.footprint, ["x", "y"]) ||
      typeof renewal.departed !== "boolean" ||
      !nonnegative(renewal.seconds) ||
      !nonnegative(renewal.distance) ||
      (!renewal.departed && (renewal.seconds !== 0 || renewal.distance !== 0))
    ) {
      return false;
    }
    const { x, y } = renewal.footprint;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y)
    ) {
      return false;
    }
    const canonical = canonicalCell(period, { x, y });
    return Object.is(canonical.x, x) && Object.is(canonical.y, y);
  });
}

/** Boolean entries are saved sites from before opportunity kinds were recorded. */
export type ExplorationSiteKind = "resources" | "salvage" | "rescue" | "hunt";
export type ExplorationSite =
  boolean | { readonly kind: ExplorationSiteKind; readonly scanned: boolean };
export type ExplorationSites = Readonly<Record<string, ExplorationSite>>;

export function explorationSiteScanned(site: ExplorationSite | undefined): boolean {
  return typeof site === "boolean" ? site : (site?.scanned ?? false);
}

const noOffers = { jobTemplates: [] };
const siteCache = new WeakMap<
  ExplorationSites,
  {
    galaxy: GalaxyNumber;
    seed: number;
    worldSide: number;
    sites: readonly ProceduralPoi[];
  }
>();

export function admittedExplorationSites(
  worldSide: number,
  galaxy: GalaxyNumber,
  seed: number,
  record: ExplorationSites,
): readonly ProceduralPoi[] {
  const known = siteCache.get(record);
  if (known?.galaxy === galaxy && known.seed === seed && known.worldSide === worldSide) {
    return known.sites;
  }
  const sites = Object.entries(record).flatMap(([id, entry]) => {
    const kind = typeof entry === "boolean" ? undefined : entry.kind;
    // Regenerate the original placement and visual name, but use the admitted opportunity kind.
    const opportunityEligibility =
      kind === "rescue" || kind === "hunt"
        ? { jobTemplates: [kind], resources: false, salvage: false }
        : { ...noOffers, resources: kind !== "salvage", salvage: kind !== "resources" };
    const site = proceduralPoiById({ opportunityEligibility, worldSide }, galaxy, seed, id);
    return site ? [site] : [];
  });
  siteCache.set(record, { galaxy, seed, sites, worldSide });
  return sites;
}

export function validExplorationSites(
  worldSide: number,
  galaxy: GalaxyNumber,
  seed: number,
  value: unknown,
): value is ExplorationSites {
  if (
    !record(value) ||
    !Object.values(value).every(
      (entry) =>
        typeof entry === "boolean" ||
        (record(entry) &&
          exact(entry, ["kind", "scanned"]) &&
          typeof entry.scanned === "boolean" &&
          (entry.kind === "resources" ||
            entry.kind === "salvage" ||
            entry.kind === "rescue" ||
            (entry.kind === "hunt" && galaxy !== 6))),
    )
  ) {
    return false;
  }
  const sites = admittedExplorationSites(worldSide, galaxy, seed, value as ExplorationSites);
  return sites.length === Object.keys(value).length;
}
