import GALAXIES_FILE from "../../public/art/galaxies.json" with { type: "json" };
import type { EconomyCatalog } from "../data/economy.ts";
import { stardustPickupReach } from "./pickupBody.ts";
import type { SpaceObject, Vec } from "./types.ts";

export interface PickupObstacle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}
type StardustSpacing = Pick<EconomyCatalog, "stardustPickupGap"> & {
  readonly obstacles?: readonly PickupObstacle[];
};

const LEGACY_CACHE_MEMBERS = 4;
const CACHE_MEMBER_ID =
  /^(chunk:(-?(?:0|[1-9]\d*)),(-?(?:0|[1-9]\d*)):(0|[1-9]\d*)):stardust:([0-9]+)$/u;

export function discoveryStardustId(group: string, index: number): string {
  return `${group}:stardust:${index}`;
}

/** Recognize a generated bundle or a surviving single from the previous cache layout. */
export function discoveryCacheGroup(
  catalog: Pick<EconomyCatalog, "discoveryStardust" | "stardustPickupRadius">,
  member: SpaceObject,
): string | undefined {
  if (member.kind !== "pickup" || member.role !== "stardust" || member.hp !== 1 || member.release) {
    return undefined;
  }
  const match = CACHE_MEMBER_ID.exec(member.id);
  if (!match) {
    return undefined;
  }
  const [, group, x, y, slot, index] = match;
  const memberIndex = Number(index);
  if (
    !group ||
    ![x, y, slot].every((value) => Number.isSafeInteger(Number(value)) && value !== "-0") ||
    memberIndex >= LEGACY_CACHE_MEMBERS ||
    discoveryStardustId(group, memberIndex) !== member.id
  ) {
    return undefined;
  }
  const legacy = member.amount === 1 && member.radius === catalog.stardustPickupRadius;
  const bundle =
    memberIndex === 0 &&
    member.amount === catalog.discoveryStardust &&
    member.radius === stardustPickupReach(catalog.stardustPickupRadius, member.amount);
  return legacy || bundle ? group : undefined;
}

/** A conservative projected radius for a glyph and its light-field keyline. */
export function pickupSpacingRadius(size: number): number {
  return Math.SQRT2 * (size / 2 + GALAXIES_FILE.lightField.keyline);
}

/** Space a row by visible glyph bounds, including both light-field keylines. */
export function pickupRowGap(gap: number): number {
  return gap + 2 * GALAXIES_FILE.lightField.keyline;
}

/** Preserve random drop candidates while separating the actual pickup sizes. */
export function stardustDropOffsets(
  context: StardustSpacing,
  candidates: readonly PickupObstacle[],
): Vec[] {
  const placed: Vec[] = [];
  const footprints: PickupObstacle[] = [];
  for (const { radius, x, y } of candidates) {
    const point = { x, y };
    const blocked = [...(context.obstacles ?? []), ...footprints].flatMap((other) => {
      const minimum = other.radius + radius + context.stardustPickupGap;
      const dy = Math.abs(y - other.y);
      if (dy >= minimum) {
        return [];
      }
      const dx = Math.sqrt(minimum ** 2 - dy ** 2);
      return [{ left: other.x - dx, right: other.x + dx }];
    });
    blocked.sort((a, b) => a.left - b.left);
    for (const { left, right } of blocked) {
      if (point.x <= left) {
        break;
      }
      if (point.x < right) {
        point.x = Math.ceil(right);
      }
    }
    placed.push(point);
    footprints.push({ ...point, radius });
  }
  return placed;
}
