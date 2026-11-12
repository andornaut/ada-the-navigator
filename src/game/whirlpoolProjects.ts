import { CURRENTS } from "../data/galaxyFeatures.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { type Current, currentsNear, nearestOnCurrent, pointOnCurrent } from "../model/currents.ts";
import type { Vec } from "../model/types.ts";

// Whirlpool's two community-project world changes (art/whirlpool.md "Project world changes"),
// read from public/art/whirlpool/projects.json: the nursery beacon and its light pool at the whale
// family, and the current-map buoys along both edges of the whales' current. Both are passable
// decoration, absent from the Map.

/** A project frame as the manifest gives it: display size in px and its pivot. */
export interface ProjectFrame {
  readonly displayHeight?: number;
  readonly displayWidth?: number;
  readonly id: string;
  readonly pivot: { readonly x: number; readonly y: number };
}

export interface NurseryBeacon<T extends ProjectFrame = ProjectFrame> {
  readonly frameMs: number;
  readonly frames: readonly [T, T];
  /** World units from the family destination to the beacon's pivot. */
  readonly offset: Vec;
  readonly pool: {
    /** Each ring's alpha with frame A, then with frame B. */
    readonly alpha: readonly [number, number];
    /** World units from the family destination to the rings' centre. */
    readonly centre: Vec;
    readonly color: string;
    /** World radii, outermost first. */
    readonly radii: readonly number[];
  };
}

export interface CurrentBuoys<T extends ProjectFrame = ProjectFrame> {
  readonly chase: { readonly stepMs: number; readonly steps: number };
  /** World units outside each current edge. */
  readonly edge: number;
  readonly frames: readonly [T, T];
  /** +1 and -1: the edges, as signs of the offset along the path's left normal. */
  readonly sides: readonly number[];
  readonly spacing: number;
  readonly start: number;
}

export interface WhirlpoolProjects<T extends ProjectFrame = ProjectFrame> {
  readonly currentBuoys?: CurrentBuoys<T>;
  readonly nurseryBeacon?: NurseryBeacon<T>;
  /** The frame reduced motion holds on the beacon, its pool and every buoy. */
  readonly reducedFrame: 0 | 1;
}

type Fields = Record<string, unknown>;

const fields = (value: unknown): Fields | undefined =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;

function pair(value: unknown): Vec | undefined {
  return Array.isArray(value) && value.length === 2 && value.every(finite)
    ? { x: value[0] as number, y: value[1] as number }
    : undefined;
}

function framePair<T extends ProjectFrame>(
  assets: readonly T[],
  ids: unknown,
): readonly [T, T] | undefined {
  if (!Array.isArray(ids) || ids.length !== 2) {
    return undefined;
  }
  const [a, b] = ids.map((id) => assets.find((asset) => asset.id === id));
  return a && b && positive(a.displayWidth) && positive(b.displayWidth) ? [a, b] : undefined;
}

function readBeacon<T extends ProjectFrame>(
  assets: readonly T[],
  value: unknown,
): NurseryBeacon<T> | undefined {
  const entry = fields(value);
  const pool = fields(entry?.pool);
  const frames = framePair(assets, entry?.frames);
  const offset = pair(entry?.offset);
  const centre = pair(pool?.centre);
  const alpha = pool?.alpha;
  const radii = pool?.radii;
  if (
    entry?.site !== "family" ||
    !frames ||
    !offset ||
    !positive(entry.frameMs) ||
    !centre ||
    typeof pool?.color !== "string" ||
    !/^#[0-9a-f]{6}$/i.test(pool.color) ||
    !Array.isArray(alpha) ||
    alpha.length !== 2 ||
    !alpha.every((a) => finite(a) && a >= 0 && a <= 1) ||
    !Array.isArray(radii) ||
    radii.length === 0 ||
    !radii.every(positive)
  ) {
    return undefined;
  }
  return {
    frameMs: entry.frameMs,
    frames,
    offset,
    pool: {
      alpha: [alpha[0] as number, alpha[1] as number],
      centre,
      color: pool.color,
      radii: radii as number[],
    },
  };
}

function readBuoys<T extends ProjectFrame>(
  assets: readonly T[],
  value: unknown,
): CurrentBuoys<T> | undefined {
  const entry = fields(value);
  const chase = fields(entry?.chase);
  const frames = framePair(assets, entry?.frames);
  const sides = entry?.sides;
  if (
    entry?.site !== "whalesCurrent" ||
    !frames ||
    !positive(entry.spacing) ||
    !finite(entry.start) ||
    entry.start < 0 ||
    !finite(entry.edge) ||
    entry.edge < 0 ||
    !Array.isArray(sides) ||
    sides.length === 0 ||
    !sides.every((side) => side === 1 || side === -1) ||
    !positive(chase?.stepMs) ||
    !Number.isInteger(chase.steps) ||
    !((chase.steps as number) > 0)
  ) {
    return undefined;
  }
  return {
    chase: { stepMs: chase.stepMs, steps: chase.steps as number },
    edge: entry.edge,
    frames,
    sides: sides as number[],
    spacing: entry.spacing,
    start: entry.start,
  };
}

