import GALAXIES_FILE from "../../public/art/galaxies.json" with { type: "json" };
import type { EconomyCatalog } from "../data/economy.ts";
import { fromScreen } from "./convex.ts";
import type { SpaceObject, Vec } from "./types.ts";

export interface PickupObstacle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}
type StardustSpacing = Pick<EconomyCatalog, "stardustPickupGap" | "stardustPickupRadius"> & {
  readonly obstacles?: readonly PickupObstacle[];
};

const DIAMOND_DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;
const CACHE_MEMBER_ID =
  /^(chunk:(-?(?:0|[1-9]\d*)),(-?(?:0|[1-9]\d*)):(0|[1-9]\d*)):stardust:([0-9]+)$/u;

export function discoveryStardustId(group: string, index: number): string {
  return `${group}:stardust:${index}`;
}

/** Exact producer identity and unchanged pickup fields, including members loaded from a save. */
export function discoveryCacheGroup(
  catalog: Pick<EconomyCatalog, "discoveryStardust" | "stardustPickupRadius">,
  member: SpaceObject,
): string | undefined {
  if (
    member.kind !== "pickup" ||
    member.role !== "stardust" ||
    member.hp !== 1 ||
    member.radius !== catalog.stardustPickupRadius ||
    member.amount !== catalog.discoveryStardust / DIAMOND_DIRECTIONS.length ||
    member.release !== undefined
  ) {
    return undefined;
  }
  const match = CACHE_MEMBER_ID.exec(member.id);
  if (!match) {
    return undefined;
  }
  const [, group, x, y, slot, index] = match;
  if (
    !group ||
    ![x, y, slot].every((value) => Number.isSafeInteger(Number(value)) && value !== "-0") ||
    index === undefined ||
    Number(index) >= DIAMOND_DIRECTIONS.length ||
    discoveryStardustId(group, Number(index)) !== member.id
  ) {
    return undefined;
  }
  return group;
}

/** Four pickups at three quarters of the ordinary projected diamond spacing. */
export function stardustDiamond(context: StardustSpacing, point: Vec): Vec[] {
  const step =
    (Math.ceil(Math.SQRT2 * (context.stardustPickupRadius + GALAXIES_FILE.lightField.keyline)) +
      context.stardustPickupGap) *
    0.75;
  return DIAMOND_DIRECTIONS.map(({ x, y }) => {
    const world = fromScreen({ x: x * step, y: y * step });
    return { x: point.x + world.x, y: point.y + world.y };
  });
}

/** Preserve random drop candidates while separating full-glint bounds in projected logical px. */
export function stardustDropOffsets(context: StardustSpacing, candidates: readonly Vec[]): Vec[] {
  const radius = Math.SQRT2 * (context.stardustPickupRadius + GALAXIES_FILE.lightField.keyline);
  const placed: Vec[] = [];
  for (const candidate of candidates) {
    const point = { ...candidate };
    const blockers = [
      ...(context.obstacles ?? []),
      ...placed.map((previous) => ({ ...previous, radius })),
    ].sort((a, b) => a.x - b.x);
    for (const previous of blockers) {
      const minimum = previous.radius + radius + context.stardustPickupGap;
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < minimum) {
        point.x = Math.ceil(previous.x + minimum);
      }
    }
    placed.push(point);
  }
  return placed;
}