/**
 * projects.json, version 1, with the frames the loaded assets hold. A malformed project has no
 * world art; a malformed file has none at all.
 */
export function readWhirlpoolProjects<T extends ProjectFrame>(
  assets: readonly T[],
  value: unknown,
): WhirlpoolProjects<T> | undefined {
  const file = fields(value);
  const projects = fields(file?.projects);
  const frame = fields(file?.reducedMotion)?.frame;
  if (file?.version !== 1 || !projects || (frame !== 0 && frame !== 1)) {
    return undefined;
  }
  const nurseryBeacon = readBeacon(assets, projects.nurseryBeacon);
  const currentBuoys = readBuoys(assets, projects.currentBuoys);
  return {
    reducedFrame: frame,
    ...(nurseryBeacon ? { nurseryBeacon } : {}),
    ...(currentBuoys ? { currentBuoys } : {}),
  };
}

/** The beacon's breathe frame at `timeMs`: A then B, each for `frameMs`; reduced motion holds. */
export function nurseryFrame(
  art: WhirlpoolProjects,
  beacon: Pick<NurseryBeacon, "frameMs">,
  reducedMotion: boolean,
  timeMs: number,
): 0 | 1 {
  return reducedMotion ? art.reducedFrame : Math.floor(timeMs / beacon.frameMs) % 2 === 0 ? 0 : 1;
}

/** The light pool's rings: world centres and radii, with the frame's alpha on each. */
export function poolRings(
  beacon: Pick<NurseryBeacon, "pool">,
  family: Vec,
  frame: 0 | 1,
): { alpha: number; centre: Vec; radius: number }[] {
  const { alpha, centre, radii } = beacon.pool;
  const at = { x: family.x + centre.x, y: family.y + centre.y };
  return radii.map((radius) => ({ alpha: alpha[frame], centre: at, radius }));
}

/**
 * The whales' current: the current that passes nearest the family destination. Currents stay in
 * their placement cells, so the search widens one cell at a time until no unsearched cell can hold
 * a nearer one.
 */
export function whalesCurrent(galaxy: GalaxyNumber, family: Vec, maxCells = 6): Current | null {
  let best: Current | null = null;
  let nearest = Infinity;
  for (let cells = 1; cells <= maxCells; cells++) {
    const radius = cells * CURRENTS.cellSize;
    for (const current of currentsNear(galaxy, radius, family)) {
      const { distance } = nearestOnCurrent(current, family);
      if (distance < nearest) {
        best = current;
        nearest = distance;
      }
    }
    if (nearest <= radius) {
      return best;
    }
  }
  return best;
}

/** One buoy: its index along the edge, its edge's sign and its world pivot. */
export interface BuoyPlace {
  readonly k: number;
  readonly point: Vec;
  readonly side: number;
}

/**
 * The buoys along a current: buoy `k` at arc `start + spacing k` while it stays `start` short of
 * the end, on each side at `side (w / 2 + edge)` along the path's left normal.
 */
export function buoyPlaces(
  buoys: Pick<CurrentBuoys, "edge" | "sides" | "spacing" | "start">,
  current: Pick<Current, "length" | "points" | "stations" | "width">,
): BuoyPlace[] {
  const places: BuoyPlace[] = [];
  const reach = current.width / 2 + buoys.edge;
  for (let k = 0; buoys.start + buoys.spacing * k <= current.length - buoys.start; k++) {
    const { point, tangent } = pointOnCurrent(current, buoys.start + buoys.spacing * k);
    for (const side of buoys.sides) {
      places.push({
        k,
        point: { x: point.x - tangent.y * side * reach, y: point.y + tangent.x * side * reach },
        side,
      });
    }
  }
  return places;
}

/** Buoy `k`'s chase frame: A when `(floor(t / stepMs) - k) mod steps` is 0; reduced motion holds. */
export function buoyFrame(
  art: WhirlpoolProjects,
  buoys: Pick<CurrentBuoys, "chase">,
  k: number,
  reducedMotion: boolean,
  timeMs: number,
): 0 | 1 {
  if (reducedMotion) {
    return art.reducedFrame;
  }
  const { stepMs, steps } = buoys.chase;
  const phase = (((Math.floor(timeMs / stepMs) - k) % steps) + steps) % steps;
  return phase === 0 ? 0 : 1;
}

/** A frame's drawn extent in display px around its pivot. */
export function frameBounds(frame: ProjectFrame): {
  bottom: number;
  left: number;
  right: number;
  top: number;
} {
  const width = frame.displayWidth ?? 0;
  const height = frame.displayHeight ?? 0;
  const left = -frame.pivot.x * width;
  const top = -frame.pivot.y * height;
  return { bottom: top + height, left, right: left + width, top };
}
